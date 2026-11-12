'use server';

// Fiche du traiteur dans l'annuaire public « Choisir Mon Traiteur » (écran « Ma fiche ») : lecture, enregistrement,
// photos, brochures exposées, envoi à la validation et retrait. Une fiche par entreprise : le titulaire et ses
// collaborateurs partagent la même (clé : companyIdFor). Rien n'est créé en lecture.

import { and, asc, eq, inArray, like, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochure_links, brochures, directory_listing_brochures, directory_listings, directory_photos, profiles } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { cleanSiret } from '@/lib/companies';
import { DIRECTORY_PREFIX, MAX_PHOTOS, directoryUrl } from '@/lib/annuaire/config';
import { companyCheck } from '@/lib/annuaire/companyCheck';
import {
  cleanListing, listingSlug, readyToSubmit, slugify,
  type ListingFields, type ListingInput, type ListingStatus,
} from '@/lib/annuaire/listing';
import { newLinkToken } from './brochureAccess';
import { companyIdsOf } from './companyScope';
import { findCompanyBySiret } from './companyLookup';
import { requireUser, requireWriter } from './session';
import { companyIdFor } from './weboWallet';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_LABEL = 'Choisir Mon Traiteur';
const ALT_MAX = 160;
const NO_LISTING = 'Enregistrez d’abord votre fiche.';
const SUSPENDED = 'Votre fiche est suspendue. Écrivez-nous pour en savoir plus.';
const NO_PHOTO = 'Photo introuvable.';
const NO_BROCHURE = 'Brochure introuvable.';

export interface MyListing {
  status: ListingStatus;
  slug: string | null;
  fields: ListingFields;
  photos: { id: string; url: string; alt: string | null; position: number }[];
  coverPhotoId: string | null;
  brochures: { brochureId: string; name: string; selected: boolean }[];
  refusedReason: string | null;
  publishedAt: string | null;
  /** Ce qui manque avant l'envoi à la validation, ou null si la fiche est prête. */
  missing: string | null;
  publicUrl: string | null;
  stats: { views30: number; requests30: number };
}

type ListingRow = typeof directory_listings.$inferSelect;

const fieldsOf = (r: ListingRow): ListingFields => ({
  displayName: r.display_name,
  tagline: r.tagline,
  description: r.description,
  city: r.city,
  postalCode: r.postal_code,
  departments: r.departments,
  eventTypes: r.event_types,
  websiteUrl: r.website_url,
  guestsMin: r.guests_min,
  guestsMax: r.guests_max,
  priceFrom: r.price_from === null ? null : Number(r.price_from),
  siret: r.siret,
});

const pathOf = (slug: string) => `${DIRECTORY_PREFIX}/traiteur/${slug}`;

async function listingOf(companyId: string): Promise<ListingRow | null> {
  const [row] = await db.select().from(directory_listings).where(eq(directory_listings.company_id, companyId)).limit(1);
  return row ?? null;
}

