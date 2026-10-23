import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Webo, clients et prospects : fiches proposées puis écrites à la validation, notes ajoutées (jamais écrasées),
// doublons refusés clairement, prospect transformé en devis une seule fois.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000a01';
const OTHER = '00000000-0000-4000-8000-000000000a02';
const CLAIRE = '00000000-0000-4000-8000-000000000a11';
const FOREIGN = '00000000-0000-4000-8000-000000000a12';
const LEA = '00000000-0000-4000-8000-000000000a21';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');
const { decideProposal } = await import('./execute');
let conv = '';
const call = async (name: string, input: unknown) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, name, input));
const customer = (over: Record<string, unknown> = {}) => ({
  customer_id: null, type: 'particulier', first_name: 'Paul', last_name: 'Martin', company_name: null, contact_person_name: null,
  email: 'paul@martin.fr', phone: '0601020304', address: null, siret: null, note: null, ...over,
});

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@c.fr', 'x'), ('${OTHER}', 'o@c.fr', 'x');
    insert into profiles (id, email, default_vat_rate) values ('${CHEF}', 'c@c.fr', 10), ('${OTHER}', 'o@c.fr', 20);
    insert into customers (id, owner_user_id, user_id, customer_type, first_name, last_name, email, notes) values
      ('${CLAIRE}', '${CHEF}', '${CHEF}', 'particulier', 'Claire', 'Dupont', 'claire@d.fr', 'Aime le champagne'),
      ('${FOREIGN}', '${OTHER}', '${OTHER}', 'particulier', 'Secret', 'Ailleurs', 's@a.fr', null);
    insert into prospect_requests (id, owner_user_id, first_name, last_name, email, event_type, event_date, guest_count, message) values
      ('${LEA}', '${CHEF}', 'Léa', 'Roux', 'lea@r.fr', 'Mariage', '2027-07-10', 90, 'Cocktail et dîner');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);

describe('Webo : clients', () => {
  it('spécialiste Clients : ses outils', () => {
    expect(toolsFor('clients').map((t) => t.name)).toEqual(expect.arrayContaining(['search_customers', 'get_customer', 'propose_customer', 'list_prospects', 'propose_prospect_status', 'propose_prospect_to_quote']));
  });

  it('fiche d’un client de l’entreprise seulement', async () => {
    expect((await call('get_customer', { customer_id: CLAIRE })).notes).toBe('Aime le champagne');
    expect((await call('get_customer', { customer_id: FOREIGN })).error).toBeTruthy();
  });

  it('nouveau client : créé à la validation ; entreprise sans contact refusée ; email en double refusé', async () => {
    expect((await call('propose_customer', customer({ type: 'entreprise', company_name: 'Renault', contact_person_name: null }))).error).toBeTruthy();
    expect((await call('propose_customer', customer({ email: 'claire@d.fr' }))).error).toMatch(/existe/i);
    const r = await call('propose_customer', customer());
    expect((await pg.query(`select 1 from customers where email = 'paul@martin.fr'`)).rows).toHaveLength(0);
    expect((await decideProposal(r.proposal_id, 'accept')).error).toBeNull();
    expect((await pg.query(`select 1 from customers where email = 'paul@martin.fr' and owner_user_id = $1`, [CHEF])).rows).toHaveLength(1);
  });

  it('modifier un client : téléphone changé, note ajoutée à la suite (pas écrasée) ; client d’ailleurs refusé', async () => {
    expect((await call('propose_customer', customer({ customer_id: FOREIGN }))).error).toBeTruthy();
    const r = await call('propose_customer', { ...customer({ customer_id: CLAIRE, first_name: null, last_name: null, email: null, phone: '0700000000', note: 'Allergie aux noix' }) });
    expect(r.error).toBeUndefined();
    expect((await decideProposal(r.proposal_id, 'accept')).error).toBeNull();
    const [c] = (await pg.query<{ phone: string; notes: string; first_name: string }>(`select phone, notes, first_name from customers where id = $1`, [CLAIRE])).rows;
    expect(c.phone).toBe('0700000000');
    expect(c.first_name).toBe('Claire');
    expect(c.notes).toContain('Aime le champagne');
    expect(c.notes).toContain('Allergie aux noix');
  });
});

