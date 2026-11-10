import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type Stripe from 'stripe';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Recopie de l'état d'un abonnement Stripe, sur le vrai schéma en mémoire. Stripe n'est jamais appelé : `stripe()` est
// simulé et renvoie l'abonnement préparé par chaque test.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000a1';
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const retrieve = vi.fn();
vi.mock('@/lib/stripe', () => ({
  stripe: () => ({ subscriptions: { retrieve } }),
  planOfPrice: (id: string) => (id === 'price_m' ? 'mensuel' : id === 'price_a' ? 'annuel' : null),
}));

const sendMail = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/mail', () => ({
  sendMail: (...args: unknown[]) => sendMail(...(args as [])),
  appOrigin: async () => 'https://app.test',
}));

const sync = await import('./stripeSync');
const access = await import('./subscription');
const settings = await import('./settings');

// 17 novembre 2026, 10 h à Paris.
const ANCHOR = Math.floor(Date.parse('2026-11-17T09:00:00Z') / 1000);
const PERIOD_END = Math.floor(Date.parse('2026-12-17T09:00:00Z') / 1000);

function sub(over: Partial<{ status: string; cancel: boolean; company: string | null; price: string }> = {}): Stripe.Subscription {
  return {
    id: 'sub_1',
    object: 'subscription',
    customer: 'cus_1',
    status: over.status ?? 'active',
    cancel_at_period_end: over.cancel ?? false,
    billing_cycle_anchor: ANCHOR,
    metadata: over.company === null ? {} : { company_id: over.company ?? OWNER },
    items: { object: 'list', data: [{ id: 'si_1', current_period_end: PERIOD_END, price: { id: over.price ?? 'price_m' } }] },
  } as unknown as Stripe.Subscription;
}

let n = 0;
function event(type: string, object: unknown, created = 1000): Stripe.Event {
  n += 1;
  return { id: `evt_${n}`, object: 'event', type, created, data: { object } } as unknown as Stripe.Event;
}