export async function getMyListing(): Promise<MyListing> {
  const user = await requireUser();
  const companyId = await companyIdFor(user.id);
  const row = await listingOf(companyId);

  let fields: ListingFields;
  if (row) {
    fields = fieldsOf(row);
  } else {
    // Pas encore de fiche : un brouillon prérempli avec ce que le profil de l'entreprise sait déjà (rien n'est créé).
    const [p] = await db.select({ name: profiles.company_name, website: profiles.company_website, siret: profiles.siret, companySiret: profiles.company_siret })
      .from(profiles).where(eq(profiles.id, companyId)).limit(1);
    fields = {
      displayName: (p?.name ?? '').trim(), tagline: null, description: null, city: null, postalCode: null,
      departments: [], eventTypes: [], websiteUrl: p?.website?.trim() || null, guestsMin: null, guestsMax: null, priceFrom: null,
      siret: (cleanSiret(p?.siret) ?? cleanSiret(p?.companySiret) ?? '').replace(/\D/g, '') || null,
    };
  }

  const photos = row
    ? await db.select({ id: directory_photos.id, url: directory_photos.url, alt: directory_photos.alt, position: directory_photos.position })
      .from(directory_photos).where(eq(directory_photos.company_id, companyId)).orderBy(asc(directory_photos.position), asc(directory_photos.created_at))
    : [];

  const owned = await db.select({ id: brochures.id, name: brochures.name }).from(brochures)
    .where(sql`${brochures.owner_user_id} in ${companyIdsOf(user.id)}`).orderBy(asc(brochures.name));
  const chosen = row
    ? new Set((await db.select({ id: directory_listing_brochures.brochure_id }).from(directory_listing_brochures)
      .where(eq(directory_listing_brochures.company_id, companyId))).map((c) => c.id))
    : new Set<string>();

  let views30 = 0;
  if (row?.slug) {
    const { rows } = await db.execute(sql`select count(*)::int as n from public.site_visits
      where event = 'view' and path = ${pathOf(row.slug)} and day >= current_date - 30`);
    views30 = Number((rows[0] as { n: number } | undefined)?.n ?? 0);
  }
  const { rows: reqRows } = await db.execute(sql`select count(*)::int as n from public.prospect_requests
    where source = 'annuaire' and owner_user_id in ${companyIdsOf(user.id)} and created_at >= now() - interval '30 days'`);

  return {
    status: (row?.status as ListingStatus | undefined) ?? 'brouillon',
    slug: row?.slug ?? null,
    fields,
    photos,
    coverPhotoId: row?.cover_photo_id ?? null,
    brochures: owned.map((b) => ({ brochureId: b.id, name: b.name, selected: chosen.has(b.id) })),
    refusedReason: row?.refused_reason ?? null,
    publishedAt: row?.published_at ?? null,
    missing: readyToSubmit(fields, photos.length),
    publicUrl: row?.status === 'publiee' && row.slug ? directoryUrl(pathOf(row.slug)) : null,
    stats: { views30, requests30: Number((reqRows[0] as { n: number } | undefined)?.n ?? 0) },
  };
}

/** Adresse libre la plus proche pour ce nom et cette ville, hors la fiche elle-même. */
async function freeSlug(name: string, city: string | null, companyId: string): Promise<string> {
  const base = slugify([name, city].filter(Boolean).join(' '));
  const rows = await db.select({ slug: directory_listings.slug }).from(directory_listings)
    .where(and(like(directory_listings.slug, `${base.slice(0, 50)}%`), ne(directory_listings.company_id, companyId)));
  const used = new Set(rows.map((r) => r.slug));
  return listingSlug(name, city, (s) => used.has(s));
}

export async function saveListing(input: ListingInput): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const { fields, error } = cleanListing(input);
  if (error) return { error };
  const companyId = await companyIdFor(user.id);
  const row = await listingOf(companyId);

  const values = {
    display_name: fields.displayName, tagline: fields.tagline, description: fields.description, city: fields.city,
    postal_code: fields.postalCode, departments: fields.departments, event_types: fields.eventTypes,
    website_url: fields.websiteUrl, guests_min: fields.guestsMin, guests_max: fields.guestsMax,
    price_from: fields.priceFrom === null ? null : String(fields.priceFrom), siret: fields.siret,
    updated_at: new Date().toISOString(),
  };

  if (!row) {
    await db.insert(directory_listings).values({
      ...values, company_id: companyId, status: 'brouillon', slug: await freeSlug(fields.displayName, fields.city, companyId),
    });
    return { error: null };
  }

  // L'adresse suit le nom et la ville tant que la fiche n'a jamais été publiée, puis ne bouge plus.
  const slug = row.published_at || row.status === 'publiee' ? row.slug : await freeSlug(fields.displayName, fields.city, companyId);
  // Un autre SIRET sur une fiche publiée : le contrôle est à refaire, la fiche repasse en brouillon.
  const status = row.status === 'publiee' && (row.siret ?? null) !== fields.siret ? 'brouillon' : row.status;
  await db.update(directory_listings).set({ ...values, slug, status }).where(eq(directory_listings.company_id, companyId));
  return { error: null };
}

// ── Photos ──────────────────────────────────────────────────────────────────