describe('Webo : revérifications à la validation', () => {
  it('email pris entre la proposition et la validation : refus clair, pas de doublon', async () => {
    const r = await call('propose_customer', customer({ email: 'nouveau@client.fr', first_name: 'Nouveau', last_name: 'Client' }));
    await pg.exec(`insert into users (id, email, password_hash) values ('00000000-0000-4000-8000-000000000a03', 'm@c.fr', 'x');
      insert into profiles (id, email, parent_user_id) values ('00000000-0000-4000-8000-000000000a03', 'm@c.fr', '${CHEF}');
      insert into customers (owner_user_id, user_id, customer_type, first_name, last_name, email) values ('00000000-0000-4000-8000-000000000a03', '00000000-0000-4000-8000-000000000a03', 'particulier', 'Déjà', 'Là', 'nouveau@client.fr');`);
    const res = await decideProposal(r.proposal_id, 'accept');
    expect(res.error).toMatch(/existe déjà/);
    expect((await pg.query(`select 1 from customers where email = 'nouveau@client.fr'`)).rows).toHaveLength(1);
  });

  it('deux cartes pour transformer le même prospect, validées en même temps : un seul devis', async () => {
    const P2 = '00000000-0000-4000-8000-000000000a22';
    await pg.exec(`insert into prospect_requests (id, owner_user_id, first_name, last_name, email, event_type, event_date, guest_count) values ('${P2}', '${CHEF}', 'Tom', 'Bas', 'tom@b.fr', 'Gala', '2027-09-01', 40)`);
    const a = await call('propose_prospect_to_quote', { prospect_id: P2 });
    const b = await call('propose_prospect_to_quote', { prospect_id: P2 });
    const res = await Promise.all([decideProposal(a.proposal_id, 'accept'), decideProposal(b.proposal_id, 'accept')]);
    expect(res.filter((x) => x.error)).toHaveLength(1);
    expect((await pg.query(`select 1 from quotes where prospect_id = $1`, [P2])).rows).toHaveLength(1);
  });

  it('statut d’un prospect : un devis confirmé (validé, acompte, payé) ne redescend pas', async () => {
    const P3 = '00000000-0000-4000-8000-000000000a23';
    await pg.exec(`insert into prospect_requests (id, owner_user_id, first_name, last_name, email, status) values ('${P3}', '${CHEF}', 'Ana', 'Paye', 'ana@p.fr', 'paye');
      insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, prospect_id) values ('${CHEF}', '${CHEF}', 'Ana Paye', '2027-05-05', 'Gala', 30, 'paye', '[]', '${P3}');`);
    expect((await call('propose_prospect_status', { prospect_id: P3, status: 'nouveau' })).error).toMatch(/confirm/i);
  });
});

describe('Webo : prospects', () => {
  it('statut changé à la validation ; statut inconnu refusé', async () => {
    expect((await call('propose_prospect_status', { prospect_id: LEA, status: 'gagne' })).error).toBeTruthy();
    const r = await call('propose_prospect_status', { prospect_id: LEA, status: 'rdv_deg_a_venir' });
    await decideProposal(r.proposal_id, 'accept');
    expect((await pg.query<{ status: string }>(`select status from prospect_requests where id = $1`, [LEA])).rows[0].status).toBe('rdv_deg_a_venir');
  });

  it('prospect transformé en devis : client créé, devis « à faire » lié, une seule fois', async () => {
    const r = await call('propose_prospect_to_quote', { prospect_id: LEA });
    const [a, b] = await Promise.all([decideProposal(r.proposal_id, 'accept'), decideProposal(r.proposal_id, 'accept')]);
    expect([a.error, b.error].filter(Boolean)).toHaveLength(1);
    const quotes = (await pg.query<{ status: string; guest_count: number; client_name: string; prospect_id: string }>(`select status, guest_count, client_name, prospect_id from quotes where prospect_id = $1`, [LEA])).rows;
    expect(quotes).toEqual([expect.objectContaining({ status: 'devis_a_faire', guest_count: 90, client_name: 'Léa Roux' })]);
    expect((await pg.query(`select 1 from customers where email = 'lea@r.fr'`)).rows).toHaveLength(1);
    expect((await pg.query<{ status: string }>(`select status from prospect_requests where id = $1`, [LEA])).rows[0].status).toBe('devis_a_faire');
    expect((a.result ?? b.result)?.href).toMatch(/\/devis\/.+\/modifier/);
    // Une nouvelle proposition pour le même prospect est refusée : il a déjà son devis.
    expect((await call('propose_prospect_to_quote', { prospect_id: LEA })).error).toMatch(/déjà/i);
  });
});
