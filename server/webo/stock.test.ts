import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Webo, stock et commandes fournisseurs : mouvements, commandes (brouillon, envoi, réception), besoins d'un événement.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000b01';
const OTHER = '00000000-0000-4000-8000-000000000b02';
const BEURRE = '00000000-0000-4000-8000-000000000b11';
const SECRET = '00000000-0000-4000-8000-000000000b12';
const METRO = '00000000-0000-4000-8000-000000000b21';
const AILLEURS = '00000000-0000-4000-8000-000000000b22';
const EV = '00000000-0000-4000-8000-000000000b31';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
const sends: Record<string, unknown>[] = [];
vi.mock('../supplierOrders', () => ({ sendSupplierOrder: async (i: Record<string, unknown>) => { sends.push(i); return { error: null }; } }));
const eventOrders: string[] = [];
vi.mock('../events', () => ({
  recalculateCourses: async () => ({ error: null }),
  createSupplierOrders: async (id: string) => { eventOrders.push(id); return { error: null, created: 2, withoutSupplier: [] }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');
const { decideProposal } = await import('./execute');
let conv = '';
const call = async (name: string, input: unknown) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, name, input));
const stock = async () => Number((await pg.query<{ q: string }>(`select quantity q from ingredient_stocks where company_id = $1 and ingredient_id = $2`, [CHEF, BEURRE])).rows[0]?.q ?? 0);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@s.fr', 'x'), ('${OTHER}', 'o@s.fr', 'x');
    insert into profiles (id, email) values ('${CHEF}', 'c@s.fr'), ('${OTHER}', 'o@s.fr');
    insert into ingredients (id, user_id, owner_user_id, name, unit, volume_unit_price) values
      ('${BEURRE}', '${CHEF}', '${CHEF}', 'Beurre doux', 'kg', 9), ('${SECRET}', '${OTHER}', '${OTHER}', 'Truffe', 'g', 2);
    insert into suppliers (id, owner_user_id, user_id, name, email) values
      ('${METRO}', '${CHEF}', '${CHEF}', 'Metro', 'commandes@metro.fr'), ('${AILLEURS}', '${OTHER}', '${OTHER}', 'Ailleurs', 'a@a.fr');
    insert into ingredient_stocks (company_id, ingredient_id, quantity, min_alert) values ('${CHEF}', '${BEURRE}', 3, 5);
    insert into quotes (id, owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services) values
      ('${EV}', '${CHEF}', '${CHEF}', 'Mariage Lenoir', current_date + 10, 'Mariage', 100, 'valide', '[]');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);
beforeEach(() => { sends.length = 0; eventOrders.length = 0; });

describe('Webo : stock', () => {
  it('spécialiste Stock : ses outils ; niveaux de l’entreprise, ce qui est bas', async () => {
    expect(toolsFor('stock').map((t) => t.name)).toEqual(expect.arrayContaining(['stock_levels', 'propose_stock_movement', 'list_suppliers', 'list_supplier_orders', 'propose_supplier_order', 'propose_supplier_order_send', 'propose_supplier_order_receive', 'propose_event_orders']));
    const r = await call('stock_levels', { query: null, low_only: true });
    expect(r.results).toEqual([expect.objectContaining({ name: 'Beurre doux', quantity: 3, low: true })]);
  });

  it('entrée puis sortie appliquées à la validation ; sortie au-delà du stock refusée ; ingrédient d’ailleurs refusé', async () => {
    expect((await call('propose_stock_movement', { movements: [{ ingredient_id: SECRET, type: 'in', quantity: 1, reason: null }] })).error).toBeTruthy();
    expect((await call('propose_stock_movement', { movements: [{ ingredient_id: BEURRE, type: 'out', quantity: 10, reason: null }] })).error).toMatch(/stock/i);
    const r = await call('propose_stock_movement', { movements: [{ ingredient_id: BEURRE, type: 'in', quantity: 4, reason: 'Livraison' }] });
    expect(await stock()).toBe(3);
    await decideProposal(r.proposal_id, 'accept');
    expect(await stock()).toBe(7);
    const inv = await call('propose_stock_movement', { movements: [{ ingredient_id: BEURRE, type: 'adjust', quantity: 0, reason: 'Inventaire' }] });
    await decideProposal(inv.proposal_id, 'accept');
    expect(await stock()).toBe(0);
  });
});

describe('Webo : commandes fournisseurs', () => {
  it('brouillon créé avec ses lignes ; envoi ; réception qui entre en stock, une seule fois', async () => {
    expect((await call('propose_supplier_order', { supplier_id: AILLEURS, items: [{ ingredient_id: BEURRE, quantity: 2 }], notes: null })).error).toBeTruthy();
    const r = await call('propose_supplier_order', { supplier_id: METRO, items: [{ ingredient_id: BEURRE, quantity: 5 }], notes: 'Livrer avant midi' });
    const res = await decideProposal(r.proposal_id, 'accept');
    expect(res.error).toBeNull();
    const [order] = (await pg.query<{ id: string; status: string; total_amount: string }>(`select id, status, total_amount from supplier_orders where supplier_id = $1`, [METRO])).rows;
    expect(order.status).toBe('draft');
    expect(Number(order.total_amount)).toBe(45);
    expect((await pg.query(`select 1 from supplier_order_items where order_id = $1`, [order.id])).rows).toHaveLength(1);

    const send = await call('propose_supplier_order_send', { order_id: order.id, to: null, message: 'Bonjour, voici notre commande.', delivery_date: null });
    await decideProposal(send.proposal_id, 'accept');
    expect(sends).toEqual([expect.objectContaining({ orderId: order.id, to: 'commandes@metro.fr' })]);

    const before = await stock();
    const rec = await call('propose_supplier_order_receive', { order_id: order.id });
    await decideProposal(rec.proposal_id, 'accept');
    expect(await stock()).toBe(before + 5);
    expect((await pg.query<{ status: string }>(`select status from supplier_orders where id = $1`, [order.id])).rows[0].status).toBe('received');
    expect((await call('propose_supplier_order_receive', { order_id: order.id })).error).toMatch(/reçue/i);
  });

  it('commandes depuis les besoins d’un événement', async () => {
    const r = await call('propose_event_orders', { quote_id: EV });
    await decideProposal(r.proposal_id, 'accept');
    expect(eventOrders).toEqual([EV]);
  });
});
