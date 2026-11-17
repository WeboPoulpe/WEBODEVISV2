// Bloc Instagram de la page Statistiques : clics, visiteurs, conversions et personnes venues d'Instagram.
import { beforeAll, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('./session', () => ({ requireAdmin: async () => ({ id: 'admin', email: 'a@t.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { getInstagramStats } = await import('./siteStats');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into site_visits (day, path, event, source, visitor, origin) values
      (current_date, '/ig', 'clic', 'reseaux', 'v1', 'instagram'),
      (current_date, '/ig', 'clic', 'reseaux', 'v1', 'instagram'),
      (current_date, '/ig', 'clic', 'reseaux', 'v2', 'instagram'),
      (current_date, '/site', 'view', 'reseaux', 'v2', 'instagram'),
      (current_date - 10, '/ig/lancement', 'clic', 'reseaux', 'v3', 'instagram:lancement'),
      (current_date, '/site', 'view', 'direct', 'v9', null);
    insert into site_requests (kind, name, email, company, message, origin) values
      ('demo', 'Camille Martin', 'camille@x.fr', 'Traiteur Martin', '-', 'instagram'),
      ('message', 'Sans Origine', 's@x.fr', null, '-', null);
    insert into site_requests (kind, name, email, message, origin, status) values
      ('message', 'Robot', 'r@x.fr', '-', 'instagram', 'suspecte');
    insert into users (id, email, password_hash) values ('00000000-0000-4000-8000-00000000f001', 'julien@x.fr', 'x');
    insert into profiles (id, email, first_name, last_name, origin) values
      ('00000000-0000-4000-8000-00000000f001', 'julien@x.fr', 'Julien', 'Roy', 'instagram:lancement');
  `);
});

it('compte clics, visiteurs et conversions venus d’Instagram', async () => {
  const s = await getInstagramStats(30);
  expect(s.totals).toEqual({ clics: 4, visiteurs: 3, demos: 1, contacts: 0, inscriptions: 1 });
  expect(s.liens).toEqual([{ origin: 'instagram', clics: 3 }, { origin: 'instagram:lancement', clics: 1 }]);
  expect(s.daily).toHaveLength(30);
  expect(s.daily.at(-1)?.clics).toBe(3);
});

it('liste les personnes qui se sont fait connaître, sans les demandes suspectes', async () => {
  const s = await getInstagramStats(30);
  expect(s.personnes.map((p) => [p.kind, p.name, p.origin]).sort()).toEqual([
    ['compte', 'Julien Roy', 'instagram:lancement'],
    ['demo', 'Camille Martin', 'instagram'],
  ]);
  expect(s.personnes.find((p) => p.kind === 'demo')?.company).toBe('Traiteur Martin');
});

it('hors période : non compté', async () => {
  const s = await getInstagramStats(7);
  expect(s.totals.clics).toBe(3);
  expect(s.liens).toEqual([{ origin: 'instagram', clics: 3 }]);
});
