import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

// Traduction par Webo : une pièce par fiche, rendue si Claude échoue ; Claude est simulé.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000f1';
const READER = '00000000-0000-4000-8000-0000000000f2';
let current = OWNER;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));
const fail = new Set<string>();
let answer = (f: { name: string; html: string }) => ({ name: `EN ${f.name}`, html: f.html.replace('Bonjour', 'Hello') });
vi.mock('@/lib/webo/claude', () => ({
  WEBO_MODEL: 'claude-haiku-5-5',
  weboAvailable: () => true,
  translateFicheFrToEn: async (f: { name: string; html: string }) => {
    if (fail.has(f.name)) throw new Error('panne');
    return { ...answer(f), usage: { input: 4000, output: 2000, cacheWrite: 0, cacheRead: 0 } };
  },
}));

const t = await import('./weboTranslate');
const fiche = (n: number) => ({ key: `k${n}`, requestId: `req-${n}-${Math.random()}`, name: `Plat ${n}`, html: '<p>Bonjour</p>' });
const setCoins = (month: number, kept = 0) => pg.query(`update webo_wallets set month_coins = $1, kept_coins = $2`, [month, kept]);
const debits = async () => Number((await pg.query<{ n: string }>(`select count(*) n from webo_ledger where kind = 'debit'`)).rows[0].n);

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@t.fr', 'x'), ('${READER}', 'r@t.fr', 'x'), ('${DEMO_USER_ID}', 'demo@t.fr', 'x');
    insert into profiles (id, email) values ('${OWNER}', 'o@t.fr'), ('${DEMO_USER_ID}', 'demo@t.fr');
    insert into profiles (id, email, parent_user_id, company_role) values ('${READER}', 'r@t.fr', '${OWNER}', 'lecture');
  `);
});
beforeEach(async () => {
  await pg.exec(`delete from webo_ledger; delete from webo_wallets; delete from app_settings where key like 'webo_%';`);
  current = OWNER;
  fail.clear();
  answer = (f) => ({ name: `EN ${f.name}`, html: f.html.replace('Bonjour', 'Hello') });
});

describe('traduction par Webo', () => {
  it('3 fiches, 2 pièces : 2 par Webo, la 3e en gratuit (balance) ; solde 0', async () => {
    await t.translateWithWebo([]);
    await setCoins(2);
    const r = await t.translateWithWebo([fiche(1), fiche(2), fiche(3)]);
    expect(r.results.map((x) => (x.ok ? 'ok' : x.why))).toEqual(['ok', 'ok', 'balance']);
    expect(r.results[0]).toMatchObject({ key: 'k1', ok: true, name: 'EN Plat 1', html: '<p>Hello</p>' });
    expect(r).toMatchObject({ spent: 2, balance: 0 });
  });

  it('Claude échoue sur une fiche : pièce rendue, fiche en error, les autres traduites', async () => {
    fail.add('Plat 2');
    const r = await t.translateWithWebo([fiche(1), fiche(2), fiche(3)]);
    expect(r.results.map((x) => (x.ok ? 'ok' : x.why))).toEqual(['ok', 'error', 'ok']);
    expect(r).toMatchObject({ spent: 2, balance: 198 });
  });

  it('HTML renvoyé piégé : nettoyé', async () => {
    answer = () => ({ name: '<b>Menu</b>', html: '<p onclick="x()">Hi</p><script>a()</script>' });
    const [res] = (await t.translateWithWebo([fiche(1)])).results;
    if (!res.ok) throw new Error('attendu ok');
    expect(res.html).toContain('<p>Hi</p>');
    expect(res.html).not.toMatch(/script|onclick/);
    expect(res.name).toBe('Menu');
  });

  it('même requestId rejoué : un seul débit', async () => {
    const f = fiche(1);
    await t.translateWithWebo([f]);
    await t.translateWithWebo([f]);
    expect(await debits()).toBe(1);
  });

  it('plafond du mois atteint : cap, rien débité', async () => {
    await pg.exec(`insert into app_settings (key, value) values ('webo_translation_cap', '1'::jsonb)`);
    const r = await t.translateWithWebo([fiche(1), fiche(2)]);
    expect(r.results.map((x) => (x.ok ? 'ok' : x.why))).toEqual(['ok', 'cap']);
    expect(await debits()).toBe(1);
  });

  it('lecture seule, démo : rien débité', async () => {
    current = READER;
    expect((await t.translateWithWebo([fiche(1)])).results[0]).toMatchObject({ ok: false, why: 'readonly' });
    current = DEMO_USER_ID;
    expect((await t.translateWithWebo([fiche(2)])).results[0]).toMatchObject({ ok: false, why: 'demo' });
    expect(await debits()).toBe(0);
  });

  it('coût réel noté au journal', async () => {
    await t.translateWithWebo([fiche(1)]);
    const [row] = (await pg.query<{ model: string; input_tokens: number; output_tokens: number; cost_usd: string; reason: string }>(
      `select model, input_tokens, output_tokens, cost_usd, reason from webo_ledger where kind = 'debit'`)).rows;
    expect(row).toMatchObject({ model: 'claude-haiku-5-5', input_tokens: 4000, output_tokens: 2000, reason: 'Traduction : Plat 1' });
    expect(Number(row.cost_usd)).toBeCloseTo(0.0014, 6);
  });
});
