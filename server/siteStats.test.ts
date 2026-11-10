import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Statistiques du site : écriture par paquets (pour ne pas réveiller la base à chaque page) et chiffres de l'admin.

vi.mock('server-only', () => ({}));
vi.mock('./session', () => ({ requireAdmin: async () => ({ id: 'a', email: 'a@w.fr' }) }));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const s = await import('./siteStats');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0';
const ctx = (ip = '1.1.1.1', userAgent = UA) => ({ ip, userAgent, ownHost: 'webodevis.fr' });
const stored = async () => (await pg.query<{ n: number }>('select count(*)::int as n from site_visits')).rows[0].n;

beforeAll(async () => { pg = await createTestDb(); });
beforeEach(async () => {
  await pg.exec('delete from site_visits;');
  s.testOnlyResetBuffer();
});

describe('écriture par paquets', () => {
  it('n’écrit rien avant 100 visites, puis tout en une fois', async () => {
    const t0 = Date.now();
    for (let i = 0; i < s.FLUSH_COUNT - 1; i++) await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx(`ip${i}`))!, t0);
    expect(await stored()).toBe(0);
    await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx('last'))!, t0);
    expect(await stored()).toBe(s.FLUSH_COUNT);
  });

  it('écrit un petit paquet quand la plus ancienne visite attend depuis une heure', async () => {
    const t0 = Date.now();
    await s.recordHit(s.buildRow({ path: '/' }, ctx())!, t0);
    await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx())!, t0 + 60_000);
    expect(await stored()).toBe(0);
    await s.recordHit(s.buildRow({ path: '/contact' }, ctx())!, t0 + s.FLUSH_AGE_MS);
    expect(await stored()).toBe(3);
  });

  it('ignore les robots et les chemins invalides', () => {
    expect(s.buildRow({ path: '/' }, ctx('x', 'Googlebot/2.1'))).toBeNull();
    expect(s.buildRow({ path: 'https://ailleurs.fr' }, ctx())).toBeNull();
  });

  it('une conversion côté serveur écrit tout de suite, avec le paquet en attente', async () => {
    await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx())!);
    await s.recordEventNow('contact', '/contact', ctx());
    expect(await stored()).toBe(2);
  });

  it('ne garde ni l’adresse IP ni le chemin du site précédent', () => {
    const row = s.buildRow({ path: '/', referrer: 'https://www.google.fr/search?q=logiciel+traiteur' }, ctx('203.0.113.7'))!;
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');
    expect(row.referrer_host).toBe('google.fr');
    expect(row.source).toBe('recherche');
  });
});

describe('chiffres de l’admin', () => {
  it('compte visiteurs, pages, provenances et conversions', async () => {
    await s.recordHit(s.buildRow({ path: '/', referrer: 'https://www.google.fr/' }, ctx('a'))!);
    await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx('a'))!);
    await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx('b', 'Mozilla/5.0 (iPhone) Mobile'))!);
    await s.recordHit(s.buildRow({ path: '/tarifs', event: 'demo' }, ctx('b', 'Mozilla/5.0 (iPhone) Mobile'))!);
    const st = await s.getSiteStats(7);
    expect(st.totals).toEqual({ visitors: 2, views: 3, demo: 1, contact: 0, signup: 0 });
    expect(st.daily).toHaveLength(7);
    expect(st.daily.at(-1)).toMatchObject({ visitors: 2, views: 3 });
    expect(st.pages[0]).toEqual({ path: '/tarifs', views: 2 });
    expect(st.sources.find((x) => x.source === 'recherche')?.visitors).toBe(1);
    expect(st.referrers).toEqual([{ host: 'google.fr', visitors: 1 }]);
    expect(st.devices.map((d) => d.device).sort()).toEqual(['mobile', 'ordinateur']);
  });
});
