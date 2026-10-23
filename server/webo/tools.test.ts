import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Outils de Webo : lectures limitées à l'entreprise, propositions vérifiées (rien d'écrit hors webo_proposals).

vi.mock('server-only', () => ({}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');

const CHEF = '00000000-0000-4000-8000-000000000101';
const OTHER = '00000000-0000-4000-8000-000000000102';
const MENU = '00000000-0000-4000-8000-000000000111';
const FORFAIT = '00000000-0000-4000-8000-000000000112';
const FOREIGN = '00000000-0000-4000-8000-000000000113';
const CLIENT = '00000000-0000-4000-8000-000000000121';
let conv = '';
const ctx = () => ({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] as string[] });
const call = async (name: string, input: unknown) => JSON.parse(await runTool(ctx(), name, input));

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@w.fr', 'x'), ('${OTHER}', 'o@w.fr', 'x');
    insert into profiles (id, email, company_name, default_vat_rate) values ('${CHEF}', 'c@w.fr', 'Traiteur', 10), ('${OTHER}', 'o@w.fr', 'Autre', 20);
    insert into prestations (id, user_id, name, unit_price, category) values
      ('${MENU}', '${CHEF}', 'Menu Tentation', 76, 'dîner'),
      ('${FORFAIT}', '${CHEF}', 'Forfait service', 400, 'personnel'),
      ('${FOREIGN}', '${OTHER}', 'Menu Secret', 90, 'dîner');
    insert into customers (id, owner_user_id, user_id, customer_type, first_name, last_name, email) values
      ('${CLIENT}', '${CHEF}', '${CHEF}', 'particulier', 'Claire', 'Dupont', 'claire@d.fr');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);

const quoteInput = (lines: unknown[]) => ({
  customer_id: CLIENT, new_customer: null, client_name: 'Claire Dupont', event_type: 'Mariage', event_date: '2027-06-12',
  guest_count: 50, event_location: null, remarks: null, lines,
});

describe('outils de Webo', () => {
  it('chaque spécialiste a ses outils ; l’aide n’en a pas', () => {
    expect(toolsFor('devis').map((t) => t.name)).toContain('propose_quote');
    expect(toolsFor('factures').map((t) => t.name)).toEqual(expect.arrayContaining(['find_quotes', 'propose_invoice']));
    expect(toolsFor('aide')).toEqual([]);
  });

  it('chaque spécialiste : des outils tous définis, sans doublon de nom', () => {
    for (const agent of ['devis', 'factures', 'catalogue', 'prospects', 'clients', 'stock', 'evenements', 'journee'] as const) {
      const names = toolsFor(agent).map((t) => t?.name);
      expect(names.every(Boolean), agent).toBe(true);
      expect(new Set(names).size, agent).toBe(names.length);
    }
  });

  it('recherche dans le catalogue : seulement l’entreprise', async () => {
    const r = await call('search_catalogue', { query: 'Menu' });
    expect(r.results.map((p: { name: string }) => p.name)).toEqual(['Menu Tentation']);
  });

  it('proposer un devis : prix du catalogue, quantité = couverts pour une prestation par couvert, total TTC', async () => {
    const r = await call('propose_quote', quoteInput([
      { prestation_id: MENU, name: 'Menu Tentation', quantity: null, unit_price: 1 },
      { prestation_id: FORFAIT, name: 'Forfait service', quantity: null, unit_price: null },
      { prestation_id: null, name: 'Location de vaisselle', quantity: null, unit_price: null },
    ]));
    expect(r.proposal_id).toBeTruthy();
    const [row] = (await pg.query<{ payload: { lines: { name: string; quantity: number; unitPrice: number }[] }; summary: { total: string } }>(
      `select payload, summary from webo_proposals where id = $1`, [r.proposal_id])).rows;
    expect(row.payload.lines.map((l) => [l.name, l.quantity, l.unitPrice])).toEqual([
      ['Menu Tentation', 50, 76], ['Forfait service', 1, 400], ['Location de vaisselle', 1, 0],
    ]);
    // (50 × 76 + 400) HT = 4 200 € ; TVA 10 % → 4 620 € TTC.
    expect(row.summary.total).toMatch(/4\s?620,00/);
    expect(Number((await pg.query<{ n: string }>(`select count(*) n from quotes`)).rows[0].n)).toBe(0);
  });

  it('prestation ou client d’une autre entreprise : refusés', async () => {
    expect((await call('propose_quote', quoteInput([{ prestation_id: FOREIGN, name: 'Menu Secret', quantity: null, unit_price: null }]))).error).toBeTruthy();
    expect((await call('propose_quote', { ...quoteInput([]), customer_id: OTHER })).error).toBeTruthy();
  });

  it('identifiant invalide (tirets seuls) : erreur rendue au modèle, pas d’exception', async () => {
    expect((await call('get_quote', { quote_id: '------------------------------------' })).error).toBeTruthy();
  });

  it('outils : types facultatifs en anyOf (forme documentée), jamais en liste de types', () => {
    for (const a of ['devis', 'factures', 'catalogue', 'prospects'] as const) expect(JSON.stringify(toolsFor(a))).not.toContain('"type":["');
  });

  it('remarques et téléphone du nouveau client visibles sur la carte', async () => {
    const r = await call('propose_quote', { ...quoteInput([]), customer_id: null, new_customer: { first_name: 'Paul', last_name: 'Roy', email: 'paul@r.fr', phone: '0601020304' }, remarks: 'Allergie aux noix' });
    expect(JSON.stringify(r.summary)).toContain('Allergie aux noix');
    expect(JSON.stringify(r.summary)).toContain('0601020304');
  });

  it('ligne sans identifiant mais au nom exact d’une prestation : reprise du catalogue (prix du catalogue)', async () => {
    const r = await call('propose_quote', quoteInput([{ prestation_id: null, name: 'menu tentation', quantity: null, unit_price: 99 }]));
    const [row] = (await pg.query<{ payload: { lines: { name: string; quantity: number; unitPrice: number }[] } }>(`select payload from webo_proposals where id = $1`, [r.proposal_id])).rows;
    expect(row.payload.lines[0]).toMatchObject({ name: 'Menu Tentation', quantity: 50, unitPrice: 76 });
  });

  it('devis passés : recherche aussi par type d’événement', async () => {
    await pg.exec(`insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services) values ('${CHEF}', '${CHEF}', 'Martin', '2025-07-05', 'Mariage', 90, 'paye', '[]')`);
    const r = await call('find_quotes', { query: 'mariage' });
    expect(r.results.map((q: { client: string }) => q.client)).toContain('Martin');
  });

  it('date ou couverts invalides : refusés', async () => {
    expect((await call('propose_quote', { ...quoteInput([]), event_date: '12/06/2027' })).error).toBeTruthy();
    expect((await call('propose_quote', { ...quoteInput([]), guest_count: 0 })).error).toBeTruthy();
    expect((await call('propose_quote', { ...quoteInput([]), event_date: '2027-02-30' })).error).toBeTruthy();
  });

  it('proposer une mise à jour de prix : ancien et nouveau prix au résumé', async () => {
    const r = await call('propose_prestation_update', { prestation_id: MENU, unit_price: 80, description: null });
    const [row] = (await pg.query<{ summary: { fields: { label: string; value: string }[] } }>(`select summary from webo_proposals where id = $1`, [r.proposal_id])).rows;
    expect(JSON.stringify(row.summary)).toMatch(/76,00.*80,00/);
  });
});
