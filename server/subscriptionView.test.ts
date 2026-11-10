import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Ce que montrent les écrans d'abonnement : où va le compte (app, écran de paiement, attente du titulaire) et l'état
// affiché sur la page Abonnement et le bandeau. Sur le vrai schéma en mémoire.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000a1';
const MEMBER = '00000000-0000-4000-8000-0000000000a2';
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const v = await import('./subscriptionView');
const s = await import('./subscription');
const settings = await import('./settings');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@v.fr', 'x'), ('${MEMBER}', 'm@v.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'o@v.fr', 'Traiteur V');
    insert into profiles (id, email, parent_user_id, company_role) values ('${MEMBER}', 'm@v.fr', '${OWNER}', 'commercial');
  `);
});
beforeEach(async () => {
  await pg.exec(`delete from company_subscriptions; delete from app_settings where key = 'billing_enforced';`);
  s.clearAccessCache();
});
afterEach(() => { vi.unstubAllEnvs(); });

const subscribe = (fields: string) => pg.exec(`insert into company_subscriptions (company_id, ${fields.split('|')[0]}) values ('${OWNER}', ${fields.split('|')[1]})`);

describe('appGate', () => {
  it('réglage éteint : tout le monde entre', async () => {
    expect(await v.appGate(OWNER, false)).toBe('enter');
    expect(await v.appGate(MEMBER, false)).toBe('enter');
  });

  it('jamais abonnée : le titulaire va payer, le collaborateur attend le titulaire', async () => {
    await settings.setBillingEnforced(true);
    expect(await v.appGate(OWNER, false)).toBe('pay');
    expect(await v.appGate(MEMBER, false)).toBe('wait-owner');
  });

  it("l'administrateur entré dans le compte entre toujours", async () => {
    await settings.setBillingEnforced(true);
    expect(await v.appGate(OWNER, true)).toBe('enter');
    expect(await v.appGate(MEMBER, true)).toBe('enter');
  });

  it('abonnement arrêté (lecture seule) : on entre', async () => {
    await settings.setBillingEnforced(true);
    await subscribe(`status, ever_subscribed|'canceled', true`);
    expect(await v.appGate(OWNER, false)).toBe('enter');
    expect(await v.appGate(MEMBER, false)).toBe('enter');
  });

  it('abonné actif : on entre', async () => {
    await settings.setBillingEnforced(true);
    await subscribe(`status, ever_subscribed, plan|'active', true, 'mensuel'`);
    expect(await v.appGate(OWNER, false)).toBe('enter');
  });
});

describe('subscriptionView', () => {
  it('sans abonnement : état vide, titulaire reconnu', async () => {
    const view = await v.subscriptionView(OWNER);
    expect(view).toMatchObject({
      access: 'full', isOwner: true, status: 'none', plan: null, comped: false,
      cancel_at_period_end: false, current_period_end: null, subscribed: false,
    });
    expect(view.statusLabel).toBe('Inactif');
  });

  it('abonné annuel, résiliation programmée : vu pareil par le collaborateur, sans être titulaire', async () => {
    await settings.setBillingEnforced(true);
    await subscribe(`status, ever_subscribed, plan, cancel_at_period_end, current_period_end|'active', true, 'annuel', true, '2026-12-17T10:00:00Z'`);
    const view = await v.subscriptionView(MEMBER);
    expect(view).toMatchObject({ access: 'full', isOwner: false, plan: 'annuel', cancel_at_period_end: true, subscribed: true });
    expect(new Date(view.current_period_end!).toISOString()).toBe('2026-12-17T10:00:00.000Z');
    expect(view.statusLabel).toBe('Se termine bientôt');
  });

  it('accès offert et lecture seule', async () => {
    await settings.setBillingEnforced(true);
    await s.setComped(OWNER, true, 'bêta');
    expect(await v.subscriptionView(OWNER)).toMatchObject({ access: 'full', comped: true, subscribed: false });
    await s.setComped(OWNER, false, '');
    expect(await v.subscriptionView(OWNER)).toMatchObject({ access: 'readonly', comped: false });
  });

  it('en retard de paiement : abonné, accès complet', async () => {
    await settings.setBillingEnforced(true);
    await subscribe(`status, ever_subscribed, plan|'past_due', true, 'mensuel'`);
    expect(await v.subscriptionView(OWNER)).toMatchObject({ access: 'full', subscribed: true, statusLabel: 'Paiement en retard' });
  });

  it('mode test selon la clé Stripe', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    expect((await v.subscriptionView(OWNER)).testMode).toBe(true);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_123');
    expect((await v.subscriptionView(OWNER)).testMode).toBe(false);
  });
});
