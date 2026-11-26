import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Statistiques du site : écriture des visites et chiffres de l'admin.

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
});

describe('écriture', () => {
  // Sur Vercel, une instance s'arrête bien avant 100 visites ou une heure : un paquet en mémoire était perdu
  // (7 visites enregistrées du 16 au 26 novembre). Chaque visite est donc écrite tout de suite.
  it('écrit chaque visite tout de suite', async () => {
    await s.recordHit(s.buildRow({ path: '/' }, ctx())!);
    expect(await stored()).toBe(1);
    await s.recordHit(s.buildRow({ path: '/tarifs' }, ctx())!);
    expect(await stored()).toBe(2);
  });

  it('ignore les robots et les chemins invalides', () => {
    expect(s.buildRow({ path: '/' }, ctx('x', 'Googlebot/2.1'))).toBeNull();
    expect(s.buildRow({ path: 'https://ailleurs.fr' }, ctx())).toBeNull();
  });

  it('une conversion côté serveur est écrite tout de suite', async () => {
    await s.recordEventNow('contact', '/contact', ctx());
    expect(await stored()).toBe(1);
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
