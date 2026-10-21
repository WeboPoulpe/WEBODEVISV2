'use server';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quotes } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { chosenFormula, parseFormulas } from '@/lib/quoteFormulas';
import { quoteTotalTTC } from '@/lib/quoteTotals';
import { companyIdsOf } from './companyScope';
import { quoteColumns } from './formulaColumns';
import { requireWriter } from './session';

// Formule retenue par le traiteur lui-même (accord du client par téléphone, en rendez-vous…). L'acceptation en
// ligne enregistre la sienne dans server/acceptance.ts.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retient une formule du devis (ou aucune : null). Le devis prend le total de la formule retenue ; un accord
 * signé en ligne sur une autre formule devient caduc (déclencheur invalidate_quote_acceptance).
 */
export async function chooseQuoteFormula(quoteId: string, formulaId: string | null): Promise<{ error: string | null; totalTTC?: number | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  if (typeof quoteId !== 'string' || !UUID.test(quoteId)) return { error: 'Devis introuvable.' };
  if (formulaId !== null && typeof formulaId !== 'string') return { error: 'Cette formule n’existe pas dans le devis.' };

  const [q] = await db.select(await quoteColumns()).from(quotes).where(and(
    eq(quotes.id, quoteId),
    sql`(${quotes.user_id} = ${user.id} or ${quotes.owner_user_id} = ${user.id} or ${quotes.owner_user_id} in ${companyIdsOf(user.id)})`,
  )).limit(1);
  if (!q) return { error: 'Devis introuvable.' };

  const formulas = parseFormulas(q.formulas);
  const formula = formulaId === null ? null : chosenFormula(formulas, formulaId);
  if (formulaId !== null && !formula) return { error: 'Cette formule n’existe pas dans le devis.' };
  const next = { ...q, chosen_formula_id: formula?.id ?? null };
  const total = quoteTotalTTC(next);
  if ((q.chosen_formula_id ?? null) === next.chosen_formula_id) return { error: null, totalTTC: total };

  await db.update(quotes).set({
    chosen_formula_id: next.chosen_formula_id,
    total_amount: total == null ? q.total_amount : total.toFixed(2),
    updated_at: new Date().toISOString(),
  }).where(eq(quotes.id, q.id));
  return { error: null, totalTTC: total };
}
