// Devis à plusieurs formules, sur le vrai schéma (baseline + migrations) en mémoire : le client choisit sa formule
// en signant, le traiteur peut la retenir pour lui, et les factures ne portent que sur elle.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7', 'user-agent': 'Test' }) }));
const sent: { to: string; subject: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string; subject: string }) => { sent.push({ to: m.to, subject: m.subject }); return { error: null }; },
}));
const OWNER = '00000000-0000-4000-8000-0000000000f1';
const STRANGER = '00000000-0000-4000-8000-0000000000f2';
let current = OWNER;
vi.mock('./session', () => ({
  getSessionUser: async () => null,
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));

let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const { acceptQuote, acceptanceState } = await import('./acceptance');
const { chooseQuoteFormula } = await import('./quoteFormulas');
const inv = await import('./invoices');

const TOKEN = 'jeton-devis-a-formules-1234';
const TOKEN_PHONE = 'jeton-devis-formule-telephone';
const SIGNATURE = `data:image/png;base64,${'iVBORw0KGgo'.repeat(30)}`;
const FORMULAS = [{ id: 'prestige', name: 'Formule Prestige' }, { id: 'tradition', name: 'Formule Tradition' }];
// 50 couverts, TVA 10 % : commune 500 € HT ; Prestige 50 × 60 € ; Tradition 50 × 40 €.
const SERVICES = [
  { id: 'c', name: 'Service en salle', quantity: 1, unitPrice: 500 },
  { id: 'p', name: 'Menu Prestige', quantity: 50, unitPrice: 60, formula: 'prestige' },
  { id: 't', name: 'Menu Tradition', quantity: 50, unitPrice: 40, formula: 'tradition' },
];
let quoteId = '';
let phoneQuoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x'), ('${STRANGER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'chef@t.fr', 'Traiteur Test'), ('${STRANGER}', 'autre@t.fr', 'Autre');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, client_email, event_date, event_type, guest_count, status, vat_rate, services, formulas, share_token, valid_until)
    values ($1, $1, 'Dupont', 'client@t.fr', '2026-12-12', 'mariage', 50, 'devis_envoye', 10, $2::jsonb, $3::jsonb, $4, '2099-01-01'),
           ($1, $1, 'Martin', null, '2026-12-12', 'mariage', 50, 'devis_envoye', 10, $2::jsonb, $3::jsonb, $5, '2099-01-01')
    returning id`, [OWNER, JSON.stringify(SERVICES), JSON.stringify(FORMULAS), TOKEN, TOKEN_PHONE]);
  [quoteId, phoneQuoteId] = rows.map((r) => r.id);
});

const sign = (formulaId?: string | null, token = TOKEN) =>
  acceptQuote({ token, signerName: 'Jean Dupont', signature: SIGNATURE, acceptTerms: true, formulaId });
const quoteRow = async (id: string) => (await pg.query<{ status: string; chosen_formula_id: string | null; total_amount: string | null }>(
  `select status, chosen_formula_id, total_amount from quotes where id = $1`, [id])).rows[0];

describe('formules au choix : acceptation en ligne', () => {
  it('la page du client présente chaque formule avec son total', async () => {
    const state = (await acceptanceState(TOKEN))!;
    expect(state.canAccept).toBe(true);
    expect(state.chosenFormulaId).toBeNull();
    expect(state.formulas.map((f) => [f.id, f.totalTTC])).toEqual([['prestige', 3850], ['tradition', 2750]]);
  });

  it('refuse une signature sans formule, ou avec une formule qui n’est pas dans le devis', async () => {
    expect((await sign(null)).error).toMatch(/Choisissez/);
    expect((await sign('inventee')).error).toMatch(/Choisissez/);
    expect((await quoteRow(quoteId)).status).toBe('devis_envoye');
    expect((await pg.query(`select 1 from quote_acceptances where quote_id = $1`, [quoteId])).rows).toHaveLength(0);
  });

  it('enregistre la formule choisie avec l’accord, dans l’empreinte, et le devis prend son total', async () => {
    expect((await sign('tradition')).error).toBeNull();
    expect(await quoteRow(quoteId)).toMatchObject({ status: 'valide', chosen_formula_id: 'tradition', total_amount: '2750.00' });
    const { rows } = await pg.query<{ formula_id: string; formula_name: string; total_ttc: string; content_hash: string; invalidated_at: string | null }>(
      `select formula_id, formula_name, total_ttc, content_hash, invalidated_at from quote_acceptances where quote_id = $1`, [quoteId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ formula_id: 'tradition', formula_name: 'Formule Tradition', total_ttc: '2750.00', invalidated_at: null });
    expect(rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    const state = (await acceptanceState(TOKEN))!;
    expect(state.acceptance).toMatchObject({ signerName: 'Jean Dupont', formulaName: 'Formule Tradition' });
    expect(state.chosenFormulaId).toBe('tradition');
    const msg = await pg.query<{ message: string }>(`select message from notifications where user_id = $1 and type = 'quote_accepted'`, [OWNER]);
    expect(msg.rows[0].message).toMatch(/Formule Tradition/);
  });

  it('la facture d’acompte est calculée sur la formule choisie seulement', async () => {
    current = OWNER;
    const summary = (await inv.quoteBillingSummary(quoteId))!;
    expect(summary.totalTTC).toBe(2750);
    const draft = await inv.createInvoiceDraft({ quoteId, kind: 'acompte', percent: 30 });
    expect(draft.error).toBeNull();
    const d = (await inv.getInvoice((draft as { id: string }).id))!;
    expect(d.total_ttc).toBe(825);
    const full = await inv.createInvoiceDraft({ quoteId, kind: 'facture' });
    const f = (await inv.getInvoice((full as { id: string }).id))!;
    expect(f.lines.map((l) => l.label)).toEqual(['Service en salle', 'Menu Tradition']);
  });

  it('changer ensuite la formule retenue rend l’accord caduc', async () => {
    expect((await chooseQuoteFormula(quoteId, 'prestige')).error).toBeNull();
    expect(await quoteRow(quoteId)).toMatchObject({ chosen_formula_id: 'prestige', total_amount: '3850.00' });
    expect((await acceptanceState(TOKEN))!.acceptance).toBeNull();
    expect((await pg.query(`select 1 from quote_acceptances where quote_id = $1 and invalidated_at is not null`, [quoteId])).rows).toHaveLength(1);
  });
});

describe('formules au choix : retenue par le traiteur', () => {
  it('pas de facture tant qu’aucune formule n’est retenue', async () => {
    current = OWNER;
    expect((await inv.createInvoiceDraft({ quoteId: phoneQuoteId, kind: 'acompte' })).error).toMatch(/formule/);
  });

  it('seul le traiteur du devis retient une formule, et seulement une formule du devis', async () => {
    current = STRANGER;
    expect((await chooseQuoteFormula(phoneQuoteId, 'prestige')).error).toMatch(/introuvable/);
    current = OWNER;
    expect((await chooseQuoteFormula(phoneQuoteId, 'inventee')).error).toMatch(/n’existe pas/);
    expect((await quoteRow(phoneQuoteId)).chosen_formula_id).toBeNull();
  });

  it('accord par téléphone : la formule retenue fixe le total, le client signe pour elle', async () => {
    current = OWNER;
    expect(await chooseQuoteFormula(phoneQuoteId, 'prestige')).toEqual({ error: null, totalTTC: 3850 });
    expect((await quoteRow(phoneQuoteId)).total_amount).toBe('3850.00');
    expect((await acceptanceState(TOKEN_PHONE))!.chosenFormulaId).toBe('prestige');
    // Le client ne peut pas signer pour une autre formule que celle retenue par le traiteur.
    expect((await sign('tradition', TOKEN_PHONE)).error).toMatch(/déjà été retenue/);
    expect((await sign(null, TOKEN_PHONE)).error).toBeNull();
    const { rows } = await pg.query<{ formula_id: string }>(`select formula_id from quote_acceptances where quote_id = $1`, [phoneQuoteId]);
    expect(rows[0].formula_id).toBe('prestige');
  });
});
