import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

// Lecture publique de l'annuaire, sur le vrai schéma (baseline + migrations) en mémoire.

vi.mock('server-only', () => ({}));
// Abonnement : tout le monde a l'accès complet, sauf D.
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000a2';
const C = '00000000-0000-4000-8000-0000000000a3';
const D = '00000000-0000-4000-8000-0000000000a4';
vi.mock('./subscription', () => ({
  accessOf: async (id: string) => (id === '00000000-0000-4000-8000-0000000000a4' ? 'readonly' : 'full'),
}));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const p = await import('./directoryPublic');

const SIRET = '92520576700013';
const BROCHURE_OK = '00000000-0000-4000-8000-0000000000b1';
const BROCHURE_OFF = '00000000-0000-4000-8000-0000000000b2';
const BROCHURE_LINK_OFF = '00000000-0000-4000-8000-0000000000b3';
const LINK_OK = '00000000-0000-4000-8000-0000000000c1';
const LINK_OFF = '00000000-0000-4000-8000-0000000000c2';
const LINK_OFF2 = '00000000-0000-4000-8000-0000000000c3';
const PHOTO_1 = '00000000-0000-4000-8000-0000000000d1';
const PHOTO_2 = '00000000-0000-4000-8000-0000000000d2';

const listing = (id: string, slug: string, status: string, depts: string, types: string, published: string, price = 'null') =>
  `insert into directory_listings (company_id, slug, status, siret, check_result, display_name, tagline, description, city, postal_code, departments, event_types, published_at, refused_reason, price_from)
   values ('${id}', '${slug}', '${status}', '${SIRET}', '{"legalName":"SECRET SARL"}', 'Traiteur ${slug}', 'Accroche', 'Description', 'Ville', '10000', '${depts}', '${types}', '${published}', 'raison privée', ${price});`;

beforeAll(async () => {
  pg = await createTestDb();
  const uid = (id: string, mail: string) => `insert into users (id, email, password_hash) values ('${id}', '${mail}', 'x');`;
  await pg.exec([
    uid(A, 'a@t.fr'), uid(B, 'b@t.fr'), uid(C, 'c@t.fr'), uid(D, 'd@t.fr'), uid(DEMO_USER_ID, 'demo@webodevis.fr'),
    `insert into profiles (id, email, company_name, logo_url) values
      ('${A}', 'a@t.fr', 'A', 'https://x/logo-a.png'), ('${B}', 'b@t.fr', 'B', null), ('${C}', 'c@t.fr', 'C', null),
      ('${D}', 'd@t.fr', 'D', null), ('${DEMO_USER_ID}', 'demo@webodevis.fr', 'Demo', null);`,
    listing(A, 'a-troyes', 'publiee', '{10,51}', '{Mariage,Cocktail}', '2026-11-01T10:00:00Z', '35'),
    listing(B, 'b-paris', 'publiee', '{75}', '{Séminaire}', '2026-11-05T10:00:00Z'),
    listing(C, 'c-lyon', 'en_attente', '{69}', '{Mariage}', '2026-11-03T10:00:00Z'),
    listing(D, 'd-reims', 'publiee', '{51}', '{Mariage}', '2026-11-04T10:00:00Z'),
    listing(DEMO_USER_ID, 'demo-ville', 'publiee', '{13}', '{Gala}', '2026-11-06T10:00:00Z'),
    `insert into directory_photos (id, company_id, url, path, alt, position) values
      ('${PHOTO_1}', '${A}', 'https://x/p1.jpg', 'p1', 'Buffet', 0), ('${PHOTO_2}', '${A}', 'https://x/p2.jpg', 'p2', null, 1);`,
    `update directory_listings set cover_photo_id = '${PHOTO_2}' where company_id = '${A}';`,
    `insert into brochures (id, owner_user_id, user_id, name, share_token, is_active, cover) values
      ('${BROCHURE_OK}', '${A}', '${A}', 'Mariages', 'share-ok-0000000001', true, '{"photoUrl":"https://x/couv.jpg"}'),
      ('${BROCHURE_OFF}', '${A}', '${A}', 'Éteinte', 'share-off-000000001', false, '{}'),
      ('${BROCHURE_LINK_OFF}', '${A}', '${A}', 'Lien éteint', 'share-lof-000000001', true, '{}');`,
    `insert into brochure_links (id, brochure_id, owner_user_id, token, kind, label, is_active) values
      ('${LINK_OK}', '${BROCHURE_OK}', '${A}', 'jeton-annuaire-ok-000001', 'source', 'Choisir Mon Traiteur', true),
      ('${LINK_OFF}', '${BROCHURE_OFF}', '${A}', 'jeton-annuaire-off-00001', 'source', 'Choisir Mon Traiteur', true),
      ('${LINK_OFF2}', '${BROCHURE_LINK_OFF}', '${A}', 'jeton-annuaire-lof-00001', 'source', 'Choisir Mon Traiteur', false);`,
    `insert into directory_listing_brochures (company_id, brochure_id, link_id, position) values
      ('${A}', '${BROCHURE_OK}', '${LINK_OK}', 0), ('${A}', '${BROCHURE_OFF}', '${LINK_OFF}', 1), ('${A}', '${BROCHURE_LINK_OFF}', '${LINK_OFF2}', 2);`,
  ].join('\n'));
});

