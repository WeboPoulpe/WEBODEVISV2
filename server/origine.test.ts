// Origine Instagram enregistrée sur les demandes et les comptes (lib/origine.ts), sur le vrai schéma en mémoire.
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Map([['x-forwarded-for', '1.2.3.4']]), cookies: async () => new Map() }));
vi.mock('@/lib/mail', () => ({ sendMail: async () => ({ error: null }), appOrigin: async () => 'https://webodevis.fr', isTestAddress: () => false }));
vi.mock('./session', () => ({
  requireAdmin: async () => ({ id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@t.fr' }),
  requireStaff: async () => ({ id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@t.fr' }),
  getSessionUser: async () => null,
}));
vi.mock('./settings', async (orig) => ({ ...(await orig<typeof import('./settings')>()), isSignupOpen: async () => true }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { submitSiteRequest } = await import('./site');
const { registerUser } = await import('./auth');
const { createAccount } = await import('./admin');
const { originForEmail } = await import('./origine');

const originOf = async (table: 'site_requests' | 'profiles', email: string) =>
  (await pg.query<{ origin: string | null }>(`select origin from ${table} where lower(email) = lower($1) order by created_at desc limit 1`, [email])).rows[0]?.origin;
const contact = (email: string, origin: unknown) => ({
  kind: 'message' as const, name: 'Jeanne Martin', email, message: 'Bonjour, nous faisons 40 mariages par an.', startedAt: Date.now() - 60_000, origin,
}) as Parameters<typeof submitSiteRequest>[0];

beforeAll(async () => {
  pg = await createTestDb();
  process.env.CONTACT_EMAIL = 'equipe@webodevis.fr';
  await pg.exec(`insert into users (id, email, password_hash) values ('00000000-0000-4000-8000-0000000000ad', 'admin@t.fr', 'x');
    insert into profiles (id, email, role) values ('00000000-0000-4000-8000-0000000000ad', 'admin@t.fr', 'admin');`);
});
beforeEach(async () => {
  await pg.exec(`delete from site_requests;`);
});

it('contact : origine valide gardée', async () => {
  expect(await submitSiteRequest(contact('a@t.fr', 'instagram'))).toEqual({ error: null });
  expect(await originOf('site_requests', 'a@t.fr')).toBe('instagram');
});

it('contact : origine forgée ignorée, la demande passe', async () => {
  expect(await submitSiteRequest(contact('b@t.fr', 'instagram:<script>'))).toEqual({ error: null });
  expect(await originOf('site_requests', 'b@t.fr')).toBeNull();
});

it('origine d’une adresse : la demande la plus récente qui en a une', async () => {
  await pg.exec(`insert into site_requests (kind, name, email, message, origin, created_at) values
    ('demo', 'C', 'Camille@X.fr', '-', 'instagram', now() - interval '2 days'),
    ('demo', 'C', 'camille@x.fr', '-', 'instagram:lancement', now() - interval '1 day'),
    ('message', 'C', 'camille@x.fr', '-', null, now())`);
  expect(await originForEmail('CAMILLE@x.fr', null)).toBe('instagram:lancement');
  expect(await originForEmail('camille@x.fr', 'instagram:salon')).toBe('instagram:salon');
  expect(await originForEmail('personne@x.fr', 'facebook')).toBeNull();
});

it('compte créé dans l’admin : reprend l’origine de la demande, casse différente', async () => {
  await pg.exec(`insert into site_requests (kind, name, email, message, origin) values ('demo', 'Camille', 'Camille@X.fr', '-', 'instagram:lancement')`);
  expect(await createAccount({ email: 'camille@x.fr', firstName: 'Camille', lastName: 'M', companyName: 'Traiteur', modules: [] })).toEqual({ error: null });
  expect(await originOf('profiles', 'camille@x.fr')).toBe('instagram:lancement');
});

it('inscription avec origine de visite', async () => {
  expect(await registerUser({ email: 'r@t.fr', password: 'secret1', firstName: 'R', lastName: 'S', origin: 'instagram:salon' })).toEqual({ error: null });
  expect(await originOf('profiles', 'r@t.fr')).toBe('instagram:salon');
});

it('inscription sans origine de visite : reprise par l’adresse', async () => {
  await pg.exec(`insert into site_requests (kind, name, email, message, origin) values ('message', 'J', 'j@t.fr', '-', 'instagram')`);
  expect(await registerUser({ email: 'j@t.fr', password: 'secret1', firstName: 'J', lastName: 'R' })).toEqual({ error: null });
  expect(await originOf('profiles', 'j@t.fr')).toBe('instagram');
});

it('inscription sans aucune origine : null', async () => {
  expect(await registerUser({ email: 'n@t.fr', password: 'secret1', firstName: 'N', lastName: 'O' })).toEqual({ error: null });
  expect(await originOf('profiles', 'n@t.fr')).toBeNull();
});
