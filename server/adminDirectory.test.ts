import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Validation des fiches de l'annuaire par l'équipe : décisions, transitions permises, e-mail au titulaire, journal.

vi.mock('server-only', () => ({}));
const ADMIN = '00000000-0000-4000-8000-0000000000a0';
let adminAllowed = true;
vi.mock('./session', () => ({
  requireAdmin: async () => {
    if (!adminAllowed) throw new Error('Accès réservé aux administrateurs.');
    return { id: ADMIN, email: 'a@w.fr' };
  },
}));
const sent: { to: string; subject: string; html: string }[] = [];
let mailFails = false;
vi.mock('@/lib/mail', () => ({
  appOrigin: async () => 'https://webodevis.fr',
  sendMail: async (m: { to: string; subject: string; html: string }) => {
    if (mailFails) throw new Error('panne');
    sent.push({ to: m.to, subject: m.subject, html: m.html });
    return { error: null };
  },
}));
let pg: PGlite;
vi.mock('@/db', () => ({
  get db() { return drizzle(pg, { schema }); },
  get pool() { return null; },
}));

const a = await import('./adminDirectory');

const id = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const A = id(11); // publiée
const B = id(12); // en attente
const C = id(13); // en attente, sans adresse pro
const D = id(14); // suspendue
const E = id(15); // refusée
const F = id(16); // brouillon

async function seed() {
  await pg.exec(`
    delete from audit_log; delete from directory_photos; delete from directory_listings; delete from profiles; delete from users;
    insert into users (id, email, password_hash) values
      ('${A}', 'a@t.fr', 'x'), ('${B}', 'b@t.fr', 'x'), ('${C}', 'c@t.fr', 'x'), ('${D}', 'd@t.fr', 'x'), ('${E}', 'e@t.fr', 'x'), ('${F}', 'f@t.fr', 'x');
    insert into profiles (id, email, company_name, company_email) values
      ('${A}', 'a@t.fr', 'A', 'pro-a@t.fr'), ('${B}', 'b@t.fr', 'B', 'pro-b@t.fr'), ('${C}', 'c@t.fr', 'C', null),
      ('${D}', 'd@t.fr', 'D', null), ('${E}', 'e@t.fr', 'E', null), ('${F}', 'f@t.fr', 'F', null);
    insert into directory_listings (company_id, slug, status, siret, display_name, city, postal_code, check_result, submitted_at, validated_at, published_at, updated_at, refused_reason) values
      ('${A}', 'traiteur-a-lyon', 'publiee', '11111111111111', 'Traiteur A', 'Lyon', '69001', null, '2026-11-01T10:00:00Z', '2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z', '2026-11-02T10:00:00Z', null),
      ('${B}', 'traiteur-b-nancy', 'en_attente', '22222222222222', 'Traiteur B', 'Nancy', '54000', '{"ok":false,"reason":"Nom différent","checkedAt":"2026-11-05T10:00:00Z","legalName":"SARL Autre","activity":"56.21Z"}', '2026-11-05T10:00:00Z', null, null, '2026-11-05T10:00:00Z', null),
      ('${C}', 'traiteur-c-metz', 'en_attente', '33333333333333', 'Traiteur C', 'Metz', '57000', null, '2026-11-06T10:00:00Z', null, null, '2026-11-06T10:00:00Z', null),
      ('${D}', 'traiteur-d-paris', 'suspendue', '44444444444444', 'Traiteur D', 'Paris', '75001', null, '2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z', '2026-10-02T10:00:00Z', '2026-10-03T10:00:00Z', 'Plainte'),
      ('${E}', 'traiteur-e-lille', 'refusee', '55555555555555', 'Traiteur E', 'Lille', '59000', null, '2026-10-01T10:00:00Z', null, null, '2026-10-03T10:00:00Z', 'Photos floues'),
      ('${F}', 'traiteur-f-brest', 'brouillon', null, 'Traiteur F', null, null, null, null, null, null, '2026-10-03T10:00:00Z', null);
  `);
}

beforeAll(async () => { pg = await createTestDb(); });
beforeEach(async () => {
  adminAllowed = true; mailFails = false; sent.length = 0;
  await seed();
});

const row = async (company: string) => (await pg.query<Record<string, unknown>>(`select * from directory_listings where company_id = '${company}'`)).rows[0];
const audits = async () => (await pg.query<{ action: string; target_user_id: string; details: Record<string, unknown> | null }>('select action, target_user_id, details from audit_log order by created_at')).rows;

