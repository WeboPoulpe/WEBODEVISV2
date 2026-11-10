import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Actions d'abonnement sur le vrai schéma en mémoire ; Stripe et la session sont simulés.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000a2';
const STAFF = '00000000-0000-4000-8000-0000000000a3';
const DEMO = '0d3e0000-0000-4000-8000-000000000001';
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

let sessionUser = { id: OWNER, email: 'titulaire@traiteur.fr', actingAsAdmin: false };
vi.mock('./session', () => ({ requireUser: async () => sessionUser }));

const customersCreate = vi.fn();
const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();
const subRetrieve = vi.fn();
const subList = vi.fn();
const subUpdate = vi.fn();
const portalCreate = vi.fn();
vi.mock('@/lib/stripe', () => ({
  stripe: () => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate, retrieve: sessionsRetrieve } },
    subscriptions: { retrieve: subRetrieve, list: subList, update: subUpdate },
    billingPortal: { sessions: { create: portalCreate } },
  }),
  priceFor: (p: string) => (p === 'annuel' ? 'price_a' : 'price_m'),
  planOfPrice: (id: string) => (id === 'price_m' ? 'mensuel' : id === 'price_a' ? 'annuel' : null),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://app.test', sendMail: vi.fn() }));

const actions = await import('./billingActions');
const access = await import('./subscription');
const settings = await import('./settings');