async function photoOf(companyId: string, id: string) {
  if (!UUID.test(id ?? '')) return null;
  const [p] = await db.select().from(directory_photos).where(and(eq(directory_photos.id, id), eq(directory_photos.company_id, companyId))).limit(1);
  return p ?? null;
}

export async function addListingPhoto(photo: { url: string; path: string; alt?: string }): Promise<{ error: string | null; id?: string }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const row = await listingOf(companyId);
  if (!row) return { error: NO_LISTING };
  const url = String(photo?.url ?? '').trim();
  const path = String(photo?.path ?? '').trim();
  let https = false;
  try { https = new URL(url).protocol === 'https:'; } catch { /* adresse illisible */ }
  if (!https || !path) return { error: 'Cette photo n’a pas pu être ajoutée : son adresse est invalide.' };

  const [{ n, last }] = await db.select({ n: sql<number>`count(*)::int`, last: sql<number>`coalesce(max(${directory_photos.position}), -1)::int` })
    .from(directory_photos).where(eq(directory_photos.company_id, companyId));
  if (n >= MAX_PHOTOS) return { error: `Une fiche compte ${MAX_PHOTOS} photos au plus.` };

  const [created] = await db.insert(directory_photos).values({
    company_id: companyId, url, path, alt: String(photo.alt ?? '').trim().slice(0, ALT_MAX) || null, position: last + 1,
  }).returning({ id: directory_photos.id });
  if (!row.cover_photo_id) await db.update(directory_listings).set({ cover_photo_id: created.id }).where(eq(directory_listings.company_id, companyId));
  return { error: null, id: created.id };
}

export async function removeListingPhoto(id: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const photo = await photoOf(companyId, id);
  if (!photo) return { error: NO_PHOTO };
  await db.delete(directory_photos).where(eq(directory_photos.id, photo.id));
  const row = await listingOf(companyId);
  if (row?.cover_photo_id === photo.id) {
    const [next] = await db.select({ id: directory_photos.id }).from(directory_photos).where(eq(directory_photos.company_id, companyId))
      .orderBy(asc(directory_photos.position), asc(directory_photos.created_at)).limit(1);
    await db.update(directory_listings).set({ cover_photo_id: next?.id ?? null }).where(eq(directory_listings.company_id, companyId));
  }
  return { error: null };
}

/** Nouvel ordre des photos : les identifiants donnés d'abord, dans cet ordre, les autres ensuite. */
export async function reorderListingPhotos(ids: string[]): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const wanted = Array.isArray(ids) ? ids : [];
  const own = await db.select({ id: directory_photos.id }).from(directory_photos).where(eq(directory_photos.company_id, companyId))
    .orderBy(asc(directory_photos.position), asc(directory_photos.created_at));
  const ownIds = new Set(own.map((p) => p.id));
  if (new Set(wanted).size !== wanted.length || wanted.some((id) => !ownIds.has(id))) return { error: NO_PHOTO };
  const order = [...wanted, ...own.map((p) => p.id).filter((id) => !wanted.includes(id))];
  await db.transaction(async (tx) => {
    for (const [position, id] of order.entries()) {
      await tx.update(directory_photos).set({ position }).where(eq(directory_photos.id, id));
    }
  });
  return { error: null };
}

export async function setListingCover(id: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const photo = await photoOf(companyId, id);
  if (!photo) return { error: NO_PHOTO };
  await db.update(directory_listings).set({ cover_photo_id: photo.id }).where(eq(directory_listings.company_id, companyId));
  return { error: null };
}

export async function updateListingPhotoAlt(id: string, alt: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const photo = await photoOf(companyId, id);
  if (!photo) return { error: NO_PHOTO };
  await db.update(directory_photos).set({ alt: String(alt ?? '').trim().slice(0, ALT_MAX) || null }).where(eq(directory_photos.id, photo.id));
  return { error: null };
}

// ── Brochures exposées ──────────────────────────────────────────────────────

