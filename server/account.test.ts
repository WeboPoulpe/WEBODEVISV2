// Demande de suppression du compte par son titulaire, sur le vrai schéma en mémoire.
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-00000000d001';
const MEMBER = '00000000-0000-4000-8000-00000000d002';
let current = OWNER;
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: current } }) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
const mails: string[] = [];
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async (m: { to: string }) => { mails.push(m.to); return { error: null }; } }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { requestAccountDeletion } = await import('./account');
const { accountsDueForPurge } = await import('./accountPurge');

beforeAll(async () => {
  pg = await createTestDb();
  const hash = await bcrypt.hash('secret123', 4);
  await pg.query(`insert into users (id, email, password_hash) values ($1, 'o@t.fr', $3), ($2, 'm@t.fr', $3)`, [OWNER, MEMBER, hash]);
  await pg.query(`insert into profiles (id, email) values ($1, 'o@t.fr')`, [OWNER]);
  await pg.query(`insert into profiles (id, email, parent_user_id) values ($1, 'm@t.fr', $2)`, [MEMBER, OWNER]);
});

describe('suppression du compte', () => {
  it('demande le mot de passe et la confirmation écrite', async () => {
    expect((await requestAccountDeletion({ password: 'secret123', confirmText: 'oui' })).error).toMatch(/SUPPRIMER/);
    expect((await requestAccountDeletion({ password: 'faux', confirmText: 'supprimer' })).error).toMatch(/mot de passe/);
  });

  it('refuse un collaborateur rattaché à une entreprise', async () => {
    current = MEMBER;
    expect((await requestAccountDeletion({ password: 'secret123', confirmText: 'SUPPRIMER' })).error).toMatch(/rattaché/);
    current = OWNER;
  });

  it('désactive le compte et programme la purge dans 30 jours', async () => {
    const res = await requestAccountDeletion({ password: 'secret123', confirmText: 'SUPPRIMER' });
    expect(res.error).toBeNull();
    const { rows } = await pg.query<{ is_active: boolean; deletion_requested_at: string | null }>(`select is_active, deletion_requested_at from profiles where id = $1`, [OWNER]);
    expect(rows[0].is_active).toBe(false);
    expect(rows[0].deletion_requested_at).not.toBeNull();
    expect(mails).toContain('o@t.fr');
    expect(await accountsDueForPurge()).toEqual([]);
    await pg.query(`update profiles set deletion_requested_at = now() - interval '31 days' where id = $1`, [OWNER]);
    expect(await accountsDueForPurge()).toEqual([OWNER]);
  });
});
