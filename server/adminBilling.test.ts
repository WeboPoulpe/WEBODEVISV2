import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Admin de l'abonnement : colonne Abonnement, accès offert, interrupteur « Abonnement obligatoire ».

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }));
const ADMIN = '00000000-0000-4000-8000-0000000000b1';
const CHEF = '00000000-0000-4000-8000-0000000000b2';
const COLLAB = '00000000-0000-4000-8000-0000000000b3';
let isAdmin = true;
vi.mock('./session', () => ({
  requireAdmin: async () => { if (!isAdmin) throw new Error('Réservé aux administrateurs'); return { id: ADMIN, email: 'a@t.fr' }; },
  requireUser: async () => ({ id: ADMIN, email: 'a@t.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const a = await import('./admin');
const { getBillingEnforced } = await import('./settings');
const { getSubscription } = await import('./subscription');
const { DEMO_USER_ID } = await import('@/lib/demo');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ADMIN}', 'a@t.fr', 'x'), ('${CHEF}', 'c@t.fr', 'x'), ('${COLLAB}', 'k@t.fr', 'x');
    insert into profiles (id, email, company_name, role) values ('${ADMIN}', 'a@t.fr', 'WeboDevis', 'admin'), ('${CHEF}', 'c@t.fr', 'Traiteur Chef', 'user');
    insert into profiles (id, email, role, parent_user_id) values ('${COLLAB}', 'k@t.fr', 'user', '${CHEF}');
  `);
});
beforeEach(async () => {
  isAdmin = true;
  await pg.exec(`delete from company_subscriptions; delete from audit_log; delete from app_settings where key = 'billing_enforced';`);
});
beforeEach(() => { vi.stubEnv('STRIPE_PRICE_MENSUEL', 'price_m'); vi.stubEnv('STRIPE_PRICE_ANNUEL', 'price_a'); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('admin abonnement', () => {
  it('un non-admin est refusé', async () => {
    isAdmin = false;
    await expect(a.setAccountComped(CHEF, true, 'x')).rejects.toThrow();
    await expect(a.setBillingEnforcedAdmin(true)).rejects.toThrow();
  });

  it('accès offert : écrit la ligne, journalise, et le retrait aussi', async () => {
    expect((await a.setAccountComped(CHEF, true, 'Bêta')).error).toBeNull();
    expect(await getSubscription(CHEF)).toMatchObject({ comped: true });
    expect((await pg.query(`select action from audit_log where target_user_id = '${CHEF}'`)).rows).toEqual([{ action: 'acces_offert' }]);
    expect((await a.setAccountComped(CHEF, false, '')).error).toBeNull();
    expect((await pg.query(`select action from audit_log order by created_at desc limit 1`)).rows).toEqual([{ action: 'acces_offert_retire' }]);
  });

  it('refuse un collaborateur et le compte de démo', async () => {
    expect((await a.setAccountComped(COLLAB, true, '')).error).toBeTruthy();
    expect((await a.setAccountComped(DEMO_USER_ID, true, '')).error).toBeTruthy();
    expect(await getSubscription(COLLAB)).toBeNull();
  });

  it('listAccounts : abonnement du titulaire, rien pour un collaborateur', async () => {
    await a.setAccountComped(CHEF, true, '');
    const list = await a.listAccounts();
    expect(list.find((x) => x.id === CHEF)?.subscription).toMatchObject({ comped: true, status: 'none' });
    expect(list.find((x) => x.id === COLLAB)?.subscription).toBeNull();
    expect(list.find((x) => x.id === ADMIN)?.subscription).toBeNull();
  });

  it('abonnement obligatoire : refusé en production avec une clé de test, accepté ailleurs', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_abc');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await a.setBillingEnforcedAdmin(true)).error).toBe("Stripe est en mode test : passez les clés en Live d'abord.");
    expect(await getBillingEnforced()).toBe(false);

    vi.stubEnv('VERCEL_ENV', 'preview');
    expect((await a.setBillingEnforcedAdmin(true)).error).toBeNull();
    expect(await getBillingEnforced()).toBe(true);

    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await a.setBillingEnforcedAdmin(false)).error).toBeNull();
    expect(await getBillingEnforced()).toBe(false);
    const rows = (await pg.query(`select details from audit_log where action = 'abonnement_obligatoire' order by created_at`)).rows;
    expect(rows).toEqual([{ details: { on: true } }, { details: { on: false } }]);
  });

  it('abonnement obligatoire : accepté en production avec une clé live', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_abc');
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await a.setBillingEnforcedAdmin(true)).error).toBeNull();
  });

  it('abonnement obligatoire : refusé si la clé ou un prix Stripe manque, même hors production', async () => {
    const msg = 'Stripe n’est pas configuré : ajoutez la clé secrète et les deux prix d’abord.';
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect((await a.setBillingEnforcedAdmin(true)).error).toBe(msg);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_abc');
    vi.stubEnv('STRIPE_PRICE_ANNUEL', '');
    expect((await a.setBillingEnforcedAdmin(true)).error).toBe(msg);
    expect(await getBillingEnforced()).toBe(false);
    expect((await a.setBillingEnforcedAdmin(false)).error).toBeNull();
  });
});
