// Frein aux essais de mots de passe, joué sur la vraie fonction de connexion et le vrai schéma en mémoire.
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { authOptions } = await import('./auth');
const { MAX_PER_EMAIL, TOO_MANY_ATTEMPTS } = await import('./loginThrottle');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authorize = (authOptions.providers[1] as any).options.authorize as (c: { email: string; password: string }, req: unknown) => Promise<unknown>;
const req = (ip: string) => ({ headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

beforeAll(async () => {
  pg = await createTestDb();
  const hash = await bcrypt.hash('bon-mot-de-passe', 4);
  await pg.query(`insert into users (id, email, password_hash) values ('00000000-0000-4000-8000-00000000e001', 'chef@t.fr', $1)`, [hash]);
  await pg.query(`insert into profiles (id, email) values ('00000000-0000-4000-8000-00000000e001', 'chef@t.fr')`);
});

it('laisse entrer avec le bon mot de passe et remet le compteur à zéro', async () => {
  expect(await authorize({ email: 'chef@t.fr', password: 'faux' }, req('1.1.1.1'))).toBeNull();
  expect(await authorize({ email: 'Chef@T.fr', password: 'bon-mot-de-passe' }, req('1.1.1.1'))).toMatchObject({ email: 'chef@t.fr' });
  expect((await pg.query(`select 1 from login_attempts`)).rows).toHaveLength(0);
});

it('bloque l’adresse après trop d’échecs, même avec le bon mot de passe', async () => {
  for (let i = 0; i < MAX_PER_EMAIL; i++) expect(await authorize({ email: 'chef@t.fr', password: `faux${i}` }, req(`2.2.2.${i}`))).toBeNull();
  await expect(authorize({ email: 'chef@t.fr', password: 'bon-mot-de-passe' }, req('3.3.3.3'))).rejects.toThrow(TOO_MANY_ATTEMPTS);
  // Un quart d'heure plus tard, c'est reparti.
  await pg.exec(`update login_attempts set created_at = now() - interval '16 minutes'`);
  expect(await authorize({ email: 'chef@t.fr', password: 'bon-mot-de-passe' }, req('3.3.3.3'))).toMatchObject({ email: 'chef@t.fr' });
});

it('compte aussi les essais sur des adresses inconnues', async () => {
  expect(await authorize({ email: 'personne@t.fr', password: 'x' }, req('4.4.4.4'))).toBeNull();
  expect((await pg.query(`select 1 from login_attempts`)).rows).toHaveLength(1);
});
