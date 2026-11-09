import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Réécriture d'un texte de brochure par Webo : une pièce, rendue si Claude échoue ; Claude est simulé.

vi.mock('server-only', () => ({}));
const OWNER = '00000000-0000-4000-8000-0000000000e1';
const READER = '00000000-0000-4000-8000-0000000000e2';
let current = OWNER;
vi.mock('./session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));
let broken = false;
vi.mock('@/lib/webo/claude', () => ({
  WEBO_MODEL: 'claude-haiku-5-5',
  weboAvailable: () => true,
  REWRITE_MODES: { fix: { label: 'Corriger', instruction: '' }, shorten: { label: 'Raccourcir', instruction: '' } },
  rewriteBrochureText: async (html: string) => {
    if (broken) throw Object.assign(new Error('panne'), { usage: { input: 100, output: 10, cacheWrite: 0, cacheRead: 0 } });
    return { html: `${html.replace('Bonjour', 'Bonjour !')}<script>x()</script>`, usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  },
}));
const w = await import('./weboRewrite');
const debits = async () => (await pg.query<{ n: string; refunded: string }>(`select count(*) filter (where kind = 'debit') n, count(*) filter (where kind = 'refund') refunded from webo_ledger`)).rows[0];

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${OWNER}', 'o@t.fr', 'x'), ('${READER}', 'r@t.fr', 'x');
    insert into profiles (id, email) values ('${OWNER}', 'o@t.fr');
    insert into profiles (id, email, parent_user_id, company_role) values ('${READER}', 'r@t.fr', '${OWNER}', 'lecture');
  `);
});
beforeEach(async () => { current = OWNER; broken = false; await pg.exec(`delete from webo_ledger; delete from webo_wallets;`); });

describe('Webo réécrit un texte de brochure', () => {
  it('réécrit, nettoie le HTML, débite une pièce', async () => {
    const r = await w.rewriteWithWebo({ html: '<p>Bonjour</p>', mode: 'fix', requestId: 'r1' });
    expect(r).toMatchObject({ html: '<p>Bonjour !</p>' });
    expect(Number((await debits()).n)).toBe(1);
    // Même demande rejouée : rien de plus.
    expect(await w.rewriteWithWebo({ html: '<p>Bonjour</p>', mode: 'fix', requestId: 'r1' })).toEqual({ error: 'Demande déjà traitée.' });
  });

  it('rend la pièce si Claude échoue ; refuse le vide, l’inconnu et la lecture seule', async () => {
    broken = true;
    expect('error' in await w.rewriteWithWebo({ html: '<p>Bonjour</p>', mode: 'shorten', requestId: 'r2' })).toBe(true);
    expect(Number((await debits()).refunded)).toBe(1);
    expect(await w.rewriteWithWebo({ html: '<p> </p>', mode: 'fix', requestId: 'r3' })).toEqual({ error: 'Le texte est vide.' });
    expect(await w.rewriteWithWebo({ html: '<p>x</p>', mode: 'poeme' as never, requestId: 'r4' })).toEqual({ error: 'Demande inconnue.' });
    current = READER;
    expect(await w.rewriteWithWebo({ html: '<p>x</p>', mode: 'fix', requestId: 'r5' })).toEqual({ error: 'Votre accès est en lecture seule.' });
  });
});
