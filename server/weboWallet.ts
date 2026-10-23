import 'server-only';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, webo_ledger, webo_wallets } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { monthKeyParis, nextMonthStartParis, splitDebit } from '@/lib/webocoins';
import { getWeboSettings } from './settings';

// Portefeuille de WeboCoins d'une entreprise (clé : son compte titulaire). Seul ce module change un solde : allocation
// du mois au premier usage, débit atomique et idempotent, remboursement, pièces offertes. Voir
// docs/superpowers/specs/2026-10-23-webocoins-traduction-webo-design.md.

export interface Wallet {
  month: number;
  kept: number;
  total: number;
  monthKey: string;
  mode: 'webo' | 'free';
  /** Renouvellement des pièces du mois (ISO). */
  renewsAt: string;
}

export interface LedgerRow {
  id: string;
  created_at: string;
  kind: string;
  coins: number;
  reason: string;
  user_name: string | null;
}

/** L'entreprise d'un compte : son titulaire s'il en a un, sinon lui-même. */
export async function companyIdFor(userId: string): Promise<string> {
  const [row] = await db.select({ parent: profiles.parent_user_id }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row?.parent ?? userId;
}

/** Le portefeuille, créé au besoin, avec les pièces du mois remises si le mois a changé. */
export async function walletOf(companyId: string, now: Date = new Date()): Promise<Wallet> {
  const key = monthKeyParis(now);
  await db.insert(webo_wallets).values({ company_id: companyId }).onConflictDoNothing();
  let [row] = await db.select().from(webo_wallets).where(eq(webo_wallets.company_id, companyId)).limit(1);
  if (row.month_key !== key) {
    const settings = await getWeboSettings();
    const coins = isDemoUser(companyId) ? 0 : (row.monthly_override ?? settings.monthlyCoins);
    // Conditionnel sur l'ancien mois : deux premiers usages simultanés ne donnent qu'une allocation.
    const [renewed] = await db.update(webo_wallets)
      .set({ month_key: key, month_coins: coins, updated_at: now.toISOString() })
      .where(and(eq(webo_wallets.company_id, companyId), eq(webo_wallets.month_key, row.month_key)))
      .returning();
    if (renewed && coins > 0) {
      await db.insert(webo_ledger).values({
        company_id: companyId, kind: 'allocation', coins, reason: 'Pièces du mois', idempotency_key: `alloc:${companyId}:${key}`,
      }).onConflictDoNothing();
    }
    [row] = await db.select().from(webo_wallets).where(eq(webo_wallets.company_id, companyId)).limit(1);
  }
  return {
    month: row.month_coins, kept: row.kept_coins, total: row.month_coins + row.kept_coins, monthKey: row.month_key,
    mode: row.translation_mode === 'free' ? 'free' : 'webo', renewsAt: nextMonthStartParis(now).toISOString(),
  };
}

const existingDebit = async (key: string) =>
  (await db.select({ id: webo_ledger.id }).from(webo_ledger).where(eq(webo_ledger.idempotency_key, key)).limit(1))[0];

/** Retire des pièces (du mois d'abord). Jamais sous zéro ; une même clé ne débite qu'une fois. */
export async function debitCoins(
  companyId: string,
  input: { userId: string; amount: number; reason: string; idempotencyKey: string },
  now: Date = new Date(),
): Promise<{ ok: true; ledgerId: string } | { ok: false; reason: 'balance' | 'demo' }> {
  if (isDemoUser(companyId)) return { ok: false, reason: 'demo' };
  const already = await existingDebit(input.idempotencyKey);
  if (already) return { ok: true, ledgerId: already.id };
  for (let attempt = 0; attempt < 3; attempt++) {
    const wallet = await walletOf(companyId, now);
    const split = splitDebit(wallet.month, wallet.kept, input.amount);
    if (!split) return { ok: false, reason: 'balance' };
    const result = await db.transaction(async (tx) => {
      const [done] = await tx.update(webo_wallets).set({
        month_coins: sql`${webo_wallets.month_coins} - ${split.fromMonth}`,
        kept_coins: sql`${webo_wallets.kept_coins} - ${split.fromKept}`,
        updated_at: now.toISOString(),
      }).where(and(
        eq(webo_wallets.company_id, companyId), eq(webo_wallets.month_key, wallet.monthKey),
        gte(webo_wallets.month_coins, split.fromMonth), gte(webo_wallets.kept_coins, split.fromKept),
      )).returning({ id: webo_wallets.company_id });
      if (!done) return null;
      const [line] = await tx.insert(webo_ledger).values({
        company_id: companyId, user_id: input.userId, kind: 'debit', coins: -input.amount,
        from_month: split.fromMonth, from_kept: split.fromKept, reason: input.reason.slice(0, 200), idempotency_key: input.idempotencyKey,
      }).onConflictDoNothing().returning({ id: webo_ledger.id });
      // Même clé enregistrée entre-temps par un envoi concurrent : on annule ce débit-ci.
      if (!line) throw new DuplicateDebit();
      return line.id;
    }).catch((e) => { if (e instanceof DuplicateDebit) return 'duplicate' as const; throw e; });
    if (result === 'duplicate') return { ok: true, ledgerId: (await existingDebit(input.idempotencyKey))!.id };
    if (result) return { ok: true, ledgerId: result };
    // Le solde a bougé entre la lecture et la mise à jour : on relit.
  }
  return { ok: false, reason: 'balance' };
}

class DuplicateDebit extends Error {}

/** Rend les pièces d'un débit (une seule fois) : les pièces du mois si le mois n'a pas changé, et les pièces gardées. */
export async function refundDebit(ledgerId: string): Promise<void> {
  const [debit] = await db.select().from(webo_ledger).where(and(eq(webo_ledger.id, ledgerId), eq(webo_ledger.kind, 'debit'))).limit(1);
  if (!debit) return;
  const debitMonth = monthKeyParis(new Date(debit.created_at));
  await db.transaction(async (tx) => {
    const [line] = await tx.insert(webo_ledger).values({
      company_id: debit.company_id, user_id: debit.user_id, kind: 'refund', coins: -debit.coins,
      from_month: debit.from_month, from_kept: debit.from_kept, reason: `Rendu : ${debit.reason}`.slice(0, 200), idempotency_key: `refund:${ledgerId}`,
    }).onConflictDoNothing().returning({ id: webo_ledger.id });
    if (!line) return;
    await tx.update(webo_wallets).set({
      month_coins: sql`${webo_wallets.month_coins} + (case when ${webo_wallets.month_key} = ${debitMonth} then ${debit.from_month} else 0 end)`,
      kept_coins: sql`${webo_wallets.kept_coins} + ${debit.from_kept}`,
    }).where(eq(webo_wallets.company_id, debit.company_id));
  });
}

/** Coût réel d'un débit lié à un appel à Claude. */
export async function recordUsage(ledgerId: string, u: { model: string; input: number; output: number; costUsd: number }): Promise<void> {
  await db.update(webo_ledger).set({ model: u.model, input_tokens: u.input, output_tokens: u.output, cost_usd: u.costUsd.toFixed(6) })
    .where(eq(webo_ledger.id, ledgerId));
}

/** Pièces offertes (gardées, sans date de fin). */
export async function giftCoins(companyId: string, input: { byUserId: string; coins: number; reason: string }): Promise<void> {
  await db.insert(webo_wallets).values({ company_id: companyId }).onConflictDoNothing();
  await db.transaction(async (tx) => {
    await tx.update(webo_wallets).set({ kept_coins: sql`${webo_wallets.kept_coins} + ${input.coins}` }).where(eq(webo_wallets.company_id, companyId));
    await tx.insert(webo_ledger).values({ company_id: companyId, user_id: input.byUserId, kind: 'gift', coins: input.coins, reason: input.reason.slice(0, 200) });
  });
}

/** Journal d'une entreprise, 25 lignes par page, plus récent d'abord. */
export async function ledgerOf(companyId: string, page: number): Promise<{ rows: LedgerRow[]; more: boolean }> {
  const size = 25;
  const rows = await db.select({
    id: webo_ledger.id, created_at: webo_ledger.created_at, kind: webo_ledger.kind, coins: webo_ledger.coins, reason: webo_ledger.reason,
    first: profiles.first_name, last: profiles.last_name,
  }).from(webo_ledger).leftJoin(profiles, eq(profiles.id, webo_ledger.user_id))
    .where(eq(webo_ledger.company_id, companyId))
    .orderBy(desc(webo_ledger.created_at), desc(webo_ledger.id))
    .limit(size + 1).offset(Math.max(0, page) * size);
  return {
    rows: rows.slice(0, size).map(({ first, last, ...r }) => ({ ...r, user_name: [first, last].filter(Boolean).join(' ') || null })),
    more: rows.length > size,
  };
}
