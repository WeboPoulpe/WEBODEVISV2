// Historique : les écritures de la couche /api/db sont notées automatiquement, sur le vrai schéma en mémoire.
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { QueryDescriptor } from '@/lib/compat/builder';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

vi.mock('server-only', () => ({}));
vi.mock('../subscriptionGuard', () => ({ SUBSCRIPTION_REQUIRED_MESSAGE: 'abonnement', subscriptionAllowsWrite: async () => true }));
let pg: PGlite;
vi.mock('@/db', () => {
  const query = async (sql: string, values?: unknown[]) => {
    const r = await pg.query(sql, values);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  return { pool: { query, connect: async () => ({ query, release: () => {} }) } };
});

const { executeQuery } = await import('./execute');

const ME = '00000000-0000-4000-8000-0000000c0001';
const OTHER = '00000000-0000-4000-8000-0000000c0002';
const QUOTE = '00000000-0000-4000-8000-0000000c00d1';
const LINE = '00000000-0000-4000-8000-0000000c00e1';
const SERVICE = '00000000-0000-4000-8000-0000000c00f1';
const OTHER_CUSTOMER = '00000000-0000-4000-8000-0000000c00b2';

const run = (d: Partial<QueryDescriptor> & Pick<QueryDescriptor, 'table' | 'op'>, ctx: { uid: string; actingAsAdmin?: boolean } = { uid: ME }) =>
  executeQuery({ filters: [], order: [], returning: true, select: '*', ...d } as QueryDescriptor, ctx);
type Row = { action: string; entity_type: string; entity_id: string | null; summary: string; via_admin: boolean; company_id: string };
const rows = async () => (await pg.query<Row>(`select * from activity_log order by created_at, summary`)).rows;
const customer = (first: string, last: string, owner = ME) => ({ customer_type: 'particulier', email: `${first.toLowerCase()}@t.fr`, first_name: first, last_name: last, owner_user_id: owner });

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'me@t.fr', 'x'), ('${OTHER}', 'o@t.fr', 'x'), ('${DEMO_USER_ID}', 'demo@t.fr', 'x');
    insert into profiles (id, email, first_name, last_name) values ('${ME}', 'me@t.fr', 'Julien', 'Martin'), ('${OTHER}', 'o@t.fr', null, null), ('${DEMO_USER_ID}', 'demo@t.fr', null, null);
    insert into quotes (id, owner_user_id, client_name, event_date, event_type, guest_count, quote_number, name, status)
      values ('${QUOTE}', '${ME}', 'Dupont', '2027-06-12', 'mariage', 80, 'D-2026-042', 'Mariage Dupont', 'nouveau');
    insert into services (id, owner_user_id, name, price) values ('${SERVICE}', '${ME}', 'Cocktail', 10);
    insert into quote_services (id, quote_id, service_id, quantity, unit_price) values ('${LINE}', '${QUOTE}', '${SERVICE}', 1, 10);
    insert into customers (id, customer_type, email, first_name, last_name, owner_user_id) values ('${OTHER_CUSTOMER}', 'particulier', 'x@t.fr', 'Autre', 'Client', '${OTHER}');
  `);
});

beforeEach(async () => {
  await pg.exec(`alter table activity_log disable trigger user; delete from activity_log; alter table activity_log enable trigger user;`);
});

it('créer un client écrit « Client Julie Martin créé »', async () => {
  const r = await run({ table: 'customers', op: 'insert', values: customer('Julie', 'Martin') });
  expect(r.error).toBeNull();
  expect(await rows()).toMatchObject([{ action: 'creation', entity_type: 'client', summary: 'Client Julie Martin créé', company_id: ME, via_admin: false }]);
});

it('modifier une ligne de devis note une modification du devis parent', async () => {
  await run({ table: 'quote_services', op: 'update', values: { quantity: 3 }, filters: [{ column: 'id', op: 'eq', value: LINE }] as QueryDescriptor['filters'] });
  expect(await rows()).toMatchObject([{ action: 'modification', entity_type: 'devis', entity_id: QUOTE, summary: 'Devis D-2026-042 — Mariage Dupont modifié' }]);
});

it('supprimer un client écrit une suppression avec le libellé d’avant', async () => {
  const created = await run({ table: 'customers', op: 'insert', values: customer('Paul', 'Durand'), single: 'single' });
  const id = (created.data as { id: string }).id;
  await run({ table: 'customers', op: 'delete', filters: [{ column: 'id', op: 'eq', value: id }] as QueryDescriptor['filters'] });
  expect((await rows()).map((r) => r.summary)).toContain('Client Paul Durand supprimé');
});

it('importer 30 clients d’un coup écrit une seule ligne', async () => {
  const many = Array.from({ length: 30 }, (_, i) => customer(`Prenom${i}`, `Nom${i}`));
  expect((await run({ table: 'customers', op: 'insert', values: many })).error).toBeNull();
  expect(await rows()).toMatchObject([{ summary: '30 clients créés', entity_id: null }]);
});

it('une écriture refusée n’écrit rien', async () => {
  await run({ table: 'customers', op: 'update', values: { first_name: 'Pris' }, filters: [{ column: 'id', op: 'eq', value: OTHER_CUSTOMER }] as QueryDescriptor['filters'] });
  expect(await rows()).toEqual([]);
});

it('un compte de démo n’écrit rien', async () => {
  await run({ table: 'customers', op: 'insert', values: customer('Demo', 'Demo', DEMO_USER_ID) }, { uid: DEMO_USER_ID });
  expect(await rows()).toEqual([]);
});

it('un administrateur entré dans le compte est signalé', async () => {
  await run({ table: 'customers', op: 'insert', values: customer('Admin', 'Test') }, { uid: ME, actingAsAdmin: true });
  expect(await rows()).toMatchObject([{ via_admin: true }]);
});

it('si l’historique échoue, l’écriture a quand même lieu', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  await pg.exec(`alter function public.log_activity(uuid, uuid, boolean, text, text, uuid, text, text, jsonb) rename to log_activity_off`);
  try {
    const r = await run({ table: 'customers', op: 'insert', values: customer('Panne', 'Base'), single: 'single' });
    expect(r.error).toBeNull();
    expect((await pg.query(`select 1 from customers where first_name = 'Panne'`)).rows).toHaveLength(1);
  } finally {
    await pg.exec(`alter function public.log_activity_off(uuid, uuid, boolean, text, text, uuid, text, text, jsonb) rename to log_activity`);
    spy.mockRestore();
  }
});

it('une table non suivie n’écrit rien', async () => {
  await run({ table: 'notifications', op: 'insert', values: { user_id: ME, title: 't', message: 'm', type: 'info' } });
  expect(await rows()).toEqual([]);
});

it('un import en lots de 100 (comme l’import de clients) ne fait qu’une ligne', async () => {
  const many = (n: number, from: number) => Array.from({ length: n }, (_, i) => customer(`Lot${from + i}`, `Nom${from + i}`));
  await run({ table: 'customers', op: 'insert', values: many(100, 0) });
  await run({ table: 'customers', op: 'insert', values: many(100, 100) });
  await run({ table: 'customers', op: 'insert', values: many(15, 200) });
  const r = await rows();
  expect(r).toHaveLength(1);
  expect((r[0] as unknown as { details: { n: number } }).details.n).toBe(215);
});

it('les lignes complètes ne repartent pas vers le serveur pour une modification', async () => {
  const spy = vi.spyOn(pg, 'query');
  await run({ table: 'quote_services', op: 'update', values: { quantity: 4 }, filters: [{ column: 'id', op: 'eq', value: LINE }] as QueryDescriptor['filters'] });
  const sqls = spy.mock.calls.map((c) => String(c[0]));
  spy.mockRestore();
  expect(sqls.some((q) => q.includes('row_to_json(t0)) from m t0'))).toBe(false);
});

it('le repère interne des lignes écrites ne part pas vers le navigateur', async () => {
  const r = await run({ table: 'customers', op: 'insert', values: customer('Repere', 'Test'), single: 'single' });
  expect(r.data).not.toHaveProperty('activity_ctid');
  const u = await run({ table: 'quote_services', op: 'update', values: { quantity: 5 }, filters: [{ column: 'id', op: 'eq', value: LINE }] as QueryDescriptor['filters'] });
  expect((u.data as object[])[0]).not.toHaveProperty('activity_ctid');
});

it('ni pour un compte de démo', async () => {
  const r = await run({ table: 'customers', op: 'insert', values: customer('Demo', 'Repere', DEMO_USER_ID), single: 'single' }, { uid: DEMO_USER_ID });
  expect(r.data).not.toHaveProperty('activity_ctid');
});
