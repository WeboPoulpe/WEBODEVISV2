import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import type { CompanyResult } from '@/lib/companies';
import { DEMO_BLOCKED, DEMO_USER_ID } from '@/lib/demo';
import { MAX_PHOTOS } from '@/lib/annuaire/config';
import type { ListingInput } from '@/lib/annuaire/listing';

// Fiche du traiteur dans l'annuaire, sur le vrai schéma (baseline + migrations) en mémoire.

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Test' }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock('@/lib/push', () => ({ pushToUser: async () => 1 }));
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async () => ({ error: null }),
}));
const A = '00000000-0000-4000-8000-0000000000a1';
const M = '00000000-0000-4000-8000-0000000000a2';
const B = '00000000-0000-4000-8000-0000000000a3';
const C = '00000000-0000-4000-8000-0000000000a4';
const E = '00000000-0000-4000-8000-0000000000a5';
const F = '00000000-0000-4000-8000-0000000000a6';
const D = '00000000-0000-4000-8000-0000000000a7';
const G = '00000000-0000-4000-8000-0000000000a8';
const H = '00000000-0000-4000-8000-0000000000a9';
let current = A;
vi.mock('./session', () => ({
  getSessionUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
// Réponse de l'annuaire des entreprises de l'État, réglée par chaque test.
let lookup: CompanyResult | null | 'unavailable' = null;
vi.mock('./companyLookup', () => ({ findCompanyBySiret: async () => lookup }));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const d = await import('./directoryListing');

const SIRET_A = '92520576700013';
const SIRET_B = '92520576700021';
const DESCRIPTION = 'Traiteur installé dans l’Aube, nous préparons vos réceptions de A à Z : cocktails, repas assis, buffets et desserts.';

const input = (over: Partial<ListingInput> = {}): ListingInput => ({
  displayName: 'Traiteur A', tagline: 'Des repas faits maison', description: DESCRIPTION, city: 'Troyes', postalCode: '10000',
  departments: ['10'], eventTypes: ['Mariage', 'Cocktail'], websiteUrl: '', guestsMin: '20', guestsMax: '200', priceFrom: '35', siret: SIRET_A,
  ...over,
});
const valid = input();
const validB = input({ displayName: 'Traiteur B', siret: SIRET_B });
const company = (over: Partial<CompanyResult> = {}): CompanyResult => ({
  name: 'TRAITEUR A SARL', siren: SIRET_A.slice(0, 9), siret: SIRET_A, address: '1 rue du Test 10000 Troyes', postalCode: '10000',
  city: 'Troyes', active: true, activity: '56.21Z', headOffice: true, ...over,
});
const found = company();
const photo = (owner: string, name = 'a') => ({ url: `https://x.public.blob.vercel-storage.com/${name}.webp`, path: `${owner}/annuaire/${name}.webp` });
const photoB = photo(B);

// Le délai de 30 secondes entre deux envois est levé pour les tests qui renvoient une fiche.
const unthrottle = (id: string) => pg.query(`update directory_listings set submitted_at = now() - interval '1 minute' where company_id = $1`, [id]);
const row = async (id: string) => (await pg.query<Record<string, any>>(`select * from directory_listings where company_id = $1`, [id])).rows[0];

beforeAll(async () => {
  delete process.env.DIRECTORY_HOST;
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values
      ('${A}', 'a@t.fr', 'x'), ('${M}', 'm@t.fr', 'x'), ('${B}', 'b@t.fr', 'x'), ('${C}', 'c@t.fr', 'x'),
      ('${E}', 'e@t.fr', 'x'), ('${F}', 'f@t.fr', 'x'), ('${D}', 'd@t.fr', 'x'), ('${G}', 'g@t.fr', 'x'), ('${H}', 'h@t.fr', 'x');
    insert into profiles (id, email, company_name, siret, company_website, parent_user_id) values
      ('${A}', 'a@t.fr', 'Traiteur A', '92520576700013', 'https://traiteur-a.fr', null);
    insert into profiles (id, email, company_name, parent_user_id) values ('${M}', 'm@t.fr', 'Traiteur A', '${A}');
    insert into profiles (id, email, company_name, company_siret) values
      ('${B}', 'b@t.fr', 'Traiteur B', '925 205 767 00021'), ('${C}', 'c@t.fr', 'Traiteur A', null),
      ('${E}', 'e@t.fr', 'Dupont Traiteur', null), ('${F}', 'f@t.fr', 'Dupont Traiteur', null), ('${D}', 'd@t.fr', 'Traiteur D', null),
      ('${H}', 'h@t.fr', 'Traiteur H', null);
    insert into profiles (id, email, company_name, siret) values ('${G}', 'g@t.fr', 'Traiteur G', '925 205 767 00054');
  `);
});

describe('fiche de l’annuaire : serveur', () => {
  it('brouillon prérempli depuis le profil', async () => {
    current = A;
    const l = await d.getMyListing();
    expect(l).toMatchObject({
      status: 'brouillon', slug: null, publicUrl: null,
      fields: { displayName: 'Traiteur A', siret: '92520576700013', websiteUrl: 'https://traiteur-a.fr' },
    });
    expect(l.missing).toMatch(/il manque/);
    expect((await pg.query(`select 1 from directory_listings`)).rows).toHaveLength(0);
  });

  it('le SIRET du profil à défaut : company_siret, nettoyé', async () => {
    current = B;
    expect((await d.getMyListing()).fields.siret).toBe(SIRET_B);
  });

  it('enregistre, puis publie quand le contrôle réussit', async () => {
    current = A;
    expect((await d.saveListing(valid)).error).toBeNull();
    expect((await d.submitListing()).error).toMatch(/photo/);
    await d.addListingPhoto({ url: 'https://x.public.blob.vercel-storage.com/a.webp', path: `${A}/annuaire/a.webp` });
    lookup = found;
    expect(await d.submitListing()).toEqual({ error: null, status: 'publiee' });
    const l = await d.getMyListing();
    expect(l.slug).toBe('traiteur-a-troyes');
    // Sans DIRECTORY_HOST, l'adresse de la fiche est relative (local, préversions, avant le branchement du domaine).
    expect(l.publicUrl).toBe('/annuaire/traiteur/traiteur-a-troyes');
    const r = await row(A);
    expect(r.validated_at).not.toBeNull();
    expect(r.published_at).not.toBeNull();
    expect(r.check_result).toMatchObject({ ok: true, reason: null, legalName: 'TRAITEUR A SARL' });
  });

  it('une saisie invalide est refusée sans rien écrire', async () => {
    current = A;
    expect((await d.saveListing(input({ displayName: '' }))).error).toMatch(/nom de l’entreprise/);
    expect((await row(A)).display_name).toBe('Traiteur A');
  });

  it('passe en attente si l’annuaire de l’État ne répond pas, sans erreur', async () => {
    current = B;
    expect((await d.saveListing(validB)).error).toBeNull();
    expect((await d.addListingPhoto(photoB)).error).toBeNull();
    lookup = 'unavailable';
    expect(await d.submitListing()).toEqual({ error: null, status: 'en_attente' });
    const { rows } = await pg.query<{ r: string; published_at: string | null }>(`select check_result->>'reason' as r, published_at from directory_listings where company_id = $1`, [B]);
    expect(rows[0].r).toMatch(/ne répond pas/);
    expect(rows[0].published_at).toBeNull();
  });

  it('un doublon de SIRET passe en attente', async () => {
    current = C;
    expect((await d.saveListing(input({ displayName: 'Traiteur A bis', siret: SIRET_A }))).error).toBeNull();
    await d.addListingPhoto(photo(C));
    lookup = found;
    expect(await d.submitListing()).toEqual({ error: null, status: 'en_attente' });
    expect((await row(C)).check_result).toMatchObject({ ok: false, reason: expect.stringMatching(/déjà utilisé/) });
  });

  it('un autre SIRET sur une fiche en attente la remet en brouillon et efface le contrôle', async () => {
    current = C;
    expect((await d.saveListing(input({ displayName: 'Traiteur A bis', siret: '92520576700070' }))).error).toBeNull();
    const r = await row(C);
    expect(r.status).toBe('brouillon');
    expect(r.check_result).toBeNull();
  });

  it('un SIRET différent de celui du profil passe en attente, même si la recherche officielle réussit', async () => {
    current = G;
    expect((await d.saveListing(input({ displayName: 'Traiteur G', siret: '92520576700062' }))).error).toBeNull();
    await d.addListingPhoto(photo(G));
    lookup = company({ name: 'TRAITEUR G', siret: '92520576700062' });
    expect(await d.submitListing()).toEqual({ error: null, status: 'en_attente' });
    const r = await row(G);
    expect(r.check_result).toMatchObject({ ok: false, reason: 'Le SIRET de la fiche n’est pas celui de vos mentions légales.' });
    expect(r.published_at).toBeNull();
  });

  it('deux envois à moins de 30 secondes : le second est refusé', async () => {
    current = G;
    expect((await d.submitListing()).error).toBe('Votre fiche vient d’être envoyée. Patientez quelques secondes avant de recommencer.');
    await unthrottle(G);
    expect((await d.submitListing()).error).toBeNull();
  });

  it('un brouillon qui garde un motif de refus repasse en attente, même si le contrôle réussit', async () => {
    current = H;
    expect((await d.saveListing(input({ displayName: 'Traiteur H', siret: '92520576700088' }))).error).toBeNull();
    await d.addListingPhoto(photo(H));
    await pg.query(`update directory_listings set refused_reason = 'Photos floues.' where company_id = $1`, [H]);
    lookup = company({ name: 'TRAITEUR H', siret: '92520576700088' });
    expect(await d.submitListing()).toEqual({ error: null, status: 'en_attente' });
    const r = await row(H);
    expect(r.status).toBe('en_attente');
    expect(r.published_at).toBeNull();
    expect(r.refused_reason).toBe('Photos floues.');
  });

  it('le slug ne change plus après publication, même si le nom change', async () => {
    current = A;
    const before = await row(A);
    expect((await d.saveListing(input({ displayName: 'Nouveau Nom', tagline: 'Autre accroche' }))).error).toBeNull();
    const after = await row(A);
    expect(after.slug).toBe('traiteur-a-troyes');
    expect(after.status).toBe('publiee');
    expect(after.display_name).toBe('Nouveau Nom');
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
  });

  it('un autre SIRET sur une fiche publiée la remet en brouillon', async () => {
    current = A;
    expect((await d.saveListing(input({ displayName: 'Nouveau Nom', siret: '92520576700039' }))).error).toBeNull();
    expect((await row(A)).status).toBe('brouillon');
    expect((await row(A)).check_result).toBeNull();
    expect((await row(A)).slug).toBe('traiteur-a-troyes');
  });

  it('avant publication le slug suit le nom et la ville ; deux fiches du même nom dans la même ville : slugs distincts', async () => {
    current = E;
    await d.saveListing(input({ displayName: 'Dupont Traiteur', city: 'Reims', postalCode: '51100', departments: ['51'] }));
    expect((await row(E)).slug).toBe('dupont-traiteur-reims');
    await d.saveListing(input({ displayName: 'Dupont Réceptions', city: 'Reims', postalCode: '51100', departments: ['51'] }));
    expect((await row(E)).slug).toBe('dupont-receptions-reims');
    await d.saveListing(input({ displayName: 'Dupont Traiteur', city: 'Reims', postalCode: '51100', departments: ['51'] }));
    current = F;
    await d.saveListing(input({ displayName: 'Dupont Traiteur', city: 'Reims', postalCode: '51100', departments: ['51'] }));
    expect((await row(F)).slug).toBe('dupont-traiteur-reims-2');
    current = E;
    await d.saveListing(input({ displayName: 'Dupont Traiteur', city: 'Reims', postalCode: '51100', departments: ['51'] }));
    expect((await row(E)).slug).toBe('dupont-traiteur-reims');
  });

  it('20 photos au plus, venues de l’espace de stockage du traiteur', async () => {
    current = D;
    expect((await d.addListingPhoto(photo(D))).error).toMatch(/Enregistrez d’abord/);
    await d.saveListing(input({ displayName: 'Traiteur D', siret: '92520576700047' }));
    const refused = 'Cette photo ne vient pas de votre espace. Renvoyez-la depuis cet écran.';
    const blob = 'https://x.public.blob.vercel-storage.com/a.webp';
    expect((await d.addListingPhoto({ url: 'http://x.public.blob.vercel-storage.com/a.webp', path: `${D}/annuaire/a.webp` })).error).toBe(refused);
    expect((await d.addListingPhoto({ url: 'pas une adresse', path: `${D}/annuaire/a.webp` })).error).toBe(refused);
    // Une adresse https d'un autre site.
    expect((await d.addListingPhoto({ url: 'https://exemple.fr/a.webp', path: `${D}/annuaire/a.webp` })).error).toBe(refused);
    expect((await d.addListingPhoto({ url: 'https://public.blob.vercel-storage.com.exemple.fr/a.webp', path: `${D}/annuaire/a.webp` })).error).toBe(refused);
    // Un chemin hors de l'espace du traiteur.
    expect((await d.addListingPhoto({ url: blob, path: `${A}/annuaire/a.webp` })).error).toBe(refused);
    expect((await d.addListingPhoto({ url: blob, path: `${D}/annuaire/../../${A}/a.webp` })).error).toBe(refused);
    expect((await d.addListingPhoto({ url: blob, path: `${D}/autre/a.webp` })).error).toBe(refused);
    expect((await d.getMyListing()).photos).toHaveLength(0);
    const first = await d.addListingPhoto(photo(D, 'p0'));
    expect(first.id).toBeTruthy();
    expect((await row(D)).cover_photo_id).toBe(first.id);
    for (let i = 1; i < MAX_PHOTOS; i++) expect((await d.addListingPhoto(photo(D, `p${i}`))).error).toBeNull();
    expect((await d.addListingPhoto(photo(D, 'trop'))).error).toMatch(/20 photos au plus/);
    expect((await d.getMyListing()).photos).toHaveLength(MAX_PHOTOS);
  });

  it('photos : ordre, couverture, texte alternatif, suppression (la couverture passe à la suivante)', async () => {
    current = D;
    const { photos } = await d.getMyListing();
    const [p0, p1, p2] = photos;
    expect((await d.reorderListingPhotos([p2.id, p0.id])).error).toBeNull();
    expect((await d.getMyListing()).photos.slice(0, 3).map((p) => p.id)).toEqual([p2.id, p0.id, p1.id]);
    expect((await d.setListingCover(p1.id)).error).toBeNull();
    expect((await d.getMyListing()).coverPhotoId).toBe(p1.id);
    expect((await d.updateListingPhotoAlt(p1.id, '  Buffet de mariage ')).error).toBeNull();
    expect((await d.getMyListing()).photos.find((p) => p.id === p1.id)?.alt).toBe('Buffet de mariage');
    expect((await d.removeListingPhoto(p1.id)).error).toBeNull();
    expect((await d.getMyListing()).coverPhotoId).toBe(p2.id);
    // Une photo d'une autre entreprise reste intacte.
    const [other] = (await pg.query<{ id: string }>(`select id from directory_photos where company_id = $1`, [A])).rows;
    expect((await d.removeListingPhoto(other.id)).error).toMatch(/introuvable/);
    expect((await d.setListingCover(other.id)).error).toMatch(/introuvable/);
    expect((await d.updateListingPhotoAlt(other.id, 'x')).error).toMatch(/introuvable/);
    expect((await d.reorderListingPhotos([other.id])).error).toMatch(/introuvable/);
  });

  it('un collaborateur modifie la fiche de son entreprise', async () => {
    current = M;
    const l = await d.getMyListing();
    expect(l.slug).toBe('traiteur-a-troyes');
    expect(l.fields.displayName).toBe('Nouveau Nom');
    expect((await d.saveListing(input({ displayName: 'Nouveau Nom', tagline: 'Écrit par le collaborateur' }))).error).toBeNull();
    expect((await row(A)).tagline).toBe('Écrit par le collaborateur');
    expect(await row(M)).toBeUndefined();
  });

  it('brochures : crée un lien « Choisir Mon Traiteur », refuse la brochure d’une autre entreprise', async () => {
    const brochure = async (owner: string, name: string, token: string) => (await pg.query<{ id: string }>(
      `insert into brochures (owner_user_id, user_id, name, share_token) values ($1, $1, $2, $3) returning id`, [owner, name, token])).rows[0].id;
    const mine = await brochure(A, 'Mariages', 'jeton-annuaire-a-0000001');
    const mine2 = await brochure(M, 'Cocktails', 'jeton-annuaire-a-0000002');
    const theirs = await brochure(B, 'Autre', 'jeton-annuaire-b-0000001');
    const links = async () => (await pg.query<{ brochure_id: string; kind: string; label: string }>(`select brochure_id, kind, label from brochure_links`)).rows;
    const chosen = async () => (await pg.query<{ brochure_id: string; link_id: string }>(`select brochure_id, link_id from directory_listing_brochures where company_id = $1`, [A])).rows;

    current = M;
    expect((await d.getMyListing()).brochures).toEqual([
      { brochureId: mine2, name: 'Cocktails', selected: false }, { brochureId: mine, name: 'Mariages', selected: false },
    ]);
    expect((await d.setListingBrochures([mine, theirs])).error).toMatch(/Brochure introuvable/);
    expect((await d.setListingBrochures(['pas-un-uuid'])).error).toMatch(/Brochure introuvable/);
    expect(await chosen()).toHaveLength(0);
    expect(await links()).toHaveLength(0);

    expect((await d.setListingBrochures([mine, mine2])).error).toBeNull();
    expect(await links()).toEqual(expect.arrayContaining([
      { brochure_id: mine, kind: 'source', label: 'Choisir Mon Traiteur' }, { brochure_id: mine2, kind: 'source', label: 'Choisir Mon Traiteur' },
    ]));
    expect(await links()).toHaveLength(2);
    const linkOfMine = (await chosen()).find((c) => c.brochure_id === mine)!.link_id;

    // Rien n'est dupliqué quand on enregistre à nouveau ; une brochure décochée perd sa ligne mais pas son lien.
    current = A;
    expect((await d.setListingBrochures([mine])).error).toBeNull();
    expect(await links()).toHaveLength(2);
    expect(await chosen()).toEqual([{ brochure_id: mine, link_id: linkOfMine }]);
    expect((await d.getMyListing()).brochures.find((b) => b.brochureId === mine2)?.selected).toBe(false);
    expect((await d.setListingBrochures([])).error).toBeNull();
    expect(await chosen()).toHaveLength(0);
    expect(await links()).toHaveLength(2);
  });

  it('chiffres : consultations de la page et demandes venues de l’annuaire sur 30 jours', async () => {
    await pg.exec(`
      insert into site_visits (day, path, event, visitor) values
        (current_date, '/annuaire/traiteur/traiteur-a-troyes', 'view', 'v1'),
        (current_date - 10, '/annuaire/traiteur/traiteur-a-troyes', 'view', 'v2'),
        (current_date - 40, '/annuaire/traiteur/traiteur-a-troyes', 'view', 'v3'),
        (current_date, '/annuaire/traiteur/traiteur-a-troyes', 'contact', 'v4'),
        (current_date, '/annuaire/traiteur/autre', 'view', 'v5');
      insert into prospect_requests (first_name, last_name, email, owner_user_id, source) values
        ('A', 'B', 'a@x.fr', '${A}', 'annuaire'), ('C', 'D', 'c@x.fr', '${A}', null), ('E', 'F', 'e@x.fr', '${B}', 'annuaire');
    `);
    current = M;
    expect((await d.getMyListing()).stats).toEqual({ views30: 2, requests30: 1 });
  });

  it('retrait : repasse en brouillon ; une fiche suspendue ne peut ni se renvoyer ni se retirer', async () => {
    current = B;
    expect((await d.withdrawListing()).error).toBeNull();
    expect((await row(B)).status).toBe('brouillon');
    await pg.query(`update directory_listings set status = 'suspendue' where company_id = $1`, [B]);
    expect((await d.submitListing()).error).toMatch(/suspendue/);
    expect((await d.withdrawListing()).error).toMatch(/suspendue/);
    expect((await row(B)).status).toBe('suspendue');
  });

  it('une fiche refusée ne peut pas se retirer (elle repasserait par le brouillon)', async () => {
    current = H;
    await pg.query(`update directory_listings set status = 'refusee', refused_reason = 'Photos floues.' where company_id = $1`, [H]);
    expect((await d.withdrawListing()).error).toBe('Votre fiche a été refusée : corrigez-la puis renvoyez-la, ou écrivez-nous.');
    expect((await row(H)).status).toBe('refusee');
  });

  it('une fiche déjà publiée qu’on renvoie reste publiée', async () => {
    current = A;
    // Le SIRET est libéré : l'autre fiche qui le portait en attente est retirée.
    await pg.query(`update directory_listings set status = 'brouillon' where company_id = $1`, [C]);
    await d.saveListing(input({ displayName: 'Traiteur A' }));
    lookup = found;
    await unthrottle(A);
    expect((await d.submitListing()).status).toBe('publiee');
    const published = (await row(A)).published_at;
    lookup = 'unavailable';
    await unthrottle(A);
    expect(await d.submitListing()).toEqual({ error: null, status: 'publiee' });
    expect((await row(A)).published_at).toEqual(published);
  });

  it('une fiche refusée qu’on resoumet repasse en attente, même si le contrôle réussit', async () => {
    current = D;
    await pg.query(`update directory_listings set status = 'refusee', refused_reason = 'Photos floues.' where company_id = $1`, [D]);
    lookup = company({ name: 'TRAITEUR D', siret: '92520576700047' });
    expect(await d.submitListing()).toEqual({ error: null, status: 'en_attente' });
    const r = await row(D);
    expect(r.status).toBe('en_attente');
    expect(r.published_at).toBeNull();
    expect(r.refused_reason).toBe('Photos floues.');
    expect(r.check_result).toMatchObject({ ok: true });
  });

  it('démonstration : refusé', async () => {
    current = DEMO_USER_ID;
    expect(await d.saveListing(valid)).toEqual({ error: DEMO_BLOCKED });
    expect(await d.submitListing()).toEqual({ error: DEMO_BLOCKED });
    expect(await d.withdrawListing()).toEqual({ error: DEMO_BLOCKED });
    expect(await d.addListingPhoto(photo(A))).toEqual({ error: DEMO_BLOCKED });
    expect(await d.setListingBrochures([])).toEqual({ error: DEMO_BLOCKED });
  });
});
