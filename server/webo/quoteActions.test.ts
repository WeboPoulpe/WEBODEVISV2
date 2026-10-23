import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Webo et un devis existant : le modifier, l'envoyer, retrouver ceux à relancer. Toujours après validation.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000601';
const OTHER = '00000000-0000-4000-8000-000000000602';
const MENU = '00000000-0000-4000-8000-000000000611';
const TROU = '00000000-0000-4000-8000-000000000612';
const Q = '00000000-0000-4000-8000-000000000621';
const SENT_OLD = '00000000-0000-4000-8000-000000000622';
const SENT_NEW = '00000000-0000-4000-8000-000000000623';
const PAID = '00000000-0000-4000-8000-000000000624';
const THEIRS = '00000000-0000-4000-8000-000000000625';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
const sends: { quoteId: string; to: string; message: string }[] = [];
vi.mock('../quotes', () => ({ sendQuoteToClient: async (i: { quoteId: string; to: string; message: string }) => { sends.push(i); return { error: null }; } }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool } = await import('./tools');
const { decideProposal } = await import('./execute');
let conv = '';
const call = async (name: string, input: unknown) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, name, input));
const update = (over: Record<string, unknown> = {}) => ({ quote_id: Q, guest_count: null, event_date: null, event_location: null, add_lines: [], remove_lines: [], ...over });

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@q.fr', 'x'), ('${OTHER}', 'o@q.fr', 'x');
    insert into profiles (id, email, default_vat_rate) values ('${CHEF}', 'c@q.fr', 10), ('${OTHER}', 'o@q.fr', 20);
    insert into prestations (id, user_id, name, unit_price, category) values ('${MENU}', '${CHEF}', 'Menu Tentation', 76, 'dîner'), ('${TROU}', '${CHEF}', 'Trou normand', 4, 'dîner');
    insert into quotes (id, owner_user_id, user_id, client_name, client_email, event_date, event_type, guest_count, status, vat_rate, sent_at, services) values
      ('${Q}', '${CHEF}', '${CHEF}', 'Famille Lenoir', 'lenoir@l.fr', '2027-05-01', 'Mariage', 80, 'devis_a_faire', 10, null, '[{"id":"l1","name":"Menu Tentation","quantity":80,"unitPrice":76},{"id":"l2","name":"Forfait service","quantity":1,"unitPrice":400}]'),
      ('${SENT_OLD}', '${CHEF}', '${CHEF}', 'Ancien Envoi', 'a@a.fr', '2027-06-01', 'Gala', 40, 'devis_envoye', 10, now() - interval '10 days', '[]'),
      ('${SENT_NEW}', '${CHEF}', '${CHEF}', 'Envoi Récent', 'r@r.fr', '2027-06-02', 'Gala', 40, 'devis_envoye', 10, now() - interval '2 days', '[]'),
      ('${PAID}', '${CHEF}', '${CHEF}', 'Déjà Payé', 'p@p.fr', '2027-06-03', 'Gala', 40, 'paye', 10, now() - interval '30 days', '[]'),
      ('${THEIRS}', '${OTHER}', '${OTHER}', 'Autre Entreprise', 'z@z.fr', '2027-06-04', 'Gala', 40, 'devis_envoye', 20, now() - interval '30 days', '[]');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);
beforeEach(() => { sends.length = 0; });

describe('modifier un devis', () => {
  it('couverts, date, ligne ajoutée (catalogue) et retirée : appliqué à la validation, total recalculé', async () => {
    const r = await call('propose_quote_update', update({ guest_count: 100, event_date: '2027-05-08', add_lines: [{ prestation_id: null, name: 'Trou normand', quantity: null, unit_price: null }], remove_lines: ['forfait service'] }));
    expect(r.proposal_id).toBeTruthy();
    expect(JSON.stringify(r.summary)).toMatch(/80 → 100/);
    const [before] = (await pg.query<{ guest_count: number }>(`select guest_count from quotes where id = $1`, [Q])).rows;
    expect(before.guest_count).toBe(80);
    const res = await decideProposal(r.proposal_id, 'accept');
    expect(res.error).toBeNull();
    const [q] = (await pg.query<{ guest_count: number; event_date: string; total_amount: string; services: { name: string; quantity: number }[] }>(
      `select guest_count, to_char(event_date, 'YYYY-MM-DD') event_date, total_amount, services from quotes where id = $1`, [Q])).rows;
    expect(q.guest_count).toBe(100);
    expect(q.event_date).toBe('2027-05-08');
    expect(q.services.map((s) => [s.name, s.quantity])).toEqual([['Menu Tentation', 100], ['Trou normand', 100]]);
    // (100 × 76 + 100 × 4) × 1,10 = 8 800 €
    expect(Number(q.total_amount)).toBeCloseTo(8800, 2);
  });

  it('ligne à retirer inconnue, devis payé, devis d’une autre entreprise : refusés', async () => {
    expect((await call('propose_quote_update', update({ remove_lines: ['Champagne'] }))).error).toBeTruthy();
    expect((await call('propose_quote_update', update({ quote_id: PAID, guest_count: 50 }))).error).toBeTruthy();
    expect((await call('propose_quote_update', update({ quote_id: THEIRS, guest_count: 50 }))).error).toBeTruthy();
  });

  it('devis validé entre-temps : la validation est refusée, rien ne change', async () => {
    const r = await call('propose_quote_update', update({ guest_count: 120 }));
    await pg.exec(`begin; select set_config('app.user_id', '${CHEF}', true); update quotes set status = 'valide' where id = '${Q}'; commit;`);
    expect((await decideProposal(r.proposal_id, 'accept')).error).toBeTruthy();
    expect((await pg.query<{ guest_count: number }>(`select guest_count from quotes where id = $1`, [Q])).rows[0].guest_count).toBe(100);
    await pg.exec(`begin; select set_config('app.user_id', '${CHEF}', true); update quotes set status = 'devis_a_faire' where id = '${Q}'; commit;`);
  });
});

describe('envoyer et relancer', () => {
  it('envoi proposé puis validé : un seul envoi, au destinataire et avec le message', async () => {
    const r = await call('propose_quote_send', { quote_id: Q, to: 'lenoir@l.fr', message: 'Bonjour, voici votre devis.' });
    expect(sends).toHaveLength(0);
    await decideProposal(r.proposal_id, 'accept');
    await decideProposal(r.proposal_id, 'accept');
    expect(sends).toEqual([{ quoteId: Q, to: 'lenoir@l.fr', message: 'Bonjour, voici votre devis.' }]);
  });

  it('adresse invalide ou devis d’une autre entreprise : refusés', async () => {
    expect((await call('propose_quote_send', { quote_id: Q, to: 'pas-une-adresse', message: 'x' })).error).toBeTruthy();
    expect((await call('propose_quote_send', { quote_id: THEIRS, to: 'z@z.fr', message: 'x' })).error).toBeTruthy();
  });

  it('devis à relancer : envoyés depuis plus de N jours, de l’entreprise seulement', async () => {
    const r = await call('stale_quotes', { days: 7 });
    expect(r.results.map((q: { client: string }) => q.client)).toEqual(['Ancien Envoi']);
  });
});
