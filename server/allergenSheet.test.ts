// Fiche allergènes d'un devis, lue sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-0000000000d1';
const OTHER = '00000000-0000-4000-8000-0000000000d2';
let current = ME;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@y.fr' }), requireWriter: async () => ({ id: current, email: 'x@y.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getQuoteAllergenSheet } = await import('./allergenSheet');
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'a@t.fr', 'x'), ('${OTHER}', 'b@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${ME}', 'a@t.fr', 'Traiteur A'), ('${OTHER}', 'b@t.fr', 'B');
    insert into ingredients (id, name, user_id, allergens) values
      ('00000000-0000-4000-8000-0000000000e1', 'Farine de blé', null, null),
      ('00000000-0000-4000-8000-0000000000e2', 'Beurre', '${ME}', '{lait}');
    insert into prestations (id, name, user_id, allergens_extra, allergens_checked) values
      ('00000000-0000-4000-8000-0000000000f1', 'Tarte maison', '${ME}', '{oeufs}', true);
    insert into service_ingredients (user_id, service_id, ingredient_id) values
      ('${ME}', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e1'),
      ('${ME}', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e2');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services)
    values ($1, $1, 'Dupont', '2026-12-12', 'mariage', 40, 'valide', '[{"name":"Tarte maison"},{"name":"Location de verres"}]') returning id`, [ME]);
  quoteId = rows[0].id;
});

it('établit la fiche du devis à partir des recettes', async () => {
  const sheet = (await getQuoteAllergenSheet(quoteId))!;
  expect(sheet.rows).toEqual([{ dish: 'Tarte maison', keys: ['gluten', 'oeufs', 'lait'], checked: true, hasSuggestions: true }]);
  expect(sheet.unmatched).toEqual(['Location de verres']);
  expect(sheet.companyName).toBe('Traiteur A');
});

it('ne donne pas la fiche d’un autre compte', async () => {
  current = OTHER;
  expect(await getQuoteAllergenSheet(quoteId)).toBeNull();
  current = ME;
});