describe('annuaire public : lecture', () => {
  it('recherche par département et par type', async () => {
    expect((await p.searchListings({})).map((l) => l.slug).sort()).toEqual(['a-troyes', 'b-paris']);
    expect((await p.searchListings({ department: '51' })).map((l) => l.slug)).toEqual(['a-troyes']);
    expect((await p.searchListings({ department: '10', eventType: 'Séminaire' }))).toEqual([]);
  });

  it('le plus récemment publié d’abord, avec photo de couverture et logo', async () => {
    const all = await p.searchListings({});
    expect(all.map((l) => l.slug)).toEqual(['b-paris', 'a-troyes']);
    expect(all[1]).toMatchObject({ coverUrl: 'https://x/p2.jpg', logoUrl: 'https://x/logo-a.png', priceFrom: 35, departments: ['10', '51'] });
    expect(all[0]).toMatchObject({ coverUrl: null, logoUrl: null, priceFrom: null });
  });

  it('une fiche non publiée ou d’un compte sans accès complet n’existe pas en public', async () => {
    expect(await p.getPublicListing('c-lyon')).toBeNull();
    expect(await p.getPublicListing('d-reims')).toBeNull();
    expect((await p.listPublicSlugs()).map((s) => s.slug).sort()).toEqual(['a-troyes', 'b-paris']);
    expect((await p.departmentsWithListings()).map((d) => d.code).sort()).toEqual(['10', '51', '75']);
  });

  it('un compte de démonstration n’est jamais listé', async () => {
    expect(await p.getPublicListing('demo-ville')).toBeNull();
    expect((await p.searchListings({})).map((l) => l.slug)).not.toContain('demo-ville');
    expect((await p.departmentsWithListings()).map((d) => d.code)).not.toContain('13');
  });

  it('compte désactivé ou en cours de suppression : retiré', async () => {
    await pg.exec(`update profiles set is_active = false where id = '${B}'; update profiles set deletion_requested_at = now() where id = '${A}';`);
    expect(await p.searchListings({})).toEqual([]);
    expect(await p.getPublicListing('a-troyes')).toBeNull();
    expect(await p.getPublicListing('b-paris')).toBeNull();
    expect(await p.listPublicSlugs()).toEqual([]);
    expect(await p.departmentsWithListings()).toEqual([]);
    await pg.exec(`update profiles set is_active = true where id = '${B}'; update profiles set deletion_requested_at = null where id = '${A}';`);
    expect((await p.searchListings({})).length).toBe(2);
  });

  it('la fiche complète : photos dans l’ordre, brochures actives seulement', async () => {
    const l = await p.getPublicListing('a-troyes');
    expect(l).toMatchObject({ slug: 'a-troyes', name: 'Traiteur a-troyes', postalCode: '10000', eventTypes: ['Mariage', 'Cocktail'] });
    expect(l!.photos).toEqual([{ url: 'https://x/p1.jpg', alt: 'Buffet' }, { url: 'https://x/p2.jpg', alt: '' }]);
    expect(l!.brochures).toEqual([{ name: 'Mariages', token: 'jeton-annuaire-ok-000001', coverUrl: 'https://x/couv.jpg' }]);
    expect(l!.publishedAt).toBeTruthy();
    expect(l!.updatedAt).toBeTruthy();
    expect(await p.getPublicListing('inconnue')).toBeNull();
  });

  it('n’expose ni le SIRET ni le résultat du contrôle', async () => {
    expect(JSON.stringify(await p.getPublicListing('a-troyes'))).not.toMatch(/92520576700013|check_result|legalName/);
    const json = JSON.stringify([await p.getPublicListing('a-troyes'), await p.searchListings({}), await p.listPublicSlugs()]);
    expect(json).not.toMatch(/92520576700013|check_result|legalName|SECRET|raison privée|a@t\.fr|siret|refused/i);
    expect(json).not.toContain(A);
  });
});
