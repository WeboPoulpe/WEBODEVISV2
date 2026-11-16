// Envoi du devis au client, avec copie visible (Cc), sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-00000000aa01';
vi.mock('./session', () => ({ requireUser: async () => ({ id: ME, email: 'chef@t.fr' }), requireWriter: async () => ({ id: ME, email: 'chef@t.fr' }) }));
const mails: { to: string; cc?: string[] }[] = [];
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string; cc?: string[] }) => { mails.push({ to: m.to, cc: m.cc }); return { error: null }; },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { sendQuoteToClient } = await import('./quotes');
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'chef@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${ME}', 'chef@t.fr', 'Traiteur Test');
  `);
  const { rows } = await pg.query<{ id: string }>(`insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status)
    values ($1, $1, 'Dupont', '2026-12-12', 'mariage', 40, 'devis_a_faire') returning id`, [ME]);
  quoteId = rows[0].id;
});

describe('copie visible (Cc)', () => {
  it('accompagne seulement le premier email, sans reprendre un destinataire', async () => {
    const res = await sendQuoteToClient({ quoteId, to: ['a@client.fr', 'b@client.fr'], message: 'Bonjour', cc: 'associe@traiteur.fr, b@client.fr' });
    expect(res.error).toBeNull();
    expect(mails).toEqual([{ to: 'a@client.fr', cc: ['associe@traiteur.fr'] }, { to: 'b@client.fr', cc: undefined }]);
    expect(res.cc).toEqual(['associe@traiteur.fr']);
  });

  it('refuse une adresse en copie invalide', async () => {
    expect((await sendQuoteToClient({ quoteId, to: 'a@client.fr', message: 'Bonjour', cc: 'pas-une-adresse' })).error).toMatch(/copie/);
  });

  it('sans copie, rien ne change', async () => {
    mails.length = 0;
    const res = await sendQuoteToClient({ quoteId, to: 'a@client.fr', message: 'Bonjour' });
    expect(res.error).toBeNull();
    expect(mails).toEqual([{ to: 'a@client.fr', cc: undefined }]);
    expect(res.cc).toBeUndefined();
  });
});

it('l’envoi par email est noté dans l’historique', async () => {
  await sendQuoteToClient({ quoteId, to: 'histo@client.fr', message: 'Bonjour' });
  const { rows } = await pg.query<{ action: string; entity_type: string; entity_id: string; summary: string }>(
    `select action, entity_type, entity_id, summary from activity_log where action = 'envoi' order by created_at desc limit 1`);
  expect(rows[0]).toMatchObject({ action: 'envoi', entity_type: 'devis', entity_id: quoteId });
  expect(rows[0].summary).toMatch(/envoyé par email à histo@client\.fr/);
});
