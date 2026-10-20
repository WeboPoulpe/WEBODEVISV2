// Envoi par WhatsApp et historique d'un devis, sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-00000000ab01';
const OTHER = '00000000-0000-4000-8000-00000000ab02';
let current = ME;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'chef@t.fr' }),
  requireWriter: async () => ({ id: current, email: 'chef@t.fr' }),
  getSessionUser: async () => null,
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { shareQuoteByWhatsapp, sendQuoteToClient } = await import('./quotes');
const { getQuoteHistory } = await import('./quoteHistory');
const { recordQuoteView } = await import('./acceptance');
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'chef@t.fr', 'x'), ('${OTHER}', 'autre@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${ME}', 'chef@t.fr', 'Traiteur'), ('${OTHER}', 'autre@t.fr', 'Autre');
  `);
  const { rows } = await pg.query<{ id: string }>(`insert into quotes (owner_user_id, user_id, client_name, client_phone, event_date, event_type, guest_count, status)
    values ($1, $1, 'Dupont', '06 12 34 56 78', '2026-12-12', 'mariage', 40, 'devis_a_faire') returning id`, [ME]);
  quoteId = rows[0].id;
});

describe('envoi par WhatsApp', () => {
  it('prépare le lien, passe le devis en « Devis envoyé » et donne le numéro du client', async () => {
    const res = await shareQuoteByWhatsapp(quoteId);
    expect(res).toMatchObject({ error: null, phone: '33612345678', status: 'devis_envoye' });
    expect(res.link).toMatch(/^https:\/\/webodevis\.fr\/d\/[A-Za-z0-9_-]{20,}$/);
  });

  it('refuse le devis d’une autre entreprise', async () => {
    current = OTHER;
    expect((await shareQuoteByWhatsapp(quoteId)).error).toMatch(/introuvable/);
    expect(await getQuoteHistory(quoteId)).toBeNull();
    current = ME;
  });
});

describe('historique', () => {
  it('réunit création, statut, envois et consultations, du plus récent au plus ancien', async () => {
    await sendQuoteToClient({ quoteId, to: 'client@t.fr', message: 'Bonjour', cc: 'associe@t.fr' });
    const token = (await pg.query<{ share_token: string }>(`select share_token from quotes where id = $1`, [quoteId])).rows[0].share_token;
    await recordQuoteView(token);
    await recordQuoteView(token); // une seule consultation notée dans les 6 heures
    const h = (await getQuoteHistory(quoteId))!;
    const kinds = h.map((e) => e.kind);
    expect(kinds).toContain('creation');
    expect(kinds).toContain('envoi_whatsapp');
    expect(kinds.filter((k) => k === 'consultation')).toHaveLength(1);
    expect(h.find((e) => e.kind === 'statut')).toMatchObject({ title: 'Statut : Devis envoyé', by: 'chef@t.fr' });
    expect(h.find((e) => e.kind === 'envoi_email')).toMatchObject({ title: 'Envoyé par email', detail: 'client@t.fr (en copie : associe@t.fr)' });
    expect(h.at(-1)!.kind).toBe('creation');
  });
});
