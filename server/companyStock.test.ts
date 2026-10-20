// Stock propre à chaque entreprise (migration 0024), joué sur le vrai schéma en mémoire.
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '@/db/testDb';

const A = '00000000-0000-4000-8000-00000000b001';   // entreprise A (titulaire)
const AM = '00000000-0000-4000-8000-00000000b002';  // collaborateur de A
const B = '00000000-0000-4000-8000-00000000b003';   // entreprise B
const BUTTER = '00000000-0000-4000-8000-00000000c001'; // ingrédient du catalogue commun
let pg: PGlite;

const stock = async (company: string, ing = BUTTER) =>
  Number((await pg.query<{ q: string }>(`select quantity::text as q from ingredient_stocks where company_id = $1 and ingredient_id = $2`, [company, ing])).rows[0]?.q ?? NaN);
const move = (user: string, type: string, qty: number, ing = BUTTER) =>
  pg.query(`insert into stock_movements (user_id, ingredient_id, movement_type, quantity) values ($1, $2, $3, $4)`, [user, ing, type, qty]);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${AM}', 'am@t.fr', 'x'), ('${B}', 'b@t.fr', 'x');
    insert into profiles (id, email) values ('${A}', 'a@t.fr'), ('${B}', 'b@t.fr');
    insert into profiles (id, email, parent_user_id) values ('${AM}', 'am@t.fr', '${A}');
    insert into ingredients (id, name, user_id, unit) values ('${BUTTER}', 'Beurre', null, 'kg');
  `);
});

describe('stock par entreprise', () => {
  it('un ingrédient commun a un stock distinct dans chaque entreprise', async () => {
    await move(A, 'in', 10);
    await move(B, 'in', 3);
    await move(AM, 'out', 4); // le collaborateur sort du stock de son entreprise
    expect(await stock(A)).toBe(6);
    expect(await stock(B)).toBe(3);
    expect(await stock(AM)).toBeNaN(); // pas de stock au nom du collaborateur
  });

  it('un inventaire remet la quantité à la valeur comptée', async () => {
    await move(B, 'adjust', 12);
    expect(await stock(B)).toBe(12);
  });

  it('prévient sous le seuil de l’entreprise', async () => {
    await pg.query(`update ingredient_stocks set min_alert = 5 where company_id = $1 and ingredient_id = $2`, [A, BUTTER]);
    await move(A, 'out', 2);
    const { rows } = await pg.query(`select title from notifications where user_id = $1 and type = 'stock_alert'`, [A]);
    expect(rows).toEqual([{ title: 'Stock bas : Beurre' }]);
  });
});

describe('reprise des stocks existants', () => {
  it('recalcule chaque entreprise depuis ses mouvements, et garde le stock des ingrédients propres', async () => {
    const db2 = await createTestDb();
    const before = fs.readFileSync(path.join(__dirname, '../db/migrations/0024_company_stock.sql'), 'utf8').split('--> statement-breakpoint');
    // On rejoue la reprise sur des données « d'avant » : mouvements et stocks posés sans le nouveau déclencheur.
    await db2.exec(`
      drop trigger trg_apply_stock_movement on stock_movements; drop trigger trg_check_stock_alert on stock_movements;
      delete from ingredient_stocks;
      insert into users (id, email, password_hash) values ('${A}', 'a@t.fr', 'x'), ('${B}', 'b@t.fr', 'x');
      insert into profiles (id, email) values ('${A}', 'a@t.fr'), ('${B}', 'b@t.fr');
      insert into ingredients (id, name, user_id) values ('${BUTTER}', 'Beurre', null);
      insert into ingredients (id, name, user_id, stock_quantity, min_stock_alert) values ('00000000-0000-4000-8000-00000000c002', 'Crème maison', '${A}', 7, 2);
      insert into stock_movements (user_id, ingredient_id, movement_type, quantity, created_at) values
        ('${A}', '${BUTTER}', 'in', 10, '2026-01-01'), ('${A}', '${BUTTER}', 'adjust', 4, '2026-02-01'), ('${A}', '${BUTTER}', 'in', 1, '2026-03-01'),
        ('${B}', '${BUTTER}', 'in', 5, '2026-01-01'), ('${B}', '${BUTTER}', 'out', 2, '2026-01-02');
    `);
    for (const st of before.slice(-2)) await db2.exec(st);
    const q = async (c: string, i: string) => (await db2.query<{ quantity: string; min_alert: string }>(`select quantity::text, min_alert::text from ingredient_stocks where company_id = $1 and ingredient_id = $2`, [c, i])).rows[0];
    expect(await q(A, BUTTER)).toEqual({ quantity: '5', min_alert: '0' });
    expect(await q(B, BUTTER)).toEqual({ quantity: '3', min_alert: '0' });
    expect(await q(A, '00000000-0000-4000-8000-00000000c002')).toEqual({ quantity: '7', min_alert: '2' });
  });
});
