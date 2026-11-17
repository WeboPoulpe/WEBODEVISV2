// Rôle support : il entre dans les comptes clients et voit leur liste, rien d'autre de l'administration.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ADMIN = '00000000-0000-4000-8000-00000000f5a1';
const SUPPORT = '00000000-0000-4000-8000-00000000f5b1';
const CLIENT = '00000000-0000-4000-8000-00000000f5c1';
let me = SUPPORT;
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: me, email: 'x@t.fr' } }) }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const admin = await import('./admin');
const { authOptions } = await import('@/lib/auth');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jwt = authOptions.callbacks!.jwt as any;
const enter = (from: string, to: string) => jwt({ token: { sub: from, checkedAt: Date.now() }, trigger: 'update', session: { actAs: to } });

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ADMIN}', 'admin@t.fr', 'x'), ('${SUPPORT}', 'support@t.fr', 'x'), ('${CLIENT}', 'client@t.fr', 'x');
    insert into profiles (id, email, role) values ('${ADMIN}', 'admin@t.fr', 'admin'), ('${SUPPORT}', 'support@t.fr', 'support'), ('${CLIENT}', 'client@t.fr', 'user');
  `);
});

it('le support entre dans le compte d’un client, et c’est tracé', async () => {
  expect((await enter(SUPPORT, CLIENT)).sub).toBe(CLIENT);
  const [row] = (await pg.query<{ action: string; actor_id: string }>(`select action, actor_id from audit_log order by created_at desc limit 1`)).rows;
  expect(row).toMatchObject({ action: 'entree_compte_client', actor_id: SUPPORT });
});

it('le support n’entre pas dans le compte d’un administrateur', async () => {
  expect((await enter(SUPPORT, ADMIN)).sub).toBe(SUPPORT);
});

it('le support voit les comptes clients, sans abonnement ni comptes de l’équipe', async () => {
  me = SUPPORT;
  const list = await admin.listAccounts();
  expect(list.map((a) => a.id)).toEqual([CLIENT]);
  expect(list[0].subscription).toBeNull();
});

it('le reste de l’administration est refusé au support', async () => {
  me = SUPPORT;
  await expect(admin.setAccountRole(CLIENT, 'admin')).rejects.toThrow();
  await expect(admin.setAccountActive(CLIENT, false)).rejects.toThrow();
  await expect(admin.listAuditLog()).rejects.toThrow();
});

it('l’administrateur donne et retire le rôle support', async () => {
  me = ADMIN;
  expect((await admin.setAccountRole(CLIENT, 'support')).error).toBeNull();
  expect((await admin.listAccounts()).find((a) => a.id === CLIENT)?.role).toBe('support');
  expect((await admin.setAccountRole(CLIENT, 'user')).error).toBeNull();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((await admin.setAccountRole(CLIENT, 'root' as any)).error).toBe('Rôle inconnu.');
});
