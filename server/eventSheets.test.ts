// Fiche de production, production du jour et feuille de route, lues sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { formatQuantity } from '@/lib/production';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-0000000000d1';
const OTHER = '00000000-0000-4000-8000-0000000000d2';
let current = ME;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@y.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getProductionSheet, getDayProduction, getRunSheet } = await import('./eventSheets');
let quoteId = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'a@t.fr', 'x'), ('${OTHER}', 'b@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${ME}', 'a@t.fr', 'Traiteur A'), ('${OTHER}', 'b@t.fr', 'B');
    insert into ingredients (id, name, user_id, unit, allergens) values
      ('00000000-0000-4000-8000-0000000000e1', 'Farine de blé', null, 'kg', null),
      ('00000000-0000-4000-8000-0000000000e2', 'Beurre', '${ME}', 'kg', '{lait}');
    insert into prestations (id, name, user_id, allergens_extra, allergens_checked) values
      ('00000000-0000-4000-8000-0000000000f1', 'Tarte maison', '${ME}', '{oeufs}', true);
    insert into service_ingredients (user_id, service_id, ingredient_id, qty_per_person, unit) values
      ('${ME}', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e1', 0.05, null),
      ('${ME}', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e2', 20, 'g');
    insert into extras (id, user_id, name, phone, role) values
      ('00000000-0000-4000-8000-0000000000a1', '${ME}', 'Paul', '0600000000', 'Serveur'),
      ('00000000-0000-4000-8000-0000000000a2', '${ME}', 'Léa', null, 'Cuisine');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services, team_arrival_time,
      event_location, client_phone, onsite_contact, run_sheet, event_materials)
    values ($1, $1, 'Dupont', '2026-12-12', 'mariage', 40, 'valide',
      '[{"name":"Tarte maison","quantity":40},{"name":"Location de verres","quantity":40}]', '16:30', 'Salle des fêtes, Troyes',
      '0611111111', 'Marc 0622222222',
      '[{"time":"19:00","label":"Cocktail","note":""},{"time":"17:00","label":"Mise en place","note":"Tables"}]',
      '[{"id":"m1","name":"Chafing dish","qty":4,"unit":""}]') returning id`, [ME]);
  quoteId = rows[0].id;
  await pg.exec(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status)
    values ('${ME}', '${ME}', 'Pas encore signé', '2026-12-12', 'anniversaire', 20, 'devis_envoye');
    insert into event_extras (quote_id, extra_id, status, arrival_time, departure_time) values
      ('${quoteId}', '00000000-0000-4000-8000-0000000000a1', 'confirme', '16:30', '23:00'),
      ('${quoteId}', '00000000-0000-4000-8000-0000000000a2', 'refuse', null, null);
    insert into rental_items (quote_id, material_name, qty, unit) values ('${quoteId}', 'Verres à vin', 50, 'pièces');
  `);
});

it('établit la fiche de production à partir des recettes', async () => {
  const sheet = (await getProductionSheet(quoteId))!;
  expect(sheet.companyName).toBe('Traiteur A');
  expect(sheet.teamArrivalTime?.slice(0, 5)).toBe('16:30');
  expect(sheet.plan.dishes).toHaveLength(1);
  expect(sheet.plan.dishes[0]).toMatchObject({ name: 'Tarte maison', toProduce: 40, allergens: ['gluten', 'oeufs', 'lait'] });
  expect(sheet.plan.totals.map((t) => `${t.name} ${formatQuantity(t.quantity, t.unit)}`)).toEqual(['Beurre 800 g', 'Farine de blé 2 kg']);
  expect(sheet.plan.unmatched).toEqual(['Location de verres']);
});

it('réunit les événements confirmés du jour', async () => {
  const day = (await getDayProduction('2026-12-12'))!;
  expect(day.events.map((e) => e.clientName)).toEqual(['Dupont']);
  expect(await getDayProduction('pas-une-date')).toBeNull();
});

it('établit la feuille de route', async () => {
  const sheet = (await getRunSheet(quoteId))!;
  expect(sheet.steps.map((s) => s.time)).toEqual(['17:00', '19:00']);
  expect(sheet.onsiteContact).toBe('Marc 0622222222');
  expect(sheet.team).toEqual([{ name: 'Paul', role: 'Serveur', phone: '0600000000', arrival: '16:30', departure: '23:00', status: 'confirme' }]);
  expect(sheet.materials).toEqual([{ name: 'Chafing dish', qty: 4, unit: null, supplier: null }]);
  expect(sheet.rentals).toEqual([{ name: 'Verres à vin', qty: 50, unit: 'pièces', supplier: null }]);
});

it('ne donne rien d’un autre compte', async () => {
  current = OTHER;
  expect(await getProductionSheet(quoteId)).toBeNull();
  expect(await getRunSheet(quoteId)).toBeNull();
  expect((await getDayProduction('2026-12-12'))!.events).toEqual([]);
  current = ME;
});
