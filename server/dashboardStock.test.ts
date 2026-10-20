// Stock bas du tableau de bord et de l'aperçu du menu : stock et seuils de l'entreprise (ingredient_stocks),
// catalogue commun compris, jamais ceux d'une autre entreprise. Sur le vrai schéma en mémoire.
import { drizzle } from 'drizzle-orm/pglite';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

vi.mock('server-only', () => ({}));

const A = '00000000-0000-4000-8000-0000000001a1';   // titulaire de l'entreprise A
const AM = '00000000-0000-4000-8000-0000000001a2';  // collaborateur de A
const B = '00000000-0000-4000-8000-0000000001b1';   // autre entreprise
let current = A;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));

let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const { getDashboard } = await import('./dashboard');
const { getNavPreview } = await import('./navPreview');
const TODAY = '2026-10-20';

const FLOUR = '00000000-0000-4000-8000-0000000001c1';  // catalogue commun
const CREAM = '00000000-0000-4000-8000-0000000001c2';  // à A
const SALT = '00000000-0000-4000-8000-0000000001c3';   // à A, au-dessus du seuil
const EGGS = '00000000-0000-4000-8000-0000000001c4';   // à B

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${AM}', 'am@t.fr', 'x'), ('${B}', 'b@t.fr', 'x');
    insert into profiles (id, email) values ('${A}', 'a@t.fr'), ('${B}', 'b@t.fr');
    insert into profiles (id, email, parent_user_id) values ('${AM}', 'am@t.fr', '${A}');
    insert into ingredients (id, name, user_id, unit) values
      ('${FLOUR}', 'Farine', null, 'kg'), ('${CREAM}', 'Crème', '${A}', 'l'),
      ('${SALT}', 'Sel', '${A}', 'kg'), ('${EGGS}', 'Œufs', '${B}', 'pièce');
    insert into ingredient_stocks (company_id, ingredient_id, quantity, min_alert) values
      ('${A}', '${FLOUR}', 2, 5),   -- bas
      ('${A}', '${CREAM}', 0, 1),   -- épuisé
      ('${A}', '${SALT}', 9, 3),    -- au-dessus du seuil
      ('${B}', '${FLOUR}', 1, 10),  -- bas, mais chez B
      ('${B}', '${EGGS}', 0, 6);    -- bas, chez B
    -- Anciennes colonnes : ne doivent plus compter.
    update ingredients set stock_quantity = 0, min_stock_alert = 100 where id = '${SALT}';
  `);
});

beforeEach(() => { current = A; });

const stockTodo = async () => (await getDashboard(TODAY)).todo.find((t) => t.kind === 'stock');

describe('stock bas de l’entreprise', () => {
  it('le tableau de bord compte le stock de l’entreprise, catalogue commun compris', async () => {
    const todo = await stockTodo();
    expect(todo?.title).toBe('Stock bas : 2 ingrédients sous le seuil d’alerte');
    expect(todo?.detail).toBe('Crème, Farine');
  });

  it('un collaborateur voit le stock de son entreprise', async () => {
    current = AM;
    expect((await stockTodo())?.detail).toBe('Crème, Farine');
  });

  it('une autre entreprise ne voit que le sien', async () => {
    current = B;
    expect((await stockTodo())?.detail).toBe('Farine, Œufs');
  });

  it('l’aperçu du menu Stock reprend les mêmes ingrédients, les plus bas d’abord', async () => {
    const preview = await getNavPreview('stock', TODAY);
    expect(preview?.items.map((i) => i.label)).toEqual(['Crème', 'Farine']);
    expect(preview?.items[0].detail).toBe('Reste 0 l, seuil 1 l');
    expect(preview?.items[0].tag?.text).toBe('Épuisé');
    expect(preview?.stats?.[0].value).toBe(2);
  });
});
