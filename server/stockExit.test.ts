// Sortie de stock d'un événement, sur le vrai schéma en mémoire (déclencheur apply_stock_movement compris).
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-0000000000d1';
const OTHER = '00000000-0000-4000-8000-0000000000d2';
let current = ME;
vi.mock('./session', () => ({ requireUser: async () => ({ id: current, email: 'x@y.fr' }), requireWriter: async () => ({ id: current, email: 'x@y.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); } }));

const { getEventStockExit, withdrawEventStock, cancelEventStockExit } = await import('./stockExit');

const FLOUR = '00000000-0000-4000-8000-0000000000e1'; // catalogue commun
const BUTTER = '00000000-0000-4000-8000-0000000000e2'; // à moi
const FOREIGN = '00000000-0000-4000-8000-0000000000e3'; // à un autre compte : pas suivi ici
let quoteId = '';
let emptyQuote = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'a@t.fr', 'x'), ('${OTHER}', 'b@t.fr', 'x');
    insert into profiles (id, email) values ('${ME}', 'a@t.fr'), ('${OTHER}', 'b@t.fr');
    insert into ingredients (id, name, user_id, unit) values
      ('${FLOUR}', 'Farine', null, 'kg'),
      ('${BUTTER}', 'Beurre', '${ME}', 'kg'),
      ('${FOREIGN}', 'Sel', '${OTHER}', 'kg');
    -- Le stock est propre à chaque entreprise : l'autre compte a aussi de la farine, qui ne doit pas bouger.
    insert into ingredient_stocks (company_id, ingredient_id, quantity) values
      ('${ME}', '${FLOUR}', 10), ('${ME}', '${BUTTER}', 1), ('${OTHER}', '${FOREIGN}', 5), ('${OTHER}', '${FLOUR}', 50);
  `);
  const { rows } = await pg.query<{ id: string }>(`
    insert into quotes (owner_user_id, user_id, client_name, event_date, event_type, guest_count, status)
    values ($1, $1, 'Dupont', '2026-12-12', 'Mariage', 40, 'valide'), ($1, $1, 'Vide', '2026-11-01', 'Cocktail', 10, 'valide') returning id`, [ME]);
  [quoteId, emptyQuote] = rows.map((r) => r.id);
  await pg.query(`
    insert into event_ingredients (quote_id, ingredient_id, quantity, source) values
      ($1, '${FLOUR}', 2.5, 'auto'), ($1, '${FLOUR}', 0.5, 'manuelle'), ($1, '${BUTTER}', 2, 'auto'), ($1, '${FOREIGN}', 1, 'manuelle')`, [quoteId]);
});

beforeEach(() => { current = ME; });

const stock = async (id: string, company = ME) => Number((await pg.query<{ s: string }>(
  `select quantity as s from ingredient_stocks where company_id = $1 and ingredient_id = $2`, [company, id])).rows[0]?.s ?? 0);

it('refuse l’événement d’un autre compte', async () => {
  current = OTHER;
  expect((await withdrawEventStock(quoteId)).error).toBe('Événement introuvable.');
  expect((await cancelEventStockExit(quoteId)).error).toBe('Événement introuvable.');
  expect((await getEventStockExit(quoteId)).error).toBe('Événement introuvable.');
  expect(await stock(FLOUR)).toBe(10);
});

it('ne retire rien quand la liste ne contient aucun ingrédient suivi', async () => {
  expect((await withdrawEventStock(emptyQuote)).error).toMatch(/aucun ingrédient/);
});

it('retire les quantités de la liste de courses, une seule fois', async () => {
  expect((await getEventStockExit(quoteId)).withdrawnAt).toBeNull();
  const res = await withdrawEventStock(quoteId);
  expect(res.error).toBeNull();
  expect(res.count).toBe(2);
  expect(res.shortages).toEqual(['Beurre']);
  expect(res.withdrawnAt).not.toBeNull();
  expect(await stock(FLOUR)).toBe(7);
  expect(await stock(BUTTER)).toBe(-1);
  expect(await stock(FOREIGN, OTHER)).toBe(5);
  expect(await stock(FLOUR, OTHER)).toBe(50);

  const { rows } = await pg.query<{ reason: string; event_id: string; user_id: string }>(
    `select reason, event_id, user_id from stock_movements where movement_type = 'out'`);
  expect(rows).toHaveLength(2);
  expect(rows.every((r) => r.reason === 'Événement Mariage du 12/12/2026' && r.event_id === quoteId && r.user_id === ME)).toBe(true);

  expect((await getEventStockExit(quoteId)).withdrawnAt).toBe(res.withdrawnAt);
  expect((await withdrawEventStock(quoteId)).error).toMatch(/déjà retiré/);
  expect(await stock(FLOUR)).toBe(7);
});

it('annule la sortie par des entrées inverses, puis permet une nouvelle sortie', async () => {
  const res = await cancelEventStockExit(quoteId);
  expect(res.error).toBeNull();
  expect(res.count).toBe(2);
  expect(await stock(FLOUR)).toBe(10);
  expect(await stock(BUTTER)).toBe(1);
  expect((await getEventStockExit(quoteId)).withdrawnAt).toBeNull();
  expect((await cancelEventStockExit(quoteId)).error).toMatch(/n’est pas retiré/);

  // Nouvelle sortie après annulation : seule la dernière est annulable.
  expect((await withdrawEventStock(quoteId)).error).toBeNull();
  expect(await stock(FLOUR)).toBe(7);
  expect((await cancelEventStockExit(quoteId)).error).toBeNull();
  expect(await stock(FLOUR)).toBe(10);
  expect(await stock(BUTTER)).toBe(1);
});
