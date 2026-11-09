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
  getSessionUser: async () => null,
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));
let broken = false;
const calls: number[] = [];
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
vi.mock('@/lib/webo/claude', () => ({
  WEBO_MODEL: 'claude-haiku-5-5',
  weboAvailable: () => true,
  REWRITE_MODES: { fix: { label: 'Corriger', instruction: '' }, shorten: { label: 'Raccourcir', instruction: '' } },
  designCover: async (i: { templates: string[]; themes: string[]; photos: string[] }) => {
    if (broken) throw Object.assign(new Error('panne'), { usage: { input: 10, output: 1, cacheWrite: 0, cacheRead: 0 } });
    return { idea: { template: i.templates[1], theme: i.themes[1], title: 'Un jour unique', subtitle: 'Mariages 2027', photo: 0 }, usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  },
  translateTexts: async (texts: string[]) => {
    calls.push(texts.length);
    if (broken) throw Object.assign(new Error('panne'), { usage: { input: 10, output: 1, cacheWrite: 0, cacheRead: 0 } });
    return { texts: texts.map((t) => t.replace('Bonjour', 'Hello').replace('Menu', 'Menu EN')), usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  },
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

describe('Webo : couverture et version anglaise', () => {
  it('couverture : mise en page, thème, titres et une photo de l’entreprise ; une pièce', async () => {
    const br = await import('./brochures');
    const { id } = await br.createBrochure({ name: 'Couverture', editor: 'studio' });
    await br.saveBrochure(id!, { cover: { title: 'Couverture', photoUrl: 'https://x.test/c.jpg' } });
    const r = await w.designCoverWithWebo({ description: 'mariage champêtre', language: 'fr', requestId: 'c1' });
    expect(r).toMatchObject({ templateId: 'cover-elegant', themeName: 'Noir et or', title: 'Un jour unique', photoUrl: 'https://x.test/c.jpg' });
    expect(Number((await debits()).n)).toBe(1);
    expect(await w.designCoverWithWebo({ description: 'x', language: 'fr', requestId: 'c2' })).toMatchObject({ error: expect.stringMatching(/Décrivez/) });
  });

  it('version anglaise : une copie en anglais, textes traduits par lots, mise en page gardée ; rien si Claude échoue', async () => {
    const br = await import('./brochures');
    const { id } = await br.createBrochure({ name: 'Carte', editor: 'studio' });
    const els = Array.from({ length: 35 }, (_, i) => ({ id: `t${i}`, type: 'text', html: `<p>Bonjour ${i}</p>`, x: 1, y: i, w: 50 }));
    await br.saveBrochure(id!, { studio: { pages: [{ id: 'a', els }] } });
    calls.length = 0;
    const before = Number((await debits()).n);
    const r = await w.createEnglishVersion(id!, 'en1');
    expect('id' in r).toBe(true);
    // 35 textes de la page, plus le titre de la page du formulaire.
    expect(calls).toEqual([30, 6]);
    const row = (await pg.query<{ name: string; language: string; editor_mode: string; studio: { pages: { els: { html: string; y: number }[] }[] } }>(`select name, language, editor_mode, studio from brochures where id = $1`, [(r as { id: string }).id])).rows[0];
    expect(row).toMatchObject({ name: 'Carte (EN)', language: 'en', editor_mode: 'studio' });
    expect(row.studio.pages[0].els[3]).toMatchObject({ html: '<p>Hello 3</p>', y: 3 });
    expect(Number((await debits()).n)).toBe(before + 1);
    broken = true;
    expect(await w.createEnglishVersion(id!, 'en2')).toMatchObject({ error: expect.stringMatching(/rendus/) });
    broken = false;
    const { rows } = await pg.query(`select 1 from brochures where name = 'Carte (EN)'`);
    expect(rows).toHaveLength(1);
  });
});
