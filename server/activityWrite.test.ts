// logActivity : écrit dans l'historique, ne fait jamais échouer l'action qui l'appelle.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

vi.mock('server-only', () => ({}));
let pg: PGlite;
let broken = false;
vi.mock('@/db', () => ({
  get db() {
    if (broken) return { execute: async () => { throw new Error('base indisponible'); } };
    return drizzle(pg, { schema });
  },
}));

const { logActivity } = await import('./activityWrite');
const OWNER = '00000000-0000-4000-8000-0000000b0001';
const count = async () => (await pg.query<{ n: number }>(`select count(*)::int as n from activity_log`)).rows[0].n;

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'chef@t.fr', 'x');
    insert into profiles (id, email, first_name, last_name) values ('${OWNER}', 'chef@t.fr', 'Julien', 'Martin');
  `);
});

it('écrit une ligne avec le résumé par défaut', async () => {
  await logActivity({ actor: OWNER, action: 'creation', entity: 'client', entityId: OWNER, label: 'Julie Martin' });
  const { rows } = await pg.query<{ summary: string; actor_label: string }>(`select summary, actor_label from activity_log`);
  expect(rows).toEqual([{ summary: 'Client Julie Martin créé', actor_label: 'Julien Martin' }]);
});

it('ne fait rien pour le compte de démonstration', async () => {
  const before = await count();
  await logActivity({ actor: DEMO_USER_ID, action: 'creation', entity: 'client', label: 'X' });
  expect(await count()).toBe(before);
});

it('n’émet jamais d’exception si la base échoue', async () => {
  broken = true;
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(logActivity({ actor: OWNER, action: 'creation', entity: 'client', label: 'X' })).resolves.toBeUndefined();
  broken = false;
  spy.mockRestore();
});