describe('liste', () => {
  it('liste les fiches envoyées à la validation, sans les brouillons', async () => {
    const list = await a.listAdminListings();
    expect(list.map((l) => l.companyId).sort()).toEqual([A, B, C, D, E].sort());
    const b = list.find((l) => l.companyId === B)!;
    expect(b).toMatchObject({
      slug: 'traiteur-b-nancy', status: 'en_attente', displayName: 'Traiteur B', city: 'Nancy', postalCode: '54000',
      siret: '22222222222222', ownerEmail: 'pro-b@t.fr', photoCount: 0, coverUrl: null, refusedReason: null, modifiedSinceValidation: false,
    });
    expect(b.check?.reason).toBe('Nom différent');
    expect(b.check?.legalName).toBe('SARL Autre');
    expect(list.find((l) => l.companyId === C)!.ownerEmail).toBe('c@t.fr');
    expect(list.find((l) => l.companyId === C)).toMatchObject({
      tagline: null, description: null, departments: [], eventTypes: [], websiteUrl: null, guestsMin: null, guestsMax: null, priceFrom: null, photos: [],
    });
  });

  it('donne le contenu de la fiche à relire : textes, départements, types, repères et toutes les photos dans l’ordre', async () => {
    await pg.exec(`
      update directory_listings set tagline = 'Cuisine de saison', description = 'Nous cuisinons <b>tout</b> maison.',
        departments = '{54,57}', event_types = '{Mariage,Cocktail}', website_url = 'https://traiteur-b.fr',
        guests_min = 20, guests_max = 300, price_from = 42.5
      where company_id = '${B}';
      insert into directory_photos (id, company_id, url, path, alt, position) values
        ('${id(93)}', '${B}', 'https://x.test/b2.jpg', 'p/b2', null, 1), ('${id(94)}', '${B}', 'https://x.test/b1.jpg', 'p/b1', 'Buffet', 0),
        ('${id(95)}', '${A}', 'https://x.test/a.jpg', 'p/a', null, 0);`);
    const b = (await a.listAdminListings()).find((l) => l.companyId === B)!;
    expect(b).toMatchObject({
      tagline: 'Cuisine de saison', description: 'Nous cuisinons <b>tout</b> maison.', departments: ['54', '57'],
      eventTypes: ['Mariage', 'Cocktail'], websiteUrl: 'https://traiteur-b.fr', guestsMin: 20, guestsMax: 300, priceFrom: 42.5,
    });
    expect(b.photos).toEqual([{ url: 'https://x.test/b1.jpg', alt: 'Buffet' }, { url: 'https://x.test/b2.jpg', alt: null }]);
  });

  it('donne la photo de couverture et le nombre de photos', async () => {
    await pg.exec(`
      insert into directory_photos (id, company_id, url, path, position) values
        ('${id(91)}', '${B}', 'https://x.test/1.jpg', 'p/1', 0), ('${id(92)}', '${B}', 'https://x.test/2.jpg', 'p/2', 1);
      update directory_listings set cover_photo_id = '${id(92)}' where company_id = '${B}';`);
    const b = (await a.listAdminListings()).find((l) => l.companyId === B)!;
    expect(b.photoCount).toBe(2);
    expect(b.coverUrl).toBe('https://x.test/2.jpg');
  });

  it('signale une fiche modifiée depuis sa validation', async () => {
    await pg.exec(`update directory_listings set updated_at = '2026-11-08T10:00:00Z' where company_id = '${A}'`);
    const list = await a.listAdminListings();
    expect(list.find((l) => l.companyId === A)!.modifiedSinceValidation).toBe(true);
    // Une fiche suspendue modifiée n'est pas « publiée » : pas de signalement.
    expect(list.find((l) => l.companyId === D)!.modifiedSinceValidation).toBe(false);
  });

  it('ne signale pas une fiche publiée jamais modifiée depuis sa validation', async () => {
    expect((await a.listAdminListings()).find((l) => l.companyId === A)!.modifiedSinceValidation).toBe(false);
  });
});

describe('compteur', () => {
  it('compte les fiches à valider', async () => {
    expect(await a.pendingListingCount()).toBe(2);
    await pg.exec(`update directory_listings set status = 'publiee' where company_id = '${C}'`);
    expect(await a.pendingListingCount()).toBe(1);
  });
});

