'use server';

import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, webo_ledger } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { sanitizeHtml } from '@/lib/sanitize';
import { haikuCostUsd, monthKeyParis } from '@/lib/webocoins';
import { translateFicheFrToEn, weboAvailable, WEBO_MODEL } from '@/lib/webo/claude';
import { requireUser } from './session';
import { getWeboSettings } from './settings';
import { companyIdFor, debitCoins, recordUsage, refundDebit, walletOf } from './weboWallet';

// Traduction de fiches par Webo, payée en WeboCoins : une pièce réservée par fiche avant l'appel à Claude, rendue si
// l'appel échoue. Ce qui ne passe pas par Webo (solde, plafond, droits, panne) revient avec sa raison : le navigateur
// le traduit alors en gratuit.

export type WeboFallback = 'balance' | 'cap' | 'error' | 'readonly' | 'demo' | 'off';
export type WeboResult = { key: string; ok: true; name: string; html: string } | { key: string; ok: false; why: WeboFallback };

// Petits lots (le navigateur enchaîne les appels) : un appel coupé en route n'engage que quelques pièces.
const MAX_FICHES = 8;
// Au-delà, la traduction ne tiendrait pas dans la réponse : la fiche n'est ni débitée ni envoyée.
const MAX_HTML = 20_000;
const PARALLEL = 4;

/** Début du mois de Paris en cours, en UTC (pour compter les traductions du mois). */
function monthStart(now: Date): string {
  const [y, m] = monthKeyParis(now).split('-').map(Number);
  // Large d'un jour avant : le compte se refait sur la clé de mois, calculée à Paris.
  return new Date(Date.UTC(y, m - 1, 1) - 86_400_000).toISOString();
}

async function translationsThisMonth(companyId: string, now: Date): Promise<number> {
  // Les essais comptent, réussis ou non : un appel raté a coûté lui aussi.
  const rows = await db.select({ created_at: webo_ledger.created_at }).from(webo_ledger).where(and(
    eq(webo_ledger.company_id, companyId), eq(webo_ledger.kind, 'debit'),
    sql`${webo_ledger.reason} like 'Traduction : %'`, gte(webo_ledger.created_at, monthStart(now)),
  ));
  const key = monthKeyParis(now);
  return rows.filter((r) => monthKeyParis(new Date(r.created_at)) === key).length;
}

export async function translateWithWebo(
  fiches: { key: string; requestId: string; name: string; html: string }[],
): Promise<{ results: WeboResult[]; spent: number; balance: number }> {
  const user = await requireUser();
  const list = (Array.isArray(fiches) ? fiches : []).slice(0, MAX_FICHES)
    .filter((f) => f && typeof f.key === 'string' && typeof f.requestId === 'string' && typeof f.html === 'string')
    .map((f) => ({ key: f.key, requestId: f.requestId.slice(0, 100), name: String(f.name ?? '').slice(0, 200), html: f.html }));
  const companyId = await companyIdFor(user.id);
  const all = (why: WeboFallback) => list.map((f): WeboResult => ({ key: f.key, ok: false, why }));
  const finish = async (results: WeboResult[], spent: number) => ({ results, spent, balance: (await walletOf(companyId)).total });

  const [me] = await db.select({ role: profiles.company_role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (me?.role === 'lecture') return finish(all('readonly'), 0);
  if (isDemoUser(user.id) || isDemoUser(companyId)) return finish(all('demo'), 0);
  if (!weboAvailable()) return finish(all('off'), 0);

  const settings = await getWeboSettings();
  const now = new Date();
  let room = settings.translationCap - await translationsThisMonth(companyId, now);
  let spent = 0;

  // Réservations dans l'ordre (le solde part sur les premières fiches), puis appels à Claude en parallèle.
  const reserved: { f: (typeof list)[number]; ledgerId: string }[] = [];
  const results = new Map<string, WeboResult>();
  const seen = new Set<string>();
  for (const f of list) {
    // Même demande deux fois dans la liste, ou fiche trop longue : pas de Webo pour elle.
    if (seen.has(f.requestId) || f.html.length > MAX_HTML) { results.set(f.key, { key: f.key, ok: false, why: 'error' }); continue; }
    seen.add(f.requestId);
    if (room <= 0) { results.set(f.key, { key: f.key, ok: false, why: 'cap' }); continue; }
    const debit = await debitCoins(companyId, {
      userId: user.id, amount: settings.translationPrice, reason: `Traduction : ${f.name || 'fiche'}`, idempotencyKey: `tr:${companyId}:${f.requestId}`,
    }, now);
    if (!debit.ok) { results.set(f.key, { key: f.key, ok: false, why: debit.reason === 'demo' ? 'demo' : 'balance' }); continue; }
    // Demande rejouée : déjà traitée une fois, Claude n'est pas rappelé.
    if (debit.replay) { results.set(f.key, { key: f.key, ok: false, why: 'error' }); continue; }
    room--;
    reserved.push({ f, ledgerId: debit.ledgerId });
  }

  let next = 0;
  const worker = async () => {
    while (next < reserved.length) {
      const { f, ledgerId } = reserved[next++];
      try {
        const out = await translateFicheFrToEn({ name: f.name, html: f.html });
        await recordUsage(ledgerId, { model: WEBO_MODEL, input: out.usage.input, output: out.usage.output, costUsd: haikuCostUsd(out.usage) });
        const name = out.name.replace(/<[^>]*>/g, '').trim().slice(0, 200);
        results.set(f.key, { key: f.key, ok: true, name, html: sanitizeHtml(out.html) });
        spent += settings.translationPrice;
      } catch (e) {
        // Appel raté mais facturé par Anthropic (réponse coupée…) : son coût est noté, la pièce est rendue.
        const usage = (e as { usage?: { input: number; output: number; cacheWrite: number; cacheRead: number } }).usage;
        if (usage) await recordUsage(ledgerId, { model: WEBO_MODEL, input: usage.input, output: usage.output, costUsd: haikuCostUsd(usage) });
        await refundDebit(ledgerId);
        results.set(f.key, { key: f.key, ok: false, why: 'error' });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, reserved.length) }, worker));
  return finish(list.map((f) => results.get(f.key)!), spent);
}
