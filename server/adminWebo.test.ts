import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Admin des WeboCoins : comptes du mois (coût réel, valeur, marge théorique), pièces offertes, réglages.

vi.mock('server-only', () => ({}));
const ADMIN = '00000000-0000-4000-8000-0000000000a9';
const CHEF = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000ab';
let isAdmin = true;
vi.mock('./session', () => ({
  requireAdmin: async () => { if (!isAdmin) throw new Error('Réservé aux administrateurs'); return { id: ADMIN, email: 'a@t.fr' }; },
  requireUser: async () => ({ id: ADMIN, email: 'a@t.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const a = await import('./adminWebo');
const { walletOf } = await import('./weboWallet');
const KEY = '2026-10';
const OCT = new Date('2026-10-15T10:00:00Z');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ADMIN}', 'a@t.fr', 'x'), ('${CHEF}', 'c@t.fr', 'x'), ('${OTHER}', 'o@t.fr', 'x');
    insert into profiles (id, email, company_name, role) values ('${ADMIN}', 'a@t.fr', 'WeboDevis', 'admin'), ('${CHEF}', 'c@t.fr', 'Traiteur Chef', 'user'), ('${OTHER}', 'o@t.fr', 'Autre', 'user');
  `);
});
beforeEach(async () => {
  isAdmin = true;
  await pg.exec(`delete from webo_ledger; delete from webo_wallets; delete from app_settings where key like 'webo_%';`);
});

describe('admin WeboCoins', () => {
  it('stats du mois : pièces, coût réel, valeur, marge théorique, par entreprise', async () => {
    await walletOf(CHEF, OCT);
    await pg.exec(`
      insert into webo_ledger (company_id, kind, coins, from_month, reason, cost_usd, created_at) values
        ('${CHEF}', 'debit', -1, 1, 'Traduction : A', 0.0014, '2026-10-16T10:00:00Z'),
        ('${CHEF}', 'debit', -1, 1, 'Traduction : B', 0.0014, '2026-10-16T11:00:00Z'),
        ('${CHEF}', 'debit', -1, 1, 'Traduction : septembre', 0.0014, '2026-09-16T11:00:00Z');
    `);
    const s = await a.weboStats(KEY);
    expect(s.spentCoins).toBe(2);
    expect(s.spentFromMonth).toBe(2);
    expect(s.costUsd).toBeCloseTo(0.0028, 6);
    expect(s.costEur).toBeCloseTo(0.002576, 6);
    expect(s.valueEur).toBeCloseTo(0.02, 6);
    expect(s.marginEur).toBeCloseTo(0.02 - 0.002576, 6);
    expect(s.companies.find((c) => c.companyId === CHEF)).toMatchObject({ name: 'Traiteur Chef', spent: 2 });
  });

  it('offrir des pièces : pièces gardées + journal gift avec motif ; motif vide refusé', async () => {
    expect((await a.adminGiftCoins(CHEF, 30, '  ')).error).toBeTruthy();
    expect((await a.adminGiftCoins(CHEF, 30, 'Bienvenue')).error).toBeNull();
    expect((await walletOf(CHEF)).kept).toBe(30);
    const page = await a.adminLedger(CHEF, 0);
    expect(page.rows.find((r) => r.kind === 'gift')).toMatchObject({ coins: 30, reason: 'Bienvenue' });
  });

  it('réglage propre du compte appliqué au mois suivant', async () => {
    await walletOf(OTHER, OCT);
    expect((await a.adminSetMonthlyOverride(OTHER, 1000)).error).toBeNull();
    expect((await walletOf(OTHER, OCT)).month).toBe(200);
    expect((await walletOf(OTHER, new Date('2026-11-02T10:00:00Z'))).month).toBe(1000);
    await a.adminSetMonthlyOverride(OTHER, null);
    expect((await walletOf(OTHER, new Date('2026-12-02T10:00:00Z'))).month).toBe(200);
  });

  it('réglages généraux : enregistrés et bornés', async () => {
    await a.adminSetWeboSettings({ monthlyCoins: 300, actionCoefficient: 99 });
    const s = await a.adminGetWeboSettings();
    expect(s).toMatchObject({ monthlyCoins: 300, actionCoefficient: 20 });
  });

  it('non-admin : refusé', async () => {
    isAdmin = false;
    await expect(a.weboStats(KEY)).rejects.toThrow();
    await expect(a.adminGiftCoins(CHEF, 10, 'x')).rejects.toThrow();
  });
});
