import 'server-only';

// Lecture publique de l'annuaire « Choisir Mon Traiteur » : ce que voit un visiteur anonyme. Toutes les lectures
// passent par `visibleListings`, qui applique listingVisible (fiche publiée, accès complet, compte actif et pas en
// cours de suppression, hors compte de démonstration). Les objets rendus ne portent ni SIRET, ni résultat du
// contrôle, ni motif de refus, ni e-mail, ni identifiant d'entreprise.

import { and, asc, desc, eq, inArray, isNull, gt, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { brochure_links, brochures, directory_listing_brochures, directory_listings, directory_photos, profiles } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { listingVisible, type ListingStatus } from '@/lib/annuaire/listing';
import { accessOf } from './subscription';

export interface ListingCard {
  slug: string;
  name: string;
  tagline: string;
  city: string;
  departments: string[];
  eventTypes: string[];
  coverUrl: string | null;
  logoUrl: string | null;
  priceFrom: number | null;
}

export interface PublicListing extends ListingCard {
  description: string;
  postalCode: string;
  websiteUrl: string | null;
  guestsMin: number | null;
  guestsMax: number | null;
  photos: { url: string; alt: string }[];
  brochures: { name: string; token: string; coverUrl: string | null }[];
  publishedAt: string;
  updatedAt: string;
}

type Visible = { companyId: string; row: typeof directory_listings.$inferSelect; logoUrl: string | null };

const iso = (v: string | null) => (v ? new Date(v).toISOString() : '');

/** Les fiches publiées qui répondent au filtre SQL, puis seulement celles dont le compte est en règle, la plus récente d'abord. */
async function visibleListings(where?: SQL): Promise<Visible[]> {
  const rows = await db
    .select({ row: directory_listings, logo: profiles.logo_url, active: profiles.is_active, deleting: profiles.deletion_requested_at })
    .from(directory_listings)
    .innerJoin(profiles, eq(profiles.id, directory_listings.company_id))
    .where(and(eq(directory_listings.status, 'publiee'), where))
    .orderBy(desc(directory_listings.published_at), asc(directory_listings.slug));
  const out: Visible[] = [];
  const candidates = rows.filter((r) => !isDemoUser(r.row.company_id));
  const accesses = await Promise.all(candidates.map((r) => accessOf(r.row.company_id)));
  candidates.forEach((r, i) => {
    const ok = listingVisible(
      { status: r.row.status as ListingStatus },
      { access: accesses[i], active: r.active, deleting: r.deleting !== null },
    );
    if (ok) out.push({ companyId: r.row.company_id, row: r.row, logoUrl: r.logo || null });
  });
  return out;
}

/** Photos de ces entreprises, dans l'ordre d'affichage. */
async function photosOf(companyIds: string[]) {
  if (!companyIds.length) return new Map<string, { id: string; url: string; alt: string | null }[]>();
  const rows = await db.select({ id: directory_photos.id, company: directory_photos.company_id, url: directory_photos.url, alt: directory_photos.alt })
    .from(directory_photos).where(inArray(directory_photos.company_id, companyIds))
    .orderBy(asc(directory_photos.position), asc(directory_photos.created_at));
  const by = new Map<string, { id: string; url: string; alt: string | null }[]>();
  for (const r of rows) by.set(r.company, [...(by.get(r.company) ?? []), { id: r.id, url: r.url, alt: r.alt }]);
  return by;
}

const coverOf = (v: Visible, photos: { id: string; url: string }[] = []) =>
  (photos.find((p) => p.id === v.row.cover_photo_id) ?? photos[0])?.url ?? null;

const cardOf = (v: Visible, photos: { id: string; url: string }[] = []): ListingCard => ({
  slug: v.row.slug,
  name: v.row.display_name,
  tagline: v.row.tagline ?? '',
  city: v.row.city ?? '',
  departments: v.row.departments,
  eventTypes: v.row.event_types,
  coverUrl: coverOf(v, photos),
  logoUrl: v.logoUrl,
  priceFrom: v.row.price_from === null ? null : Number(v.row.price_from),
});

export async function searchListings(q: { department?: string; eventType?: string }): Promise<ListingCard[]> {
  const filters: SQL[] = [];
  if (q.department) filters.push(sql`${directory_listings.departments} @> ARRAY[${q.department}]::text[]`);
  if (q.eventType) filters.push(sql`${directory_listings.event_types} @> ARRAY[${q.eventType}]::text[]`);
  const visible = await visibleListings(filters.length ? and(...filters) : undefined);
  const photos = await photosOf(visible.map((v) => v.companyId));
  return visible.map((v) => cardOf(v, photos.get(v.companyId)));
}

export async function getPublicListing(slug: string): Promise<PublicListing | null> {
  if (typeof slug !== 'string' || !slug) return null;
  const [v] = await visibleListings(eq(directory_listings.slug, slug));
  if (!v) return null;
  const photos = (await photosOf([v.companyId])).get(v.companyId) ?? [];
  // Brochures exposées, encore actives et dont le lien « Choisir Mon Traiteur » est actif et pas expiré.
  const shown = await db
    .select({ name: brochures.name, token: brochure_links.token, cover: sql<string | null>`${brochures.cover}->>'photoUrl'` })
    .from(directory_listing_brochures)
    .innerJoin(brochures, eq(brochures.id, directory_listing_brochures.brochure_id))
    .innerJoin(brochure_links, and(eq(brochure_links.id, directory_listing_brochures.link_id), eq(brochure_links.brochure_id, brochures.id)))
    .where(and(
      eq(directory_listing_brochures.company_id, v.companyId),
      eq(brochures.is_active, true),
      eq(brochure_links.is_active, true),
      or(isNull(brochure_links.expires_at), gt(brochure_links.expires_at, new Date().toISOString())),
    ))
    .orderBy(asc(directory_listing_brochures.position));
  return {
    ...cardOf(v, photos),
    description: v.row.description ?? '',
    postalCode: v.row.postal_code ?? '',
    websiteUrl: v.row.website_url,
    guestsMin: v.row.guests_min,
    guestsMax: v.row.guests_max,
    photos: photos.map((p) => ({ url: p.url, alt: p.alt ?? '' })),
    brochures: shown.map((b) => ({ name: b.name, token: b.token, coverUrl: b.cover || null })),
    publishedAt: iso(v.row.published_at),
    updatedAt: iso(v.row.updated_at),
  };
}

export async function departmentsWithListings(): Promise<{ code: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (const v of await visibleListings()) for (const code of new Set(v.row.departments)) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts].map(([code, count]) => ({ code, count })).sort((a, b) => a.code.localeCompare(b.code));
}

/** Les fiches publiques, pour le sitemap. */
export async function listPublicSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  return (await visibleListings()).map((v) => ({ slug: v.row.slug, updatedAt: iso(v.row.updated_at) }));
}

/** L'entreprise d'une fiche visible en public, ou null : la demande de contact n'est reçue que dans ce cas. */
export async function visibleListingOwner(slug: string): Promise<string | null> {
  if (typeof slug !== 'string' || !slug) return null;
  return (await visibleListings(eq(directory_listings.slug, slug)))[0]?.companyId ?? null;
}
