// Fermeture des sessions : compte désactivé ou mot de passe changé, testée sur un Postgres en mémoire.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import * as schema from '@/db/schema';

vi.mock('server-only', () => ({}));

const pg = new PGlite();
vi.mock('@/db', () => ({ db: drizzle(pg, { schema }) }));

const { authOptions, passwordTag } = await import('./auth');
const jwt = authOptions.callbacks!.jwt!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refresh = (token: JWT) => jwt({ token } as any) as Promise<JWT>;

const ID = '00000000-0000-4000-8000-0000000000e1';

beforeAll(async () => {
  await pg.exec(`
    create table users (id uuid primary key, email text, password_hash text not null);
    create table profiles (id uuid primary key, email text, role text, is_active boolean default true);
    insert into users values ('${ID}', 'a@b.fr', 'hash-1');
    insert into profiles (id, email) values ('${ID}', 'a@b.fr');
  `);
});

describe('revérification de la session', () => {
  it('garde une session valide et retient l’empreinte du mot de passe', async () => {
    const token = await refresh({ sub: ID, checkedAt: 0 });
    expect(token.sub).toBe(ID);
    expect(token.pw).toBe(passwordTag('hash-1'));
  });

  it('ne relit pas la base avant 5 minutes', async () => {
    await pg.exec(`update profiles set is_active = false where id = '${ID}'`);
    const token = await refresh({ sub: ID, pw: passwordTag('hash-1'), checkedAt: Date.now() });
    expect(token.sub).toBe(ID);
    await pg.exec(`update profiles set is_active = true where id = '${ID}'`);
  });

  it('ferme la session d’un compte désactivé', async () => {
    await pg.exec(`update profiles set is_active = false where id = '${ID}'`);
    const token = await refresh({ sub: ID, pw: passwordTag('hash-1'), checkedAt: 0 });
    expect(token.sub).toBeUndefined();
    expect(token.revoked).toBe(true);
    await pg.exec(`update profiles set is_active = true where id = '${ID}'`);
  });

  it('ferme la session quand le mot de passe a changé ailleurs', async () => {
    await pg.exec(`update users set password_hash = 'hash-2' where id = '${ID}'`);
    const token = await refresh({ sub: ID, pw: passwordTag('hash-1'), checkedAt: 0 });
    expect(token.revoked).toBe(true);
  });

  it('ferme la session d’un compte supprimé', async () => {
    const token = await refresh({ sub: '00000000-0000-4000-8000-0000000000ff', checkedAt: 0 });
    expect(token.revoked).toBe(true);
  });
});
