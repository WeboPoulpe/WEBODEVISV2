'use server';

import { and, eq, sql } from 'drizzle-orm';
import { companyIdsOf } from './companyScope';
import { db } from '@/db';
import { event_ingredients, ingredients, quotes, stock_movements } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { requireUser, requireWriter } from './session';

// Sortie de stock d'un événement : les quantités de la liste de courses quittent le stock en une fois.
// Le stock de l'ingrédient est mis à jour par le déclencheur apply_stock_movement, qui ne réagit qu'aux
// insertions : une sortie s'annule donc par des entrées inverses, jamais en supprimant les mouvements.
//
// État d'un événement : retiré du stock si sa dernière sortie est plus récente que sa dernière entrée
// d'annulation. Les mouvements d'une même opération partagent leur date (même transaction).

const companyAccess = (uid: string) =>
  sql`(${quotes.user_id} = ${uid} or ${quotes.owner_user_id} = ${uid} or ${quotes.owner_user_id} in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface StockExitState {
  error: string | null;
  /** Date de la sortie en cours, ou null si l'événement n'est pas retiré du stock. */
  withdrawnAt: string | null;
}

export interface StockExitResult extends StockExitState {
  /** Nombre d'ingrédients retirés (ou remis en stock à l'annulation). */
  count: number;
  /** Ingrédients dont le stock passe sous zéro après la sortie. */
  shortages: string[];
}

async function loadQuote(uid: string, quoteId: string, tx: Tx | typeof db = db, lock = false) {
  const query = tx
    .select({ id: quotes.id, event_type: quotes.event_type, event_date: quotes.event_date, client_name: quotes.client_name })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), companyAccess(uid)))
    .limit(1);
  // Le verrou sur l'événement empêche deux sorties simultanées (double clic, deux appareils).
  const [quote] = lock ? await query.for('update') : await query;
  return quote ?? null;
}

async function currentState(tx: Tx | typeof db, quoteId: string): Promise<string | null> {
  const { rows } = await tx.execute(sql`
    select max(created_at) filter (where movement_type = 'out') as last_out,
           max(created_at) filter (where movement_type = 'out')
             > coalesce(max(created_at) filter (where movement_type = 'in'), '-infinity'::timestamptz) as withdrawn
    from public.stock_movements where event_id = ${quoteId}`);
  const row = rows[0] as { last_out: string | Date | null; withdrawn: boolean | null } | undefined;
  if (!row?.withdrawn || !row.last_out) return null;
  return row.last_out instanceof Date ? row.last_out.toISOString() : new Date(row.last_out).toISOString();
}

const reasonFor = (quote: { event_type: string | null; event_date: string | null; client_name: string | null }) => {
  const type = quote.event_type?.trim();
  const date = quote.event_date ? new Date(`${quote.event_date.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR') : null;
  return ['Événement', type, date ? `du ${date}` : quote.client_name ? `(${quote.client_name})` : null].filter(Boolean).join(' ');
};

/** L'événement est-il déjà retiré du stock ? */
export async function getEventStockExit(quoteId: string): Promise<StockExitState> {
  const user = await requireUser();
  const quote = await loadQuote(user.id, quoteId);
  if (!quote) return { error: 'Événement introuvable.', withdrawnAt: null };
  return { error: null, withdrawnAt: await currentState(db, quoteId) };
}

/**
 * Retire du stock les ingrédients de la liste de courses de l'événement (un mouvement de sortie par
 * ingrédient, quantités additionnées si l'ingrédient figure sur plusieurs lignes). Seuls les
 * ingrédients dont le compte suit le stock sont concernés : ses ingrédients et ceux du catalogue commun,
 * comme sur la page Stock. Une seule sortie à la fois par événement.
 */
export async function withdrawEventStock(quoteId: string): Promise<StockExitResult> {
  const user = await requireWriter();
  const empty = { withdrawnAt: null, count: 0, shortages: [] };
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED, ...empty };

  return db.transaction(async (tx) => {
    const quote = await loadQuote(user.id, quoteId, tx, true);
    if (!quote) return { error: 'Événement introuvable.', ...empty };
    const already = await currentState(tx, quoteId);
    if (already) return { error: 'Cet événement est déjà retiré du stock.', ...empty, withdrawnAt: already };

    const needs = await tx
      .select({
        ingredient_id: event_ingredients.ingredient_id,
        name: ingredients.name,
        stock: ingredients.stock_quantity,
        quantity: sql<string>`sum(${event_ingredients.quantity})`,
      })
      .from(event_ingredients)
      .innerJoin(ingredients, eq(ingredients.id, event_ingredients.ingredient_id))
      .where(and(
        eq(event_ingredients.quote_id, quoteId),
        sql`(${ingredients.user_id} is null or ${ingredients.user_id} in ${companyIdsOf(user.id)})`,
      ))
      .groupBy(event_ingredients.ingredient_id, ingredients.name, ingredients.stock_quantity);
    const lines = needs.filter((n) => Number(n.quantity) > 0);
    if (lines.length === 0) return { error: 'La liste de courses ne contient aucun ingrédient suivi en stock.', ...empty };

    const reason = reasonFor(quote);
    await tx.insert(stock_movements).values(lines.map((n) => ({
      user_id: user.id,
      ingredient_id: n.ingredient_id,
      movement_type: 'out',
      quantity: String(Number(n.quantity)),
      reason,
      event_id: quoteId,
    })));
    const shortages = lines
      .filter((n) => Number(n.stock ?? 0) - Number(n.quantity) < 0)
      .map((n) => n.name)
      .sort((a, b) => a.localeCompare(b, 'fr'));
    return { error: null, withdrawnAt: await currentState(tx, quoteId), count: lines.length, shortages };
  });
}

/** Annule la dernière sortie de l'événement : chaque quantité retirée revient en stock. */
export async function cancelEventStockExit(quoteId: string): Promise<StockExitResult> {
  const user = await requireWriter();
  const empty = { withdrawnAt: null, count: 0, shortages: [] };
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED, ...empty };

  return db.transaction(async (tx) => {
    const quote = await loadQuote(user.id, quoteId, tx, true);
    if (!quote) return { error: 'Événement introuvable.', ...empty };
    const withdrawnAt = await currentState(tx, quoteId);
    if (!withdrawnAt) return { error: 'Cet événement n’est pas retiré du stock.', ...empty };

    // Les sorties de la dernière opération (même date, même transaction).
    const outs = await tx
      .select({ ingredient_id: stock_movements.ingredient_id, quantity: stock_movements.quantity })
      .from(stock_movements)
      .where(and(
        eq(stock_movements.event_id, quoteId),
        eq(stock_movements.movement_type, 'out'),
        sql`${stock_movements.created_at} = (select max(m.created_at) from public.stock_movements m where m.event_id = ${quoteId} and m.movement_type = 'out')`,
      ));
    if (outs.length === 0) return { error: 'Cet événement n’est pas retiré du stock.', ...empty };

    await tx.insert(stock_movements).values(outs.map((m) => ({
      user_id: user.id,
      ingredient_id: m.ingredient_id,
      movement_type: 'in',
      quantity: m.quantity,
      reason: `Annulation de la sortie : ${reasonFor(quote)}`,
      event_id: quoteId,
    })));
    return { error: null, withdrawnAt: null, count: outs.length, shortages: [] };
  });
}