/** Les brochures de la fiche : un lien « Choisir Mon Traiteur » par brochure choisie, pour compter les demandes venues de l'annuaire. */
export async function setListingBrochures(brochureIds: string[]): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  if (!(await listingOf(companyId))) return { error: NO_LISTING };
  const asked = Array.isArray(brochureIds) ? brochureIds : [];
  if (asked.some((i) => typeof i !== 'string' || !UUID.test(i))) return { error: NO_BROCHURE };
  const ids = [...new Set(asked)];

  const owned = ids.length
    ? await db.select({ id: brochures.id, owner: brochures.owner_user_id }).from(brochures)
      .where(and(inArray(brochures.id, ids), sql`${brochures.owner_user_id} in ${companyIdsOf(user.id)}`))
    : [];
  if (owned.length !== ids.length) return { error: NO_BROCHURE };

  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      const [existing] = await tx.select({ id: brochure_links.id }).from(brochure_links)
        .where(and(eq(brochure_links.brochure_id, id), eq(brochure_links.kind, 'source'), eq(brochure_links.label, LINK_LABEL))).limit(1);
      const linkId = existing?.id ?? (await tx.insert(brochure_links).values({
        brochure_id: id, owner_user_id: owned.find((b) => b.id === id)!.owner, token: newLinkToken(), kind: 'source', label: LINK_LABEL,
      }).returning({ id: brochure_links.id }))[0].id;
      await tx.insert(directory_listing_brochures).values({ company_id: companyId, brochure_id: id, link_id: linkId, position })
        .onConflictDoUpdate({ target: [directory_listing_brochures.company_id, directory_listing_brochures.brochure_id], set: { link_id: linkId, position } });
    }
    // Les brochures décochées quittent la fiche ; leur lien reste (ses chiffres aussi).
    const kept = ids.length ? sql`${directory_listing_brochures.brochure_id} not in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})` : undefined;
    await tx.delete(directory_listing_brochures).where(and(eq(directory_listing_brochures.company_id, companyId), kept));
  });
  return { error: null };
}

// ── Envoi et retrait ────────────────────────────────────────────────────────

export async function submitListing(): Promise<{ error: string | null; status?: ListingStatus }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const row = await listingOf(companyId);
  if (!row) return { error: NO_LISTING };
  if (row.status === 'suspendue') return { error: SUSPENDED };

  const fields = fieldsOf(row);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(directory_photos).where(eq(directory_photos.company_id, companyId));
  const missing = readyToSubmit(fields, n);
  if (missing) return { error: missing };

  // Le SIRET est vérifié auprès de l'annuaire des entreprises de l'État ; un SIRET déjà porté par une autre fiche
  // en ligne ou en attente est un doublon.
  const found = await findCompanyBySiret(fields.siret!);
  const [other] = await db.select({ id: directory_listings.company_id }).from(directory_listings)
    .where(and(eq(directory_listings.siret, fields.siret!), ne(directory_listings.company_id, companyId), inArray(directory_listings.status, ['publiee', 'en_attente']))).limit(1);
  const now = new Date();
  const check = companyCheck({ siret: fields.siret!, displayName: fields.displayName, postalCode: fields.postalCode }, found, { duplicate: !!other, now });

  const at = now.toISOString();
  // Une fiche déjà en ligne le reste (ses modifications sont libres) ; sinon elle est publiée si le contrôle réussit, mise en attente sinon.
  const status: ListingStatus = row.status === 'publiee' || check.ok ? 'publiee' : 'en_attente';
  await db.update(directory_listings).set({
    status, check_result: check, submitted_at: at, refused_reason: null, updated_at: at,
    ...(status === 'publiee' && row.status !== 'publiee' ? { validated_at: at, published_at: row.published_at ?? at } : {}),
  }).where(eq(directory_listings.company_id, companyId));
  return { error: null, status };
}

export async function withdrawListing(): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const companyId = await companyIdFor(user.id);
  const row = await listingOf(companyId);
  if (!row) return { error: NO_LISTING };
  if (row.status === 'suspendue') return { error: SUSPENDED };
  await db.update(directory_listings).set({ status: 'brouillon', updated_at: new Date().toISOString() }).where(eq(directory_listings.company_id, companyId));
  return { error: null };
}
