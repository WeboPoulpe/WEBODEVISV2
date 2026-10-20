// Isolation entre comptes dans la couche /api/db, testée sur un vrai Postgres en mémoire (PGlite).
// Chaque cas reprend une attaque relevée à l'audit du 2026-10-19.
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { QueryDescriptor } from '@/lib/compat/builder';

vi.mock('server-only', () => ({}));

const pg = new PGlite();
vi.mock('@/db', () => {
  const query = async (sql: string, values?: unknown[]) => {
    const r = await pg.query(sql, values);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  return { pool: { query, connect: async () => ({ query, release: () => {} }) } };
});

const { executeQuery } = await import('./execute');

const ME = '00000000-0000-4000-8000-00000000000a';
const VICTIM = '00000000-0000-4000-8000-00000000000b';
const VICTIM_QUOTE = '00000000-0000-4000-8000-0000000000c1';
const VICTIM_CUSTOMER = '00000000-0000-4000-8000-0000000000c2';
const VICTIM_PRESTATION = '00000000-0000-4000-8000-0000000000c3';
const MY_PRESTATION = '00000000-0000-4000-8000-0000000000a3';
const GLOBAL_INGREDIENT = '00000000-0000-4000-8000-0000000000d1';
const MY_EXTRA = '00000000-0000-4000-8000-0000000000a4';
const MY_QUOTE = '00000000-0000-4000-8000-0000000000a5';
const MEMBER = '00000000-0000-4000-8000-0000000000a6';   // collaborateur rattaché à ME
const READER = '00000000-0000-4000-8000-0000000000a7';   // rattaché à ME, en consultation seule

const run = (d: Partial<QueryDescriptor> & Pick<QueryDescriptor, 'table' | 'op'>, uid = ME) =>
  executeQuery({ filters: [], order: [], returning: true, select: '*', ...d } as QueryDescriptor, { uid });

beforeAll(async () => {
  await pg.exec(`
    create table profiles (id uuid primary key, parent_user_id uuid, role text default 'user', company_role text default 'gerant');
    create table quotes (id uuid primary key default gen_random_uuid(), user_id uuid, owner_user_id uuid, status text);
    create table customers (id uuid primary key default gen_random_uuid(), owner_user_id uuid, name text);
    create table user_prospect_tokens (id uuid primary key default gen_random_uuid(), user_id uuid not null, token text unique not null, is_active boolean default true);
    create table ingredients (id uuid primary key default gen_random_uuid(), user_id uuid, name text);
    create table prestations (id uuid primary key default gen_random_uuid(), user_id uuid, name text);
    create table service_ingredients (id uuid primary key default gen_random_uuid(), user_id uuid not null, service_id uuid not null, ingredient_id uuid not null);
    create table extras (id uuid primary key default gen_random_uuid(), user_id uuid not null);
    create table event_extras (id uuid primary key default gen_random_uuid(), quote_id uuid not null, extra_id uuid not null);
    create table supplier_orders (id uuid primary key default gen_random_uuid(), user_id uuid not null);
    create table stock_movements (id uuid primary key default gen_random_uuid(), user_id uuid not null, ingredient_id uuid not null, quantity numeric, event_id uuid, order_id uuid);

    insert into profiles (id) values ('${ME}'), ('${VICTIM}');
    insert into profiles (id, parent_user_id, company_role) values ('${MEMBER}', '${ME}', 'collaborateur'), ('${READER}', '${ME}', 'lecture');
    insert into quotes values ('${VICTIM_QUOTE}', '${VICTIM}', '${VICTIM}', 'valide'), ('${MY_QUOTE}', '${ME}', '${ME}', 'valide');
    insert into customers values ('${VICTIM_CUSTOMER}', '${VICTIM}', 'Client de la victime');
    insert into user_prospect_tokens (user_id, token) values ('${VICTIM}', 'jeton-public-victime');
    insert into ingredients values ('${GLOBAL_INGREDIENT}', null, 'Beurre');
    insert into prestations values ('${VICTIM_PRESTATION}', '${VICTIM}', 'Plat victime'), ('${MY_PRESTATION}', '${ME}', 'Mon plat');
    insert into extras values ('${MY_EXTRA}', '${ME}');
  `);
});

const owner = async (table: string, col: string, id: string, key = 'id') =>
  (await pg.query<Record<string, string>>(`select ${col} from ${table} where ${key} = $1`, [id])).rows[0]?.[col];

describe('upsert sur une ligne existante d’un autre compte', () => {
  it('ne prend pas le jeton du formulaire prospect d’un autre traiteur', async () => {
    await run({ table: 'user_prospect_tokens', op: 'upsert', onConflict: 'token', values: { token: 'jeton-public-victime', user_id: ME } });
    expect(await owner('user_prospect_tokens', 'user_id', 'jeton-public-victime', 'token')).toBe(VICTIM);
  });

  it('ne s’approprie pas un ingrédient commun', async () => {
    await run({ table: 'ingredients', op: 'upsert', values: { id: GLOBAL_INGREDIENT, user_id: ME, name: 'pris' } });
    expect(await owner('ingredients', 'user_id', GLOBAL_INGREDIENT)).toBeNull();
    expect(await owner('ingredients', 'name', GLOBAL_INGREDIENT)).toBe('Beurre');
  });

  it('ne réattribue pas le client d’un autre compte', async () => {
    await run({ table: 'customers', op: 'upsert', values: { id: VICTIM_CUSTOMER, owner_user_id: ME, name: 'x' } });
    expect(await owner('customers', 'owner_user_id', VICTIM_CUSTOMER)).toBe(VICTIM);
  });

  it('crée toujours une nouvelle ligne et met à jour ses propres lignes', async () => {
    const created = await run({ table: 'customers', op: 'upsert', values: { owner_user_id: ME, name: 'Mon client' } });
    expect(created.error).toBeNull();
    const id = (created.data as { id: string }[])[0].id;
    const updated = await run({ table: 'customers', op: 'upsert', values: { id, owner_user_id: ME, name: 'Renommé' } });
    expect(updated.error).toBeNull();
    expect(await owner('customers', 'name', id)).toBe('Renommé');
  });
});

describe('liens vers les lignes d’un autre compte', () => {
  it('refuse un devis glissé dans le compte d’un autre', async () => {
    const r = await run({ table: 'quotes', op: 'insert', values: { user_id: ME, owner_user_id: VICTIM, status: 'brouillon' } });
    expect(r.error?.code).toBe('42501');
  });

  it('accepte un devis dans son propre compte', async () => {
    const r = await run({ table: 'quotes', op: 'insert', values: { user_id: ME, owner_user_id: ME, status: 'brouillon' } });
    expect(r.error).toBeNull();
  });

  it('refuse de rattacher son extra au devis d’un autre compte', async () => {
    const r = await run({ table: 'event_extras', op: 'insert', values: { quote_id: VICTIM_QUOTE, extra_id: MY_EXTRA } });
    expect(r.error?.code).toBe('42501');
  });

  it('accepte de rattacher son extra à son propre devis', async () => {
    const r = await run({ table: 'event_extras', op: 'insert', values: { quote_id: MY_QUOTE, extra_id: MY_EXTRA } });
    expect(r.error).toBeNull();
  });

  it('refuse une ligne de recette sur la prestation d’un autre compte', async () => {
    const r = await run({ table: 'service_ingredients', op: 'insert', values: { user_id: ME, service_id: VICTIM_PRESTATION, ingredient_id: GLOBAL_INGREDIENT } });
    expect(r.error?.code).toBe('42501');
  });

  it('accepte une ligne de recette sur sa prestation avec un ingrédient commun', async () => {
    const r = await run({ table: 'service_ingredients', op: 'insert', values: { user_id: ME, service_id: MY_PRESTATION, ingredient_id: GLOBAL_INGREDIENT } });
    expect(r.error).toBeNull();
  });

  it('refuse un mouvement de stock rattaché à l’événement d’un autre compte', async () => {
    const r = await run({ table: 'stock_movements', op: 'insert', values: { user_id: ME, ingredient_id: GLOBAL_INGREDIENT, quantity: 1, event_id: VICTIM_QUOTE } });
    expect(r.error?.code).toBe('42501');
  });

  it('accepte un mouvement de stock simple', async () => {
    const r = await run({ table: 'stock_movements', op: 'insert', values: { user_id: ME, ingredient_id: GLOBAL_INGREDIENT, quantity: 1 } });
    expect(r.error).toBeNull();
  });
});

describe('collaborateurs d’une même entreprise', () => {
  it('le collaborateur voit et modifie le catalogue du titulaire', async () => {
    const r = await run({ table: 'prestations', op: 'select', select: 'id, name' }, MEMBER);
    expect((r.data as { id: string }[]).map((p) => p.id)).toContain(MY_PRESTATION);
    expect((r.data as { id: string }[]).map((p) => p.id)).not.toContain(VICTIM_PRESTATION);
    const u = await run({ table: 'prestations', op: 'update', values: { name: 'Mon plat (modifié)' }, filters: [{ kind: 'cmp', column: 'id', op: 'eq', value: MY_PRESTATION, negate: false }] }, MEMBER);
    expect(u.error).toBeNull();
    expect((u.data as unknown[]).length).toBe(1);
  });

  it('le titulaire voit ce que crée son collaborateur', async () => {
    const c = await run({ table: 'extras', op: 'insert', values: { user_id: MEMBER } }, MEMBER);
    expect(c.error).toBeNull();
    const id = (c.data as { id: string }[])[0].id;
    const r = await run({ table: 'extras', op: 'select', select: 'id' }, ME);
    expect((r.data as { id: string }[]).map((e) => e.id)).toContain(id);
  });

  it('un collaborateur ne voit rien d’une autre entreprise', async () => {
    const r = await run({ table: 'customers', op: 'select', select: 'id' }, MEMBER);
    expect((r.data as { id: string }[]).map((c) => c.id)).not.toContain(VICTIM_CUSTOMER);
    const w = await run({ table: 'prestations', op: 'insert', values: { user_id: VICTIM, name: 'x' } }, MEMBER);
    expect(w.error?.code).toBe('42501');
  });

  it('un compte en consultation lit mais n’écrit pas', async () => {
    const r = await run({ table: 'prestations', op: 'select', select: 'id' }, READER);
    expect((r.data as { id: string }[]).map((p) => p.id)).toContain(MY_PRESTATION);
    const w = await run({ table: 'prestations', op: 'insert', values: { user_id: READER, name: 'x' } }, READER);
    expect(w.error?.message).toMatch(/consultation/);
  });
});
