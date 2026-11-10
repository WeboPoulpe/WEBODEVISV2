// Purge d'un compte sur le vrai schéma en mémoire : toutes ses données partent, celles des autres restent.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const subCancel = vi.fn();
const subList = vi.fn();
vi.mock('@/lib/stripe', () => ({ stripe: () => ({ subscriptions: { cancel: subCancel, list: subList } }) }));

const { purgeAccount } = await import('./accountPurge');

const A = '00000000-0000-4000-8000-00000000aaaa';   // compte supprimé
const B = '00000000-0000-4000-8000-00000000bbbb';   // autre traiteur
const M = '00000000-0000-4000-8000-00000000cccc';   // collaborateur rattaché à A
const GLOBAL_ING = '00000000-0000-4000-8000-000000000g01'.replace('g', '0');

async function seed(owner: string, tag: string) {
  const one = async <T = { id: string }>(q: string, v: unknown[] = []) => (await pg.query<T>(q, v)).rows[0];
  const customer = await one(`insert into customers (owner_user_id, customer_type, first_name, last_name, email) values ($1, 'particulier', 'Jean', $2, 'c@t.fr') returning id`, [owner, `Client ${tag}`]);
  const quote = await one(`insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, vat_rate, services, customer_id)
    values ($1, $1, $2, '2026-12-12', 'mariage', 10, 'devis_envoye', 10, '[{"name":"Menu","quantity":10,"unitPrice":40}]', $3) returning id`, [owner, `Devis ${tag}`, customer.id]);
  await pg.query(`select set_config('app.user_id', $1, false)`, [owner]);
  await pg.query(`update quotes set status = 'valide' where id = $1`, [quote.id]); // historique de statut
  const presta = await one(`insert into prestations (name, user_id) values ('Menu', $1) returning id`, [owner]);
  const ing = await one(`insert into ingredients (name, user_id) values ('Beurre', $1) returning id`, [owner]);
  await pg.query(`insert into service_ingredients (user_id, service_id, ingredient_id) values ($1, $2, $3), ($1, $2, $4)`, [owner, presta.id, ing.id, GLOBAL_ING]);
  const extra = await one(`insert into extras (user_id, name) values ($1, 'Léa Martin') returning id`, [owner]);
  await pg.query(`insert into event_extras (quote_id, extra_id) values ($1, $2)`, [quote.id, extra.id]);
  const supplier = await one(`insert into suppliers (owner_user_id, user_id, name) values ($1, $1, 'Primeur') returning id`, [owner]);
  const order = await one(`insert into supplier_orders (user_id, supplier_id) values ($1, $2) returning id`, [owner, supplier.id]);
  await pg.query(`insert into supplier_order_items (order_id, ingredient_id, quantity) values ($1, $2, 3)`, [order.id, ing.id]);
  await pg.query(`insert into stock_movements (user_id, ingredient_id, movement_type, quantity, event_id) values ($1, $2, 'in', 5, $3)`, [owner, ing.id, quote.id]);
  await pg.query(`insert into notifications (user_id, title, message, type) values ($1, 't', 'm', 'stock_alert')`, [owner]);
  await pg.query(`insert into quote_acceptances (quote_id, signer_name, signature, content_hash) values ($1, 'X', 'data:image/png;base64,AA', 'h')`, [quote.id]);
  const inv = await one(`insert into customer_invoices (owner_user_id, created_by, quote_id, kind, seller, buyer, lines) values ($1, $1, $2, 'facture', '{}', '{}', '[]') returning id`, [owner, quote.id]);
  await pg.query(`update customer_invoices set status = 'emise', number = $2 where id = $1`, [inv.id, `F-${tag}`]);
  await pg.query(`insert into customer_invoice_payments (invoice_id, paid_on, amount, created_by) values ($1, '2026-10-20', 10, $2)`, [inv.id, owner]);
  await pg.query(`select public.next_document_number($1, 'invoice')`, [owner]);
}

const count = async (where: string) => {
  const { rows } = await pg.query<{ t: string; c: string }>(`
    select table_name as t, column_name as c from information_schema.columns
    where table_schema = 'public' and data_type = 'uuid' and column_name in ('user_id', 'owner_user_id', 'created_by')`);
  let n = 0;
  for (const r of rows) n += Number((await pg.query<{ n: number }>(`select count(*)::int as n from public."${r.t}" where "${r.c}" = ${where}`)).rows[0].n);
  return n;
};

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${B}', 'b@t.fr', 'x'), ('${M}', 'm@t.fr', 'x');
    insert into profiles (id, email) values ('${A}', 'a@t.fr'), ('${B}', 'b@t.fr');
    insert into profiles (id, email, parent_user_id) values ('${M}', 'm@t.fr', '${A}');
    insert into ingredients (id, name, user_id) values ('${GLOBAL_ING}', 'Farine', null);
  `);
  await seed(A, 'A');
  await seed(B, 'B');
});

describe('purge d’un compte', () => {
  it('efface toutes les données du compte, factures émises comprises', async () => {
    expect(await count(`'${A}'`)).toBeGreaterThan(10);
    await purgeAccount(A);
    expect(await count(`'${A}'`)).toBe(0);
    expect((await pg.query(`select 1 from users where id = $1`, [A])).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from quotes where client_name = 'Devis A'`)).rows).toHaveLength(0);
    expect((await pg.query(`select 1 from customer_invoices where number = 'F-A'`)).rows).toHaveLength(0);
  });

  it('ne touche pas aux autres comptes ni aux données communes', async () => {
    expect((await pg.query(`select 1 from quotes where client_name = 'Devis B'`)).rows).toHaveLength(1);
    expect((await pg.query(`select 1 from customer_invoices where number = 'F-B'`)).rows).toHaveLength(1);
    expect((await pg.query(`select 1 from customer_invoice_payments`)).rows).toHaveLength(1);
    expect((await pg.query(`select 1 from service_ingredients where user_id = $1`, [B])).rows).toHaveLength(2);
    expect((await pg.query(`select 1 from ingredients where id = $1`, [GLOBAL_ING])).rows).toHaveLength(1);
    // Le collaborateur reste, simplement détaché.
    expect((await pg.query<{ parent_user_id: string | null }>(`select parent_user_id from profiles where id = $1`, [M])).rows[0]).toEqual({ parent_user_id: null });
  });

  it('la protection des factures émises reste entière hors purge', async () => {
    await expect(pg.query(`delete from customer_invoices where number = 'F-B'`)).rejects.toThrow(/supprimée/);
  });
});

