// Statistiques d'usage de l'administration, sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
vi.mock('./session', () => ({ requireAdmin: async () => ({ id: 'admin', email: 'a@t.fr' }), requireUser: async () => ({ id: 'admin', email: 'a@t.fr' }) }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getAdminOverview } = await import('./admin');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values
      ('00000000-0000-4000-8000-00000000e101', 'actif@t.fr', 'x'),
      ('00000000-0000-4000-8000-00000000e102', 'endormi@t.fr', 'x'),
      ('00000000-0000-4000-8000-00000000e103', 'jamais@t.fr', 'x');
    insert into profiles (id, email, company_name, last_seen_at, created_at) values
      ('00000000-0000-4000-8000-00000000e101', 'actif@t.fr', 'Actif', now() - interval '1 day', now() - interval '60 days'),
      ('00000000-0000-4000-8000-00000000e102', 'endormi@t.fr', 'Endormi', now() - interval '45 days', now() - interval '90 days'),
      ('00000000-0000-4000-8000-00000000e103', 'jamais@t.fr', 'Jamais', null, now() - interval '20 days');
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, sent_at)
      values ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000e101', 'C', '2026-12-01', 'mariage', 10, 'devis_envoye', now());
  `);
});

it('compte les actifs, les comptes activés et ceux à rappeler', async () => {
  const o = await getAdminOverview();
  expect(o).toMatchObject({ seen7d: 1, seen30d: 1, owners: 3, activated: 1 });
  expect(o.atRisk.map((a) => a.name)).toEqual(['Jamais', 'Endormi']);
});
