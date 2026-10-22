'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quote_acceptances, quotes } from '@/db/schema';
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
 * Retient une formule du devis (ou aucune : null). Le devis prend le total de la formule retenue.
 *  • Devis déjà facturé (facture ou acompte émis, hors avoirs et factures annulées) : refusé, les factures ne
 *    correspondraient plus au devis.
 *  • Devis signé en ligne : `needsResign` tant que `confirmResign` n'est pas donné ; une fois confirmé, l'accord
 *    devient caduc (déclencheur invalidate_quote_acceptance) et le devis repasse « envoyé », à signer de nouveau.
 */
export async function chooseQuoteFormula(
  quoteId: string,
  formulaId: string | null,
  opts: { confirmResign?: boolean } = {},
): Promise<{ error: string | null; totalTTC?: number | null; needsResign?: boolean; resigned?: boolean }> {
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

  const [{ n: invoiced }] = (await db.execute(sql`
    select count(*)::int as n from public.customer_invoices
    where quote_id = ${q.id} and status not in ('brouillon', 'annulee') and kind <> 'avoir'`)).rows as { n: number }[];
  if (invoiced > 0) {
    return { error: 'Ce devis a déjà une facture ou un acompte : sa formule ne peut plus changer. Annulez d’abord la facture par un avoir, ou dupliquez le devis.' };
  }
  const [signed] = await db.select({ id: quote_acceptances.id }).from(quote_acceptances)
    .where(and(eq(quote_acceptances.quote_id, q.id), isNull(quote_acceptances.invalidated_at))).limit(1);
  if (signed && !opts.confirmResign) return { error: null, needsResign: true };

  await db.transaction(async (tx) => {
    // L'historique des statuts (déclencheur) attribue le changement à l'utilisateur.
    await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);
    await tx.update(quotes).set({
      chosen_formula_id: next.chosen_formula_id,
      total_amount: total == null ? q.total_amount : total.toFixed(2),
      // L'accord signé portait sur l'autre formule : le devis est de nouveau à signer.
      ...(signed ? { status: 'devis_envoye' } : {}),
      updated_at: new Date().toISOString(),
    }).where(eq(quotes.id, q.id));
  });
  return { error: null, totalTTC: total, resigned: !!signed };
}
