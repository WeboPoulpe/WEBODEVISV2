import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

// Portefeuille de WeboCoins, sur le vrai schéma en mémoire.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000e1';
const MEMBER = '00000000-0000-4000-8000-0000000000e2';
const OTHER = '00000000-0000-4000-8000-0000000000e3';
let current = OWNER;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const w = await import('./weboWallet');
const actions = await import('./weboWalletActions');

const OCT = new Date('2026-10-15T10:00:00Z');
const balance = async (id: string) => (await pg.query<{ month_coins: number; kept_coins: number }>(`select month_coins, kept_coins from webo_wallets where company_id = $1`, [id])).rows[0];
const lines = async (id: string, kind?: string) => (await pg.query<{ kind: string; coins: number; from_month: number; from_kept: number }>(
  `select kind, coins, from_month, from_kept from webo_ledger where company_id = $1 ${kind ? `and kind = '${kind}'` : ''} order by created_at`, [id])).rows;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@w.fr', 'x'), ('${MEMBER}', 'm@w.fr', 'x'), ('${OTHER}', 'a@w.fr', 'x'), ('${DEMO_USER_ID}', 'demo@w.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'o@w.fr', 'Traiteur W'), ('${OTHER}', 'a@w.fr', 'Autre'), ('${DEMO_USER_ID}', 'demo@w.fr', 'Démo');
    insert into profiles (id, email, parent_user_id, company_role) values ('${MEMBER}', 'm@w.fr', '${OWNER}', 'commercial');
  `);
});
beforeEach(async () => {
  await pg.exec(`delete from webo_ledger; delete from webo_wallets; delete from app_settings where key like 'webo_%';`);
  current = OWNER;
});

describe('portefeuille', () => {
  it('premier usage du mois : 200 pièces, une seule allocation même appelé deux fois', async () => {
    const a = await w.walletOf(OWNER, OCT);
    await w.walletOf(OWNER, OCT);
    expect(a).toMatchObject({ month: 200, kept: 0, total: 200, monthKey: '2026-10', mode: 'webo' });
    expect(await lines(OWNER, 'allocation')).toHaveLength(1);
  });

  it('débit : pièces du mois puis pièces gardées', async () => {
    await w.walletOf(OWNER, OCT);
    await pg.query(`update webo_wallets set month_coins = 3, kept_coins = 10 where company_id = $1`, [OWNER]);
    const r = await w.debitCoins(OWNER, { userId: OWNER, amount: 5, reason: 'Test', idempotencyKey: 'd1' }, OCT);
    expect(r.ok).toBe(true);
    expect(await balance(OWNER)).toEqual({ month_coins: 0, kept_coins: 8 });
    expect(await lines(OWNER, 'debit')).toEqual([{ kind: 'debit', coins: -5, from_month: 3, from_kept: 2 }]);
  });

  it('solde insuffisant : refusé, rien ne bouge', async () => {
    await w.walletOf(OWNER, OCT);
    await pg.query(`update webo_wallets set month_coins = 1, kept_coins = 0 where company_id = $1`, [OWNER]);
    expect(await w.debitCoins(OWNER, { userId: OWNER, amount: 2, reason: 'Test', idempotencyKey: 'd2' }, OCT)).toEqual({ ok: false, reason: 'balance' });
    expect(await balance(OWNER)).toEqual({ month_coins: 1, kept_coins: 0 });
    expect(await lines(OWNER, 'debit')).toHaveLength(0);
  });

  it('même clé d’unicité : un seul débit', async () => {
    const a = await w.debitCoins(OWNER, { userId: OWNER, amount: 1, reason: 'Test', idempotencyKey: 'same' }, OCT);
    const b = await w.debitCoins(OWNER, { userId: OWNER, amount: 1, reason: 'Test', idempotencyKey: 'same' }, OCT);
    expect(a.ok && b.ok && a.ledgerId === b.ledgerId).toBe(true);
    expect((await balance(OWNER)).month_coins).toBe(199);
  });

  it('deux débits simultanés pour la dernière pièce : un seul passe', async () => {
    await w.walletOf(OWNER, OCT);
    await pg.query(`update webo_wallets set month_coins = 1, kept_coins = 0 where company_id = $1`, [OWNER]);
    const res = await Promise.all([
      w.debitCoins(OWNER, { userId: OWNER, amount: 1, reason: 'A', idempotencyKey: 'c1' }, OCT),
      w.debitCoins(OWNER, { userId: OWNER, amount: 1, reason: 'B', idempotencyKey: 'c2' }, OCT),
    ]);
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    expect(res.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'balance' }]);
    expect(await balance(OWNER)).toEqual({ month_coins: 0, kept_coins: 0 });
  });

  it('remboursement : rendu une seule fois', async () => {
    await w.walletOf(OWNER, OCT);
    await pg.query(`update webo_wallets set month_coins = 1, kept_coins = 5 where company_id = $1`, [OWNER]);
    const r = await w.debitCoins(OWNER, { userId: OWNER, amount: 3, reason: 'Test', idempotencyKey: 'r1' }, OCT);
    if (!r.ok) throw new Error('débit refusé');
    await w.refundDebit(r.ledgerId);
    await w.refundDebit(r.ledgerId);
    expect(await balance(OWNER)).toEqual({ month_coins: 1, kept_coins: 5 });
    expect(await lines(OWNER, 'refund')).toEqual([{ kind: 'refund', coins: 3, from_month: 1, from_kept: 2 }]);
  });

  it('nouveau mois (31 octobre 23 h 30 UTC) : pièces du mois remises, gardées intactes', async () => {
    await w.walletOf(OWNER, OCT);
    await pg.query(`update webo_wallets set month_coins = 12, kept_coins = 40 where company_id = $1`, [OWNER]);
    const nov = await w.walletOf(OWNER, new Date('2026-10-31T23:30:00Z'));
    expect(nov).toMatchObject({ month: 200, kept: 40, monthKey: '2026-11' });
    expect(await lines(OWNER, 'allocation')).toHaveLength(2);
  });

  it('démo : 0 pièce du mois, débit refusé (demo)', async () => {
    expect((await w.walletOf(DEMO_USER_ID, OCT)).month).toBe(0);
    expect(await w.debitCoins(DEMO_USER_ID, { userId: DEMO_USER_ID, amount: 1, reason: 'x', idempotencyKey: 'demo' }, OCT)).toEqual({ ok: false, reason: 'demo' });
    expect(await lines(DEMO_USER_ID, 'allocation')).toHaveLength(0);
  });

  it('réglage propre du compte : 0 coupe l’allocation, 500 la remplace ; réglage général pris en compte', async () => {
    await pg.query(`insert into webo_wallets (company_id, monthly_override) values ($1, 0), ($2, 500)`, [OWNER, OTHER]);
    expect((await w.walletOf(OWNER, OCT)).month).toBe(0);
    expect((await w.walletOf(OTHER, OCT)).month).toBe(500);
    await pg.exec(`delete from webo_wallets; insert into app_settings (key, value) values ('webo_monthly_coins', '150'::jsonb);`);
    expect((await w.walletOf(OWNER, OCT)).month).toBe(150);
  });

  it('pièces offertes : gardées, au journal', async () => {
    await w.giftCoins(OWNER, { byUserId: OTHER, coins: 50, reason: 'Geste commercial' });
    const wal = await w.walletOf(OWNER, OCT);
    expect(wal.kept).toBe(50);
    const page = await w.ledgerOf(OWNER, 0);
    expect(page.rows.map((r) => r.reason)).toContain('Geste commercial');
  });

  it('deux comptes de la même entreprise partagent le portefeuille ; un autre ne le voit pas', async () => {
    current = MEMBER;
    const m = await actions.getMyWallet();
    expect(m.wallet.total).toBe(200);
    await w.giftCoins(OWNER, { byUserId: OTHER, coins: 7, reason: 'Merci' });
    expect((await actions.getMyWallet()).wallet.kept).toBe(7);
    current = OTHER;
    expect((await actions.getMyWallet()).wallet.kept).toBe(0);
    expect((await actions.getMyLedger(0)).rows.map((r) => r.reason)).not.toContain('Merci');
  });

  it('mode de traduction : réglage de l’entreprise', async () => {
    current = MEMBER;
    await actions.setTranslationMode('free');
    current = OWNER;
    expect((await actions.getMyWallet()).wallet.mode).toBe('free');
  });
});
