import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Webo, factures et brochures : émettre une facture (irréversible, annoncé), enregistrer un paiement, envoyer une
// brochure — par les fonctions du logiciel, après validation, dans l'entreprise seulement.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000c01';
const OTHER = '00000000-0000-4000-8000-000000000c02';
const DRAFT = '00000000-0000-4000-8000-000000000c11';
const ISSUED = '00000000-0000-4000-8000-000000000c12';
const THEIRS = '00000000-0000-4000-8000-000000000c13';
const BROCHURE = '00000000-0000-4000-8000-000000000c21';
const OFF = '00000000-0000-4000-8000-000000000c22';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
const calls: { fn: string; args: unknown[] }[] = [];
vi.mock('../invoices', () => ({
  createInvoiceDraft: async () => ({ error: null, id: 'x' }),
  issueInvoice: async (...args: unknown[]) => { calls.push({ fn: 'issue', args }); return { error: null, number: 'F-2026-0007' }; },
  recordPayment: async (...args: unknown[]) => { calls.push({ fn: 'pay', args }); return { error: null }; },
}));
vi.mock('../brochures', () => ({ sendBrochure: async (...args: unknown[]) => { calls.push({ fn: 'brochure', args }); return { error: null }; } }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');
const { decideProposal } = await import('./execute');
let conv = '';
const call = async (name: string, input: unknown) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, name, input));

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@f.fr', 'x'), ('${OTHER}', 'o@f.fr', 'x');
    insert into profiles (id, email) values ('${CHEF}', 'c@f.fr'), ('${OTHER}', 'o@f.fr');
    insert into customer_invoices (id, owner_user_id, created_by, kind, status, number, seller, buyer, lines, total_ht, total_vat, total_ttc) values
      ('${DRAFT}', '${CHEF}', '${CHEF}', 'acompte', 'brouillon', null, '{}', '{"name":"Famille Lenoir"}', '[]', 1000, 100, 1100),
      ('${ISSUED}', '${CHEF}', '${CHEF}', 'solde', 'emise', 'F-2026-0003', '{}', '{"name":"Famille Lenoir"}', '[]', 2000, 200, 2200),
      ('${THEIRS}', '${OTHER}', '${OTHER}', 'facture', 'brouillon', null, '{}', '{"name":"Autre"}', '[]', 10, 1, 11);
    insert into brochures (id, owner_user_id, user_id, name, share_token, is_active) values
      ('${BROCHURE}', '${CHEF}', '${CHEF}', 'Mariages 2027', 'tok-b1', true), ('${OFF}', '${CHEF}', '${CHEF}', 'Ancienne', 'tok-b2', false);
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);
beforeEach(() => { calls.length = 0; });

describe('Webo : factures', () => {
  it('outils des spécialistes Factures et Prospects', () => {
    expect(toolsFor('factures').map((t) => t.name)).toEqual(expect.arrayContaining(['list_invoices', 'propose_invoice_issue', 'propose_invoice_payment']));
    expect(toolsFor('prospects').map((t) => t.name)).toEqual(expect.arrayContaining(['list_brochures', 'propose_brochure_send']));
  });

  it('liste des factures de l’entreprise, avec ce qui reste à payer', async () => {
    const r = await call('list_invoices', { quote_id: null, status: null });
    expect(r.results.map((x: { id: string }) => x.id).sort()).toEqual([DRAFT, ISSUED].sort());
  });

  it('émettre : seulement un brouillon de l’entreprise ; la carte dit que c’est définitif ; appelé une fois', async () => {
    expect((await call('propose_invoice_issue', { invoice_id: ISSUED })).error).toBeTruthy();
    expect((await call('propose_invoice_issue', { invoice_id: THEIRS })).error).toBeTruthy();
    const r = await call('propose_invoice_issue', { invoice_id: DRAFT });
    expect(JSON.stringify(r.summary)).toMatch(/définiti/i);
    const res = await decideProposal(r.proposal_id, 'accept');
    expect(res.error).toBeNull();
    expect(res.result?.label).toContain('F-2026-0007');
    await decideProposal(r.proposal_id, 'accept');
    expect(calls).toEqual([{ fn: 'issue', args: [DRAFT] }]);
  });

  it('paiement : sur une facture émise, montant positif, moyen connu', async () => {
    expect((await call('propose_invoice_payment', { invoice_id: DRAFT, amount: 100, paid_on: '2026-10-20', method: 'virement', note: null })).error).toBeTruthy();
    expect((await call('propose_invoice_payment', { invoice_id: ISSUED, amount: -5, paid_on: '2026-10-20', method: 'virement', note: null })).error).toBeTruthy();
    const r = await call('propose_invoice_payment', { invoice_id: ISSUED, amount: 500, paid_on: '2026-10-20', method: 'cheque', note: 'Chèque n° 123' });
    await decideProposal(r.proposal_id, 'accept');
    expect(calls).toEqual([{ fn: 'pay', args: [ISSUED, { paidOn: '2026-10-20', amount: 500, method: 'cheque', note: 'Chèque n° 123' }] }]);
  });
});

describe('Webo : brochures', () => {
  it('envoyer une brochure active ; brochure inactive refusée ; adresse invalide refusée', async () => {
    expect((await call('list_brochures', {})).results.map((b: { name: string }) => b.name)).toContain('Mariages 2027');
    expect((await call('propose_brochure_send', { brochure_id: OFF, to: 'a@b.fr', message: null, prospect_id: null })).error).toBeTruthy();
    expect((await call('propose_brochure_send', { brochure_id: BROCHURE, to: 'pas-une-adresse', message: null, prospect_id: null })).error).toBeTruthy();
    const r = await call('propose_brochure_send', { brochure_id: BROCHURE, to: 'lea@r.fr', message: 'Voici notre brochure.', prospect_id: null });
    await decideProposal(r.proposal_id, 'accept');
    expect(calls).toEqual([{ fn: 'brochure', args: [{ brochureId: BROCHURE, to: 'lea@r.fr', message: 'Voici notre brochure.' }] }]);
  });
});
