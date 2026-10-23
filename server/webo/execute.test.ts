import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Valider une proposition de Webo : une seule exécution, par du code déterministe, avec les droits du traiteur.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000201';
const READER = '00000000-0000-4000-8000-000000000202';
const OTHER = '00000000-0000-4000-8000-000000000203';
const MENU = '00000000-0000-4000-8000-000000000211';
const PROSPECT = '00000000-0000-4000-8000-000000000221';
let current = CHEF;
vi.mock('../session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => {
    if (current === READER) throw new Error('Votre accès est en consultation seule');
    return { id: current, email: 'x@y.fr' };
  },
}));
const sent: { to: string; subject: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string; subject: string }) => { sent.push(m); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool } = await import('./tools');
const { decideProposal } = await import('./execute');

let conv = '';
const propose = async (name: string, input: unknown, company = CHEF) => {
  const out = JSON.parse(await runTool({ userId: company, companyId: company, conversationId: conv, proposals: [] }, name, input));
  if (!out.proposal_id) throw new Error(JSON.stringify(out));
  return out.proposal_id as string;
};
const quoteInput = { customer_id: null, new_customer: { first_name: 'Paul', last_name: 'Martin', email: 'paul@m.fr', phone: null }, client_name: '', event_type: 'Mariage', event_date: '2027-06-12', guest_count: 40, event_location: 'Troyes', remarks: null, lines: [{ prestation_id: MENU, name: 'Menu Tentation', quantity: null, unit_price: null }] };
const count = async (table: string) => Number((await pg.query<{ n: string }>(`select count(*) n from ${table}`)).rows[0].n);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@e.fr', 'x'), ('${READER}', 'r@e.fr', 'x'), ('${OTHER}', 'o@e.fr', 'x');
    insert into profiles (id, email, company_name, company_email, default_vat_rate) values ('${CHEF}', 'c@e.fr', 'Traiteur Exécution', 'contact@e.fr', 10), ('${OTHER}', 'o@e.fr', 'Autre', null, 20);
    insert into profiles (id, email, parent_user_id, company_role) values ('${READER}', 'r@e.fr', '${CHEF}', 'lecture');
    insert into prestations (id, user_id, name, unit_price, category) values ('${MENU}', '${CHEF}', 'Menu Tentation', 76, 'dîner');
    insert into prospect_requests (id, owner_user_id, first_name, last_name, email, event_type) values ('${PROSPECT}', '${CHEF}', 'Léa', 'Roux', 'lea@r.fr', 'Mariage');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);
beforeEach(() => { current = CHEF; sent.length = 0; });

describe('valider une proposition', () => {
  it('devis : client créé, devis « à faire » avec lignes et total, lien vers WeboWord', async () => {
    const id = await propose('propose_quote', quoteInput);
    const r = await decideProposal(id, 'accept');
    expect(r.error).toBeNull();
    expect(r.result?.href).toMatch(/^\/devis\/[0-9a-f-]{36}\/modifier\?mode=weboword$/);
    const [q] = (await pg.query<{ status: string; client_name: string; guest_count: number; total_amount: string; services: { name: string; quantity: number }[]; customer_id: string; quote_number: string | null }>(
      `select status, client_name, guest_count, total_amount, services, customer_id, quote_number from quotes`)).rows;
    expect(q).toMatchObject({ status: 'devis_a_faire', client_name: 'Paul Martin', guest_count: 40 });
    expect(q.services[0]).toMatchObject({ name: 'Menu Tentation', quantity: 40 });
    expect(Number(q.total_amount)).toBeCloseTo(40 * 76 * 1.1, 2);
    expect(q.customer_id).toBeTruthy();
    expect(await count('customers')).toBe(1);
  });

  it('validée deux fois : un seul devis', async () => {
    const before = await count('quotes');
    const id = await propose('propose_quote', { ...quoteInput, new_customer: { ...quoteInput.new_customer, email: 'paul@m.fr' } });
    const [a, b] = await Promise.all([decideProposal(id, 'accept'), decideProposal(id, 'accept')]);
    expect([a.error, b.error].filter(Boolean)).toHaveLength(1);
    expect(await count('quotes')).toBe(before + 1);
    // Même email : le client existant est repris.
    expect(await count('customers')).toBe(1);
  });

  it('annulée : rien n’est créé, et elle ne se valide plus', async () => {
    const before = await count('quotes');
    const id = await propose('propose_quote', quoteInput);
    expect((await decideProposal(id, 'cancel')).error).toBeNull();
    expect((await decideProposal(id, 'accept')).error).toBeTruthy();
    expect(await count('quotes')).toBe(before);
  });

  it('autre entreprise ou lecture seule : refusé', async () => {
    const id = await propose('propose_prestation', { name: 'Brunch', unit_price: 38, category: null, description: null });
    current = OTHER;
    expect((await decideProposal(id, 'accept')).error).toBeTruthy();
    current = READER;
    await expect(decideProposal(id, 'accept')).rejects.toThrow();
    current = CHEF;
    expect(await count(`prestations where name = 'Brunch'`)).toBe(0);
  });

  it('prestation créée, puis prix changé', async () => {
    expect((await decideProposal(await propose('propose_prestation', { name: 'Brunch', unit_price: 38, category: 'brunch', description: 'Viennoiseries et œufs brouillés' }), 'accept')).error).toBeNull();
    const [p] = (await pg.query<{ id: string; unit_price: string; description: string }>(`select id, unit_price, description from prestations where name = 'Brunch'`)).rows;
    expect(Number(p.unit_price)).toBe(38);
    expect(p.description).toContain('<p>Viennoiseries');
    expect((await decideProposal(await propose('propose_prestation_update', { prestation_id: p.id, unit_price: 42, description: null }), 'accept')).error).toBeNull();
    expect(Number((await pg.query<{ unit_price: string }>(`select unit_price from prestations where id = $1`, [p.id])).rows[0].unit_price)).toBe(42);
  });

  it('facture : brouillon d’acompte créé depuis le devis', async () => {
    const [q] = (await pg.query<{ id: string }>(`select id from quotes limit 1`)).rows;
    const r = await decideProposal(await propose('propose_invoice', { quote_id: q.id, kind: 'acompte', percent: 30 }), 'accept');
    expect(r.error).toBeNull();
    const [inv] = (await pg.query<{ kind: string; status: string }>(`select kind, status from customer_invoices`)).rows;
    expect(inv).toMatchObject({ kind: 'acompte', status: 'brouillon' });
  });

  it('réponse prospect : un email au prospect, une seule fois', async () => {
    const id = await propose('propose_prospect_reply', { prospect_id: PROSPECT, subject: 'Votre mariage', body: 'Bonjour Léa,\nAvec plaisir.' });
    await decideProposal(id, 'accept');
    await decideProposal(id, 'accept');
    expect(sent).toEqual([expect.objectContaining({ to: 'lea@r.fr', subject: 'Votre mariage' })]);
  });
});