async function row() {
  const r = await pg.query<Record<string, unknown>>(`select * from company_subscriptions where company_id = '${OWNER}'`);
  return r.rows[0];
}
const events = async () => (await pg.query<{ id: string }>('select id from stripe_events')).rows.map((r) => r.id);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'titulaire@traiteur.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'titulaire@traiteur.fr', 'Traiteur A');
  `);
});
beforeEach(async () => {
  await pg.exec(`delete from company_subscriptions; delete from stripe_events; delete from app_settings where key = 'billing_enforced';`);
  access.clearAccessCache();
  retrieve.mockReset();
  sendMail.mockClear();
});

describe('applyStripeSubscription', () => {
  it("recopie l'état : statut, formule, échéance, jour d'ancrage à Paris, déjà abonné", async () => {
    retrieve.mockResolvedValue(sub());
    expect(await sync.applyStripeSubscription('sub_1')).toEqual({ companyId: OWNER });
    const r = await row();
    expect(r).toMatchObject({
      status: 'active', plan: 'mensuel', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
      cancel_at_period_end: false, anchor_day: 17, ever_subscribed: true,
    });
    expect(new Date(r.current_period_end as string).toISOString()).toBe('2026-12-17T09:00:00.000Z');
  });

  it("retrouve l'entreprise par le client Stripe quand la métadonnée manque", async () => {
    await pg.exec(`insert into company_subscriptions (company_id, stripe_customer_id) values ('${OWNER}', 'cus_1')`);
    retrieve.mockResolvedValue(sub({ company: null, price: 'price_a' }));
    expect(await sync.applyStripeSubscription('sub_1')).toEqual({ companyId: OWNER });
    expect(await row()).toMatchObject({ status: 'active', plan: 'annuel' });
  });

  it("une entreprise inconnue n'écrit rien et ne lève pas d'erreur", async () => {
    retrieve.mockResolvedValue(sub({ company: null }));
    expect(await sync.applyStripeSubscription('sub_1')).toBeNull();
    retrieve.mockResolvedValue(sub({ company: '00000000-0000-4000-8000-0000000000ff' }));
    expect(await sync.applyStripeSubscription('sub_1')).toBeNull();
    expect((await pg.query('select * from company_subscriptions')).rows).toHaveLength(0);
  });

  it('« déjà abonné » ne repasse jamais à faux', async () => {
    retrieve.mockResolvedValue(sub());
    await sync.applyStripeSubscription('sub_1');
    retrieve.mockResolvedValue(sub({ status: 'canceled' }));
    await sync.applyStripeSubscription('sub_1');
    expect(await row()).toMatchObject({ status: 'canceled', ever_subscribed: true });
  });

  it("un abonnement jamais payé (incomplete) ne compte pas comme « déjà abonné »", async () => {
    retrieve.mockResolvedValue(sub({ status: 'incomplete' }));
    await sync.applyStripeSubscription('sub_1');
    expect(await row()).toMatchObject({ status: 'incomplete', ever_subscribed: false });
  });
});

describe('handleStripeEvent', () => {
  it("un événement rejoué n'applique rien deux fois", async () => {
    retrieve.mockResolvedValue(sub());
    const e = event('customer.subscription.updated', sub());
    await sync.handleStripeEvent(e);
    await sync.handleStripeEvent(e);
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(await events()).toEqual([e.id]);
  });

  it("un vieil événement arrivé après un plus récent ne remplace pas l'état", async () => {
    retrieve.mockResolvedValueOnce(sub({ cancel: true }));
    await sync.handleStripeEvent(event('customer.subscription.updated', sub(), 200));
    retrieve.mockResolvedValueOnce(sub({ cancel: false, price: 'price_a' }));
    await sync.handleStripeEvent(event('customer.subscription.updated', sub(), 100));
    const r = await row();
    expect(r).toMatchObject({ cancel_at_period_end: true, plan: 'mensuel' });
    expect(new Date(r.last_event_at as string).getTime()).toBe(200_000);
  });

  it('deleted → canceled, et l’accès devient « readonly »', async () => {
    await settings.setBillingEnforced(true);
    retrieve.mockResolvedValueOnce(sub());
    await sync.handleStripeEvent(event('customer.subscription.created', sub(), 100));
    expect(await access.accessOf(OWNER)).toBe('full');
    retrieve.mockResolvedValueOnce(sub({ status: 'canceled' }));
    await sync.handleStripeEvent(event('customer.subscription.deleted', sub({ status: 'canceled' }), 300));
    expect(await row()).toMatchObject({ status: 'canceled' });
    expect(await access.accessOf(OWNER)).toBe('readonly'); // le cache « full » a été vidé
  });

  it('checkout terminé : le client Stripe est lié à l’entreprise, puis l’abonnement appliqué', async () => {
    retrieve.mockResolvedValue(sub({ company: null }));
    await sync.handleStripeEvent(event('checkout.session.completed', {
      id: 'cs_1', object: 'checkout.session', mode: 'subscription', client_reference_id: OWNER, customer: 'cus_1', subscription: 'sub_1',
    }));
    expect(retrieve).toHaveBeenCalledWith('sub_1');
    expect(await row()).toMatchObject({ stripe_customer_id: 'cus_1', status: 'active', plan: 'mensuel' });
  });

  it('facture payée : l’abonnement est relu (nouveau champ parent, ou ancien champ subscription)', async () => {
    retrieve.mockResolvedValue(sub());
    await sync.handleStripeEvent(event('invoice.paid', { id: 'in_1', object: 'invoice', parent: { subscription_details: { subscription: 'sub_1' } } }));
    await sync.handleStripeEvent(event('invoice.payment_action_required', { id: 'in_2', object: 'invoice', subscription: 'sub_1' }));
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(retrieve).toHaveBeenCalledWith('sub_1');
    expect(await row()).toMatchObject({ status: 'active' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('paiement échoué : un e-mail part au titulaire', async () => {
    retrieve.mockResolvedValue(sub({ status: 'past_due' }));
    await sync.handleStripeEvent(event('invoice.payment_failed', { id: 'in_1', object: 'invoice', parent: { subscription_details: { subscription: 'sub_1' } } }));
    expect(await row()).toMatchObject({ status: 'past_due' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = (sendMail.mock.calls[0] as unknown as [{ to: string; subject: string; html: string }])[0];
    expect(mail.to).toBe('titulaire@traiteur.fr');
    expect(mail.html).toContain('https://app.test/parametres/abonnement');
  });

  it('les événements sans effet sont seulement enregistrés', async () => {
    const e = event('charge.refunded', { id: 'ch_1', object: 'charge' });
    await sync.handleStripeEvent(e);
    expect(retrieve).not.toHaveBeenCalled();
    expect(await events()).toEqual([e.id]);
  });

  it("une erreur dans le traitement retire l'événement, pour que Stripe réessaie", async () => {
    retrieve.mockRejectedValueOnce(new Error('Stripe injoignable'));
    const e = event('customer.subscription.updated', sub());
    await expect(sync.handleStripeEvent(e)).rejects.toThrow('Stripe injoignable');
    expect(await events()).toEqual([]);
    retrieve.mockResolvedValueOnce(sub());
    await sync.handleStripeEvent(e);
    expect(await row()).toMatchObject({ status: 'active' });
  });
});