const PERIOD_END = Math.floor(Date.parse('2026-12-17T09:00:00Z') / 1000);
const stripeSub = (cancel = false, price = 'price_m') => ({
  id: 'sub_1', created: 1000, object: 'subscription', customer: 'cus_1', status: 'active', cancel_at_period_end: cancel,
  billing_cycle_anchor: 1000, metadata: { company_id: OWNER },
  items: { object: 'list', data: [{ id: 'si_1', current_period_end: PERIOD_END, price: { id: price } }] },
});
const row = async () => (await pg.query<Record<string, unknown>>(`select * from company_subscriptions where company_id = '${OWNER}'`)).rows[0];

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'titulaire@traiteur.fr', 'x'), ('${OTHER}', 'autre@traiteur.fr', 'x'), ('${STAFF}', 'staff@traiteur.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'titulaire@traiteur.fr', 'Traiteur A'), ('${OTHER}', 'autre@traiteur.fr', 'Traiteur B');
    insert into profiles (id, email, company_name, parent_user_id) values ('${STAFF}', 'staff@traiteur.fr', 'Traiteur A', '${OWNER}');
  `);
});
beforeEach(async () => {
  await pg.exec(`delete from company_subscriptions; delete from app_settings where key = 'billing_enforced';`);
  await settings.setBillingEnforced(true); // abonnement obligatoire : l'accès dépend vraiment de la ligne
  access.clearAccessCache();
  sessionUser = { id: OWNER, email: 'titulaire@traiteur.fr', actingAsAdmin: false };
  for (const m of [customersCreate, sessionsCreate, sessionsRetrieve, subRetrieve, subList, subUpdate, portalCreate]) m.mockReset();
  customersCreate.mockResolvedValue({ id: 'cus_1' });
  sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/s' });
  subList.mockResolvedValue({ object: 'list', data: [], has_more: false });
});

async function makeActive(price = 'price_m') {
  await pg.exec(`insert into company_subscriptions (company_id, stripe_customer_id, stripe_subscription_id, status, plan)
    values ('${OWNER}', 'cus_1', 'sub_1', 'active', '${price === 'price_a' ? 'annuel' : 'mensuel'}')`);
  subRetrieve.mockResolvedValue(stripeSub(false, price));
  subUpdate.mockResolvedValue({});
}

describe('startCheckout', () => {
  it('crée un seul client par entreprise sur deux appels, avec la taxe automatique', async () => {
    const a = await actions.startCheckout('mensuel');
    const b = await actions.startCheckout('annuel');
    expect(a).toEqual({ error: null, url: 'https://checkout.stripe.test/s' });
    expect(b.error).toBeNull();
    expect(customersCreate).toHaveBeenCalledTimes(1);
    expect(customersCreate.mock.calls[0][0]).toMatchObject({ email: 'titulaire@traiteur.fr', name: 'Traiteur A', metadata: { company_id: OWNER } });
    expect((await row()).stripe_customer_id).toBe('cus_1');
    expect((await row()).status).toBe('none');
    const params = sessionsCreate.mock.calls[0][0];
    expect(params.automatic_tax.enabled).toBe(true);
    expect(params).toMatchObject({
      mode: 'subscription', client_reference_id: OWNER, customer: 'cus_1', billing_address_collection: 'required',
      subscription_data: { metadata: { company_id: OWNER } }, cancel_url: 'https://app.test/abonnement',
    });
    expect(params.success_url).toBe('https://app.test/?abonnement=ok&session_id={CHECKOUT_SESSION_ID}');
    expect(sessionsCreate.mock.calls[1][0].line_items[0].price).toBe('price_a');
  });

  it('renvoie un abonné actif vers la page', async () => {
    await makeActive();
    expect(await actions.startCheckout('annuel')).toEqual({ error: null, url: '/parametres/abonnement' });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('refuse un collaborateur, un administrateur chez un client et la démo', async () => {
    sessionUser = { id: STAFF, email: 's@x.fr', actingAsAdmin: false };
    expect((await actions.startCheckout('mensuel')).error).toBeTruthy();
    sessionUser = { id: OWNER, email: 'x@x.fr', actingAsAdmin: true };
    expect((await actions.cancelSubscription()).error).toContain('compte d’un client');
    sessionUser = { id: DEMO, email: 'demo@webodevis.fr', actingAsAdmin: false };
    expect((await actions.openBillingPortal()).error).toBeTruthy();
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(customersCreate).not.toHaveBeenCalled();
  });
});

describe('syncCheckoutSession', () => {
  it('refuse la session d’une autre entreprise', async () => {
    sessionsRetrieve.mockResolvedValue({ client_reference_id: OTHER, status: 'complete', payment_status: 'paid', subscription: 'sub_1' });
    expect((await actions.syncCheckoutSession('cs_1')).error).toBeTruthy();
    expect(subRetrieve).not.toHaveBeenCalled();
  });

  it('session payée : accès complet sans webhook', async () => {
    await actions.startCheckout('mensuel');
    sessionsRetrieve.mockResolvedValue({ client_reference_id: OWNER, status: 'complete', payment_status: 'paid', subscription: 'sub_1' });
    subRetrieve.mockResolvedValue(stripeSub());
    expect(await actions.syncCheckoutSession('cs_1')).toEqual({ error: null });
    expect((await row()).status).toBe('active');
    expect(await access.accessOf(OWNER)).toBe('full');
  });

  it('session non payée : rien n’est appliqué', async () => {
    sessionsRetrieve.mockResolvedValue({ client_reference_id: OWNER, status: 'open', payment_status: 'unpaid', subscription: null });
    expect(await actions.syncCheckoutSession('cs_1')).toEqual({ error: null });
    expect(subRetrieve).not.toHaveBeenCalled();
  });
});

describe('gestion de l’abonnement', () => {
  it('annule puis reprend : Stripe reçoit true puis false', async () => {
    await makeActive();
    await actions.cancelSubscription();
    await actions.resumeSubscription();
    expect(subUpdate.mock.calls[0]).toEqual(['sub_1', { cancel_at_period_end: true }]);
    expect(subUpdate.mock.calls[1]).toEqual(['sub_1', { cancel_at_period_end: false }]);
  });

  it('passe en annuel avec prorata, et refuse si déjà annuel ou sans abonnement', async () => {
    expect((await actions.switchToAnnual()).error).toBeTruthy();
    await makeActive();
    expect(await actions.switchToAnnual()).toEqual({ error: null });
    expect(subUpdate).toHaveBeenCalledWith('sub_1', { items: [{ id: 'si_1', price: 'price_a' }], proration_behavior: 'create_prorations' });
    await pg.exec(`update company_subscriptions set plan = 'annuel'`);
    subUpdate.mockClear();
    expect((await actions.switchToAnnual()).error).toBeTruthy();
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it('ouvre le portail pour le client Stripe de l’entreprise', async () => {
    await makeActive();
    portalCreate.mockResolvedValue({ url: 'https://portal.test/p' });
    expect(await actions.openBillingPortal()).toEqual({ error: null, url: 'https://portal.test/p' });
    expect(portalCreate).toHaveBeenCalledWith({ customer: 'cus_1', return_url: 'https://app.test/parametres/abonnement' });
  });
});
