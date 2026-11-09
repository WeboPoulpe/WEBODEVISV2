'use server';

// Réécriture d'un texte de brochure par Webo (Studio : corriger, reformuler, raccourcir…), payée en WeboCoins comme
// une traduction de fiche : une pièce réservée avant l'appel à Claude, rendue s'il échoue.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { sanitizeHtml } from '@/lib/sanitize';
import { haikuCostUsd } from '@/lib/webocoins';
import { REWRITE_MODES, rewriteBrochureText, weboAvailable, WEBO_MODEL, type RewriteMode } from '@/lib/webo/claude';
import { requireUser } from './session';
import { getWeboSettings } from './settings';
import { companyIdFor, debitCoins, recordUsage, refundDebit, walletOf } from './weboWallet';

const MAX_HTML = 12_000;

export async function rewriteWithWebo(input: { html: string; mode: RewriteMode; requestId: string }): Promise<{ html: string; balance: number } | { error: string }> {
  const user = await requireUser();
  const mode = input?.mode;
  if (!mode || !(mode in REWRITE_MODES)) return { error: 'Demande inconnue.' };
  const html = String(input.html ?? '');
  if (!html.replace(/<[^>]*>|&nbsp;|\s/g, '')) return { error: 'Le texte est vide.' };
  if (html.length > MAX_HTML) return { error: 'Texte trop long pour Webo : coupez-le en plusieurs.' };
  const companyId = await companyIdFor(user.id);
  const [me] = await db.select({ role: profiles.company_role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (me?.role === 'lecture') return { error: 'Votre accès est en lecture seule.' };
  if (isDemoUser(user.id) || isDemoUser(companyId)) return { error: 'Webo n’écrit pas dans le compte de démonstration.' };
  if (!weboAvailable()) return { error: 'Webo n’est pas disponible pour le moment.' };
  const settings = await getWeboSettings();
  const debit = await debitCoins(companyId, {
    userId: user.id, amount: settings.translationPrice, reason: `Brochure : ${REWRITE_MODES[mode].label}`,
    idempotencyKey: `rw:${companyId}:${String(input.requestId ?? '').slice(0, 100)}`,
  });
  if (!debit.ok) return { error: debit.reason === 'demo' ? 'Webo n’écrit pas dans le compte de démonstration.' : 'Plus assez de WeboCoins pour ce mois.' };
  if (debit.replay) return { error: 'Demande déjà traitée.' };
  try {
    const out = await rewriteBrochureText(html, mode);
    await recordUsage(debit.ledgerId, { model: WEBO_MODEL, input: out.usage.input, output: out.usage.output, costUsd: haikuCostUsd(out.usage) });
    return { html: sanitizeHtml(out.html), balance: (await walletOf(companyId)).total };
  } catch (e) {
    const usage = (e as { usage?: { input: number; output: number } }).usage;
    if (usage) await recordUsage(debit.ledgerId, { model: WEBO_MODEL, input: usage.input, output: usage.output, costUsd: haikuCostUsd(usage) });
    await refundDebit(debit.ledgerId);
    return { error: 'Webo n’a pas pu réécrire ce texte. Réessayez.' };
  }
}