describe('purge et abonnement Stripe', () => {
  const C = '00000000-0000-4000-8000-00000000dddd';
  const D = '00000000-0000-4000-8000-00000000eeee';
  beforeAll(async () => {
    await pg.exec(`
      insert into users (id, email, password_hash) values ('${C}', 'c@t.fr', 'x'), ('${D}', 'd@t.fr', 'x');
      insert into profiles (id, email) values ('${C}', 'c@t.fr'), ('${D}', 'd@t.fr');
      insert into company_subscriptions (company_id, stripe_customer_id, stripe_subscription_id, status) values ('${C}', 'cus_c', 'sub_c', 'active'), ('${D}', 'cus_d', 'sub_d', 'canceled');
    `);
  });
  beforeEach(() => {
    subCancel.mockReset();
    subList.mockReset();
    subList.mockResolvedValue({ data: [] });
  });

  it('si Stripe est en panne, rien n’est effacé et l’erreur remonte', async () => {
    subList.mockResolvedValue({ data: [{ id: 'sub_c', status: 'active' }] });
    subCancel.mockRejectedValueOnce(new Error('stripe en panne'));
    await expect(purgeAccount(C)).rejects.toThrow(/stripe en panne/);
    expect((await pg.query(`select 1 from users where id = $1`, [C])).rows).toHaveLength(1);
    expect((await pg.query(`select 1 from company_subscriptions where company_id = $1`, [C])).rows).toHaveLength(1);
  });

  it('résilie tout de suite chez Stripe puis efface', async () => {
    subList.mockResolvedValue({ data: [{ id: 'sub_c', status: 'active' }, { id: 'sub_c2', status: 'past_due' }, { id: 'sub_old', status: 'canceled' }] });
    subCancel.mockResolvedValue({});
    await purgeAccount(C);
    expect(subList).toHaveBeenCalledWith({ customer: 'cus_c', status: 'all', limit: 10 });
    expect(subCancel.mock.calls.map((c) => c[0])).toEqual(['sub_c', 'sub_c2']);
    expect((await pg.query(`select 1 from users where id = $1`, [C])).rows).toHaveLength(0);
  });

  it('une purge rejouée passe : abonnement déjà résilié chez Stripe alors que la ligne dit active', async () => {
    const E = '00000000-0000-4000-8000-00000000ffff';
    await pg.exec(`
      insert into users (id, email, password_hash) values ('${E}', 'e@t.fr', 'x');
      insert into profiles (id, email) values ('${E}', 'e@t.fr');
      insert into company_subscriptions (company_id, stripe_customer_id, stripe_subscription_id, status) values ('${E}', 'cus_e', 'sub_e', 'active');
    `);
    subList.mockResolvedValue({ data: [{ id: 'sub_e', status: 'canceled' }] });
    await purgeAccount(E);
    expect(subCancel).not.toHaveBeenCalled();
    expect((await pg.query(`select 1 from users where id = $1`, [E])).rows).toHaveLength(0);
  });

  it('une erreur « introuvable » ou « déjà résilié » à la résiliation compte comme un succès', async () => {
    const F = '00000000-0000-4000-8000-00000000f0f0';
    await pg.exec(`
      insert into users (id, email, password_hash) values ('${F}', 'f@t.fr', 'x');
      insert into profiles (id, email) values ('${F}', 'f@t.fr');
      insert into company_subscriptions (company_id, stripe_customer_id, stripe_subscription_id, status) values ('${F}', 'cus_f', 'sub_f', 'active');
    `);
    subList.mockResolvedValue({ data: [{ id: 'sub_f1', status: 'active' }, { id: 'sub_f2', status: 'active' }] });
    subCancel.mockRejectedValueOnce(Object.assign(new Error('No such subscription'), { code: 'resource_missing' }))
      .mockRejectedValueOnce(new Error('This subscription is already canceled'));
    await purgeAccount(F);
    expect(subCancel).toHaveBeenCalledTimes(2);
    expect((await pg.query(`select 1 from users where id = $1`, [F])).rows).toHaveLength(0);
  });

  it('n’appelle pas Stripe pour un abonnement déjà terminé', async () => {
    await purgeAccount(D);
    expect(subCancel).not.toHaveBeenCalled();
    expect((await pg.query(`select 1 from users where id = $1`, [D])).rows).toHaveLength(0);
  });
});
