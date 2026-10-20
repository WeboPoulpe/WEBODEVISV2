// Journal des actions sensibles, sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ADMIN = '00000000-0000-4000-8000-00000000f0a1';
const CLIENT = '00000000-0000-4000-8000-00000000f0c1';
vi.mock('./session', () => ({ requireAdmin: async () => ({ id: ADMIN, email: 'admin@t.fr' }), requireUser: async () => ({ id: ADMIN, email: 'admin@t.fr' }) }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const admin = await import('./admin');
const { authOptions } = await import('@/lib/auth');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ADMIN}', 'admin@t.fr', 'x'), ('${CLIENT}', 'client@t.fr', 'x');
    insert into profiles (id, email, role) values ('${ADMIN}', 'admin@t.fr', 'admin'), ('${CLIENT}', 'client@t.fr', 'user');
  `);
});

it('trace les actions sur les comptes', async () => {
  expect((await admin.setAccountActive(CLIENT, false)).error).toBeNull();
  const log = await admin.listAuditLog();
  expect(log[0]).toMatchObject({ action: 'compte_desactive', label: 'Compte désactivé', actor: 'admin@t.fr', target: 'client@t.fr' });
});

it('trace l’entrée d’un administrateur dans le compte d’un client', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jwt = authOptions.callbacks!.jwt as any;
  const token = await jwt({ token: { sub: ADMIN, checkedAt: Date.now() }, trigger: 'update', session: { actAs: CLIENT } });
  expect(token.sub).toBe(CLIENT);
  const log = await admin.listAuditLog();
  expect(log[0]).toMatchObject({ action: 'entree_compte_client', actor: 'admin@t.fr', target: 'client@t.fr' });
});

it('ne trace rien quand un non-administrateur tente d’entrer dans un compte', async () => {
  await pg.exec(`delete from audit_log`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jwt = authOptions.callbacks!.jwt as any;
  const token = await jwt({ token: { sub: CLIENT, checkedAt: Date.now() }, trigger: 'update', session: { actAs: ADMIN } });
  expect(token.sub).toBe(CLIENT);
  expect(await admin.listAuditLog()).toEqual([]);
});
