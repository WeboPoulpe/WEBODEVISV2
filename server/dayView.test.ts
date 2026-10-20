// « Ma journée » lue sur le vrai schéma en mémoire : aujourd'hui et demain (heure de Paris), statuts, entreprises.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-0000000000d1';
const COLLEAGUE = '00000000-0000-4000-8000-0000000000d3';
const OTHER = '00000000-0000-4000-8000-0000000000d2';
let current = ME;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@y.fr' }), requireWriter: async () => ({ id: current, email: 'x@y.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getDayView } = await import('./dayView');

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'a@t.fr', 'x'), ('${COLLEAGUE}', 'c@t.fr', 'x'), ('${OTHER}', 'b@t.fr', 'x');
    insert into profiles (id, email, company_name, parent_user_id) values
      ('${ME}', 'a@t.fr', 'Traiteur A', null), ('${COLLEAGUE}', 'c@t.fr', 'Traiteur A', '${ME}'), ('${OTHER}', 'b@t.fr', 'B', null);
    insert into ingredients (id, name, user_id, unit, allergens) values
      ('00000000-0000-4000-8000-0000000000e2', 'Beurre', '${ME}', 'kg', '{lait}');
    insert into prestations (id, name, user_id, allergens_extra, allergens_checked) values
      ('00000000-0000-4000-8000-0000000000f1', 'Tarte maison', '${ME}', '{oeufs}', true);
    insert into service_ingredients (user_id, service_id, ingredient_id, qty_per_person, unit) values
      ('${ME}', '00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e2', 20, 'g');
    insert into extras (id, user_id, name, phone, role) values
      ('00000000-0000-4000-8000-0000000000a1', '${ME}', 'Paul', '0600000000', 'Serveur'),
      ('00000000-0000-4000-8000-0000000000a2', '${ME}', 'Léa', null, 'Cuisine');
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, guest_count_adults, guest_count_children,
      status, services, team_arrival_time, event_location, client_phone, onsite_contact, run_sheet)
    values ($1, $1, 'Dupont', '2026-12-12', 'mariage', 40, 35, 5, 'acompte',
      '[{"name":"Tarte maison","quantity":40},{"name":"Location de verres","quantity":40}]', '16:30', 'Salle des fêtes, Troyes',
      '0611111111', 'Marc 0622222222',
      '[{"time":"19:00","label":"Cocktail","note":""},{"time":"17:00","label":"Mise en place","note":"Tables"}]') returning id`, [ME]);
  await pg.exec(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status) values
      ('${COLLEAGUE}', '${COLLEAGUE}', 'Martin', '2026-12-13', 'repas', 20, 'paye'),
      ('${ME}', '${ME}', 'Pas encore signé', '2026-12-12', 'repas', 20, 'devis_envoye'),
      ('${ME}', '${ME}', 'Refusé', '2026-12-12', 'repas', 20, 'refus_client'),
      ('${ME}', '${ME}', 'Après-demain', '2026-12-14', 'repas', 20, 'valide'),
      ('${ME}', '${ME}', 'Hier', '2026-12-11', 'repas', 20, 'valide'),
      ('${OTHER}', '${OTHER}', 'Autre entreprise', '2026-12-12', 'repas', 20, 'valide');
    insert into event_extras (quote_id, extra_id, status, arrival_time, departure_time) values
      ('${rows[0].id}', '00000000-0000-4000-8000-0000000000a1', 'confirme', '16:30', '23:00'),
      ('${rows[0].id}', '00000000-0000-4000-8000-0000000000a2', 'refuse', null, null);
  `);
  // 23 h 30 à Londres le 11 décembre : déjà le 12 décembre à Paris.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-11T23:30:00Z'));
});

afterAll(() => { vi.useRealTimers(); });

it('réunit les événements confirmés d’aujourd’hui et de demain, à l’heure de Paris', async () => {
  current = ME;
  const view = await getDayView();
  expect(view.accountId).toBe(ME);
  expect(view.companyName).toBe('Traiteur A');
  expect(view.generatedAt).toBe('2026-12-11T23:30:00.000Z');
  expect(view.days.map((d) => [d.label, d.date, d.events.map((e) => e.clientName)])).toEqual([
    ['Aujourd’hui', '2026-12-12', ['Dupont']],
    ['Demain', '2026-12-13', ['Martin']],
  ]);
});

it('donne pour chaque événement les contacts, le déroulé trié, l’équipe et la production', async () => {
  current = ME;
  const [event] = (await getDayView()).days[0].events;
  expect(event).toMatchObject({
    clientPhone: '0611111111',
    onsiteContact: 'Marc 0622222222',
    eventLocation: 'Salle des fêtes, Troyes',
    guestCount: 40, adults: 35, children: 5,
    otherLines: ['Location de verres'],
  });
  expect(event.teamArrivalTime?.slice(0, 5)).toBe('16:30');
  expect(event.steps.map((s) => s.label)).toEqual(['Mise en place', 'Cocktail']);
  expect(event.team).toEqual([{ name: 'Paul', role: 'Serveur', phone: '0600000000', arrival: '16:30', departure: '23:00' }]);
  expect(event.dishes).toEqual([{ name: 'Tarte maison', toProduce: 40, allergens: ['Œufs', 'Lait'] }]);
});

it('montre la journée de l’entreprise à un collaborateur, jamais celle d’une autre entreprise', async () => {
  current = COLLEAGUE;
  const mine = await getDayView();
  expect(mine.days.flatMap((d) => d.events.map((e) => e.clientName))).toEqual(['Dupont', 'Martin']);

  current = OTHER;
  const other = await getDayView();
  expect(other.accountId).toBe(OTHER);
  expect(other.days[0].events.map((e) => e.clientName)).toEqual(['Autre entreprise']);
  expect(other.days[1].events).toEqual([]);
});
