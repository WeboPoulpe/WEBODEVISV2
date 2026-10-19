// Acceptation du devis en ligne, sur le vrai schéma (baseline + migrations) en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'Test' }) }));
const sent: { to: string; subject: string }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string; subject: string }) => { sent.push({ to: m.to, subject: m.subject }); return { error: null }; },
}));
vi.mock('./session', () => ({ getSessionUser: async () => null }));

let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { acceptQuote, acceptanceState, recordQuoteView } = await import('./acceptance');

const OWNER = '00000000-0000-4000-8000-0000000000c1';
const TOKEN = 'jeton-public-du-devis-1234';
const EXPIRED = 'jeton-public-du-devis-expire';
const SIGNATURE = `data:image/png;base64,${'iVBORw0KGgo'.repeat(30)}`;
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${OWNER}', 'chef@t.fr', 'Traiteur Test');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, client_email, event_date, event_type, guest_count, status, vat_rate, services, share_token, valid_until)
    values ($1, $1, 'Dupont', 'client@t.fr', '2026-12-12', 'mariage', 50, 'devis_envoye', 10, '[{"id":"a","name":"Menu","quantity":50,"unitPrice":45}]', $2, '2099-01-01'),
           ($1, $1, 'Martin', null, '2026-12-12', 'cocktail', 20, 'devis_envoye', 10, '[]', $3, '2020-01-01')
    returning id`, [OWNER, TOKEN, EXPIRED]);
  quoteId = rows[0].id;
});

const status = async () => (await pg.query<{ status: string }>(`select status from quotes where id = $1`, [quoteId])).rows[0].status;

describe('acceptation en ligne', () => {
  it('propose l’acceptation sur un devis envoyé et valide', async () => {
    expect(await acceptanceState(TOKEN)).toMatchObject({ canAccept: true, expired: false, acceptance: null });
    expect(await acceptanceState('jeton-inconnu-1234567')).toBeNull();
  });

  it('demande un nom, la case cochée et une signature', async () => {
    expect((await acceptQuote({ token: TOKEN, signerName: 'J', signature: SIGNATURE, acceptTerms: true })).error).toMatch(/nom/);
    expect((await acceptQuote({ token: TOKEN, signerName: 'Jean Dupont', signature: SIGNATURE, acceptTerms: false })).error).toMatch(/case/);
    expect((await acceptQuote({ token: TOKEN, signerName: 'Jean Dupont', signature: 'data:text/html,<script>', acceptTerms: true })).error).toMatch(/Signez/);
  });

  it('enregistre l’acceptation, valide le devis, prévient le traiteur et le client', async () => {
    expect((await acceptQuote({ token: TOKEN, signerName: '  Jean   Dupont ', signature: SIGNATURE, acceptTerms: true })).error).toBeNull();
    expect(await status()).toBe('valide');
    const { rows } = await pg.query<{ signer_name: string; ip: string; content_hash: string; total_ttc: string }>(`select * from quote_acceptances where quote_id = $1`, [quoteId]);
    expect(rows[0]).toMatchObject({ signer_name: 'Jean Dupont', ip: '203.0.113.7', total_ttc: '2475.00' });
    expect(rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await pg.query(`select 1 from notifications where user_id = $1 and type = 'quote_accepted'`, [OWNER])).rows).toHaveLength(1);
    expect((await pg.query(`select 1 from quote_status_history where quote_id = $1 and new_status = 'valide'`, [quoteId])).rows).toHaveLength(1);
    expect(sent.map((m) => m.to)).toEqual(['chef@t.fr', 'client@t.fr']);
    expect(await acceptanceState(TOKEN)).toMatchObject({ canAccept: false, acceptance: { signerName: 'Jean Dupont' } });
  });

  it('n’accepte pas deux fois', async () => {
    expect((await acceptQuote({ token: TOKEN, signerName: 'Autre', signature: SIGNATURE, acceptTerms: true })).error).toMatch(/déjà accepté/);
  });

  it('une modification du devis rend l’acceptation caduque', async () => {
    await pg.query(`update quotes set remarks = 'note interne' where id = $1`, [quoteId]);
    expect((await acceptanceState(TOKEN))!.acceptance).not.toBeNull();
    await pg.query(`update quotes set services = '[{"id":"a","name":"Menu","quantity":60,"unitPrice":45}]' where id = $1`, [quoteId]);
    expect((await acceptanceState(TOKEN))!.acceptance).toBeNull();
    expect((await pg.query(`select 1 from quote_acceptances where quote_id = $1`, [quoteId])).rows).toHaveLength(1);
  });

  it('un devis expiré ne s’accepte plus', async () => {
    expect(await acceptanceState(EXPIRED)).toMatchObject({ canAccept: false, expired: true });
    expect((await acceptQuote({ token: EXPIRED, signerName: 'Marie Martin', signature: SIGNATURE, acceptTerms: true })).error).toMatch(/expiré/);
  });

  it('compte les consultations du client', async () => {
    await recordQuoteView(TOKEN);
    await recordQuoteView(TOKEN);
    const { rows } = await pg.query<{ view_count: number; viewed_at: string | null }>(`select view_count, viewed_at from quotes where id = $1`, [quoteId]);
    expect(rows[0].view_count).toBe(2);
    expect(rows[0].viewed_at).not.toBeNull();
  });
});
