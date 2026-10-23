'use server';

import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, webo_ledger, webo_wallets } from '@/db/schema';
import { monthKeyParis } from '@/lib/webocoins';
import { requireAdmin } from './session';
import { getWeboSettings, setWeboSettings, type WeboSettings } from './settings';
import { giftCoins, ledgerOf, type LedgerRow } from './weboWallet';

// Admin des WeboCoins : comptes d'un mois (pièces dépensées, coût réel chez Anthropic, valeur des pièces, marge
// théorique tant que toutes les pièces sont offertes), pièces offertes à une entreprise, réglages.

export interface WeboCompanyStats { companyId: string; name: string; balance: number; spent: number; costUsd: number; override: number | null }
export interface WeboStats {
  spentCoins: number;
  spentFromMonth: number;
  spentFromKept: number;
  costUsd: number;
  costEur: number;
  valueEur: number;
  marginEur: number;
  companies: WeboCompanyStats[];
}

/** Bornes larges (un jour de part et d'autre) d'un mois « 2026-10 » ; le tri fin se fait à l'heure de Paris. */
function monthRange(key: string): [string, string] {
  const [y, m] = key.split('-').map(Number);
  return [new Date(Date.UTC(y, m - 1, 1) - 86_400_000).toISOString(), new Date(Date.UTC(y, m, 1) + 86_400_000).toISOString()];
}

export async function weboStats(monthKey: string): Promise<WeboStats> {
  await requireAdmin();
  const key = /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : monthKeyParis(new Date());
  const [from, to] = monthRange(key);
  const settings = await getWeboSettings();
  const lines = (await db.select({
    company_id: webo_ledger.company_id, kind: webo_ledger.kind, coins: webo_ledger.coins, from_month: webo_ledger.from_month,
    from_kept: webo_ledger.from_kept, cost_usd: webo_ledger.cost_usd, created_at: webo_ledger.created_at,
  }).from(webo_ledger).where(and(inArray(webo_ledger.kind, ['debit', 'refund']), gte(webo_ledger.created_at, from), lt(webo_ledger.created_at, to))))
    .filter((l) => monthKeyParis(new Date(l.created_at)) === key);

  const perCompany = new Map<string, { spent: number; costUsd: number }>();
  let spentFromMonth = 0;
  let spentFromKept = 0;
  let costUsd = 0;
  for (const l of lines) {
    // Débit : coins < 0 ; remboursement : coins > 0. La dépense nette est donc −coins.
    const sign = l.kind === 'debit' ? 1 : -1;
    spentFromMonth += sign * l.from_month;
    spentFromKept += sign * l.from_kept;
    const cost = Number(l.cost_usd ?? 0);
    costUsd += cost;
    const c = perCompany.get(l.company_id) ?? { spent: 0, costUsd: 0 };
    c.spent += -l.coins;
    c.costUsd += cost;
    perCompany.set(l.company_id, c);
  }
  const spentCoins = spentFromMonth + spentFromKept;
  const costEur = costUsd * settings.usdEur;
  const valueEur = spentCoins / 100;

  const companies = await db.select({
    id: profiles.id, name: profiles.company_name, email: profiles.email,
    month: webo_wallets.month_coins, kept: webo_wallets.kept_coins, override: webo_wallets.monthly_override,
  }).from(profiles).leftJoin(webo_wallets, eq(webo_wallets.company_id, profiles.id)).where(isNull(profiles.parent_user_id));

  return {
    spentCoins, spentFromMonth, spentFromKept, costUsd, costEur, valueEur, marginEur: valueEur - costEur,
    companies: companies.map((c) => ({
      companyId: c.id, name: c.name || c.email || '—', balance: (c.month ?? 0) + (c.kept ?? 0),
      spent: perCompany.get(c.id)?.spent ?? 0, costUsd: perCompany.get(c.id)?.costUsd ?? 0, override: c.override ?? null,
    })).sort((x, y) => y.spent - x.spent || x.name.localeCompare(y.name, 'fr')),
  };
}

export async function adminGiftCoins(companyId: string, coins: number, reason: string): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const n = Math.floor(Number(coins));
  if (!Number.isFinite(n) || n < 1 || n > 100_000) return { error: 'Entre 1 et 100 000 pièces.' };
  if (!reason?.trim()) return { error: 'Indiquez un motif : il apparaît dans l’historique du traiteur.' };
  const [company] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.id, companyId), isNull(profiles.parent_user_id))).limit(1);
  if (!company) return { error: 'Entreprise introuvable.' };
  await giftCoins(companyId, { byUserId: admin.id, coins: n, reason: reason.trim() });
  return { error: null };
}

/** Allocation mensuelle propre à une entreprise (null : valeur générale). Prend effet au prochain mois. */
export async function adminSetMonthlyOverride(companyId: string, coins: number | null): Promise<{ error: string | null }> {
  await requireAdmin();
  const value = coins === null ? null : Math.floor(Number(coins));
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100_000)) return { error: 'Entre 0 et 100 000 pièces.' };
  await db.insert(webo_wallets).values({ company_id: companyId, monthly_override: value })
    .onConflictDoUpdate({ target: webo_wallets.company_id, set: { monthly_override: value } });
  return { error: null };
}

export async function adminGetWeboSettings(): Promise<WeboSettings> {
  await requireAdmin();
  return getWeboSettings();
}

export async function adminSetWeboSettings(patch: Partial<WeboSettings>): Promise<{ error: string | null }> {
  await requireAdmin();
  await setWeboSettings(patch);
  return { error: null };
}

export async function adminLedger(companyId: string, page: number): Promise<{ rows: LedgerRow[]; more: boolean }> {
  await requireAdmin();
  return ledgerOf(companyId, Math.max(0, Math.floor(Number(page) || 0)));
}