describe('décisions', () => {
  it('valide une fiche en attente : publiée, e-mail au titulaire, audit', async () => {
    await pg.exec(`update directory_listings set refused_reason = 'ancien motif' where company_id = '${B}'`);
    expect(await a.decideListing(B, 'valider')).toEqual({ error: null });
    const r = await row(B);
    expect(r.status).toBe('publiee');
    expect(r.validated_at).not.toBeNull();
    expect(r.published_at).not.toBeNull();
    expect(r.refused_reason).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('pro-b@t.fr');
    expect(sent[0].html).toContain('https://webodevis.fr/ma-fiche');
    expect(sent[0].html).toContain('Ouvrir ma fiche');
    expect(await audits()).toEqual([{ action: 'annuaire_fiche_validee', target_user_id: B, details: { companyId: B } }]);
  });

  it('écrit au titulaire sur son adresse de compte quand l’entreprise n’a pas d’adresse', async () => {
    await a.decideListing(C, 'valider');
    expect(sent[0].to).toBe('c@t.fr');
  });

  it('garde la date de première publication quand on republie', async () => {
    await a.decideListing(D, 'republier');
    expect(new Date((await row(D)).published_at as string).toISOString()).toBe('2026-10-02T10:00:00.000Z');
  });

  it('refuse avec un motif, cité dans l’e-mail', async () => {
    expect(await a.decideListing(B, 'refuser', '  Photos de mauvaise qualité  ')).toEqual({ error: null });
    const r = await row(B);
    expect(r.status).toBe('refusee');
    expect(r.refused_reason).toBe('Photos de mauvaise qualité');
    expect(sent[0].html).toContain('Photos de mauvaise qualité');
    expect((await audits())[0]).toMatchObject({ action: 'annuaire_fiche_refusee', details: { companyId: B, reason: 'Photos de mauvaise qualité' } });
  });

  it('suspend une fiche publiée avec un motif', async () => {
    expect(await a.decideListing(A, 'suspendre', 'Signalement d’un client')).toEqual({ error: null });
    const r = await row(A);
    expect(r.status).toBe('suspendue');
    expect(r.refused_reason).toBe('Signalement d’un client');
    expect(sent[0].html).toContain('Signalement d’un client');
    expect((await audits())[0].action).toBe('annuaire_fiche_suspendue');
  });

  it('republie une fiche suspendue ou refusée et efface le motif', async () => {
    expect(await a.decideListing(D, 'republier')).toEqual({ error: null });
    expect(await a.decideListing(E, 'republier')).toEqual({ error: null });
    for (const c of [D, E]) {
      const r = await row(c);
      expect(r.status).toBe('publiee');
      expect(r.refused_reason).toBeNull();
      expect(r.validated_at).not.toBeNull();
      expect(r.published_at).not.toBeNull();
    }
    expect(sent).toHaveLength(2);
    expect((await audits()).map((x) => x.action)).toEqual(['annuaire_fiche_republiee', 'annuaire_fiche_republiee']);
  });

  it('refuser et suspendre exigent un motif', async () => {
    expect((await a.decideListing(B, 'refuser')).error).toMatch(/motif/i);
    expect((await a.decideListing(B, 'refuser', '   ')).error).toMatch(/motif/i);
    expect((await a.decideListing(A, 'suspendre')).error).toMatch(/motif/i);
    expect((await row(B)).status).toBe('en_attente');
    expect((await row(A)).status).toBe('publiee');
    expect(sent).toHaveLength(0);
    expect(await audits()).toEqual([]);
  });

  it('transitions interdites', async () => {
    expect((await a.decideListing(A, 'valider')).error).not.toBeNull(); // déjà publiée
    expect((await a.decideListing(A, 'refuser', 'x')).error).not.toBeNull();
    expect((await a.decideListing(A, 'republier')).error).not.toBeNull();
    expect((await a.decideListing(B, 'suspendre', 'x')).error).not.toBeNull();
    expect((await a.decideListing(B, 'republier')).error).not.toBeNull();
    expect((await a.decideListing(D, 'valider')).error).not.toBeNull();
    expect((await a.decideListing(E, 'suspendre', 'x')).error).not.toBeNull();
    expect((await a.decideListing(F, 'valider')).error).not.toBeNull(); // brouillon
    expect((await a.decideListing(id(99), 'valider')).error).not.toBeNull(); // inconnue
    expect(sent).toHaveLength(0);
    expect(await audits()).toEqual([]);
  });

  it('décision inconnue ou identifiant illisible : une erreur, sans exception ni écriture', async () => {
    expect((await a.decideListing(B, 'toString' as never)).error).toBe('Cette décision n’existe pas.');
    expect((await a.decideListing(B, 'n_importe_quoi' as never)).error).toBe('Cette décision n’existe pas.');
    expect((await a.decideListing('pas-un-uuid', 'valider')).error).toBe('Cette fiche est introuvable.');
    expect((await a.decideListing('pas-un-uuid', 'refuser', 'x')).error).toBe('Cette fiche est introuvable.');
    expect((await row(B)).status).toBe('en_attente');
    expect(sent).toHaveLength(0);
    expect(await audits()).toEqual([]);
  });

  it('la décision tient même si l’e-mail ne part pas', async () => {
    mailFails = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await a.decideListing(B, 'valider')).toEqual({ error: null });
    spy.mockRestore();
    expect((await row(B)).status).toBe('publiee');
    expect(await audits()).toHaveLength(1);
  });
});

describe('accès', () => {
  it('réservé aux administrateurs', async () => {
    adminAllowed = false;
    await expect(a.listAdminListings()).rejects.toThrow();
    await expect(a.pendingListingCount()).rejects.toThrow();
    await expect(a.decideListing(B, 'valider')).rejects.toThrow();
    expect((await row(B)).status).toBe('en_attente');
  });
});
