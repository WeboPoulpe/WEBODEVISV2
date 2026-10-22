'use server';

// Brochures : gestion par le traiteur (son entreprise entière, comme les devis), lecture publique par le lien
// (jeton seul, aucun compte) et compte des ouvertures. Voir lib/brochure.ts pour le contenu et la mise en pages.

import crypto from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochures, prestations, profiles } from '@/db/schema';
import { sanitizeHtml } from '@/lib/sanitize';
import { defaultVatRate } from '@/lib/vat';
import {
  BROCHURE_STYLES, paginateBrochure, parseBrochureContent,
  type BrochureContent, type BrochureCover, type BrochurePage, type BrochureStyle, type CatalogPrestation,
} from '@/lib/brochure';
import { companyIdsOf } from './companyScope';
import { getSessionUser, requireUser, requireWriter } from './session';

export type BrochureRow = typeof brochures.$inferSelect;

export interface BrochureSummary {
  id: string;
  name: string;
  style: BrochureStyle;
  is_active: boolean;
  view_count: number;
  viewed_at: string | null;
  updated_at: string;
  share_token: string;
  coverPhotoUrl: string | null;
}

export interface PublicBrochure {
  name: string;
  style: BrochureStyle;
  language: 'fr' | 'en';
  cover: BrochureCover;
  pages: BrochurePage[];
  company: { name: string; logoUrl: string | null; address: string | null; phone: string | null; email: string | null; website: string | null };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{16,}$/;
const NOT_FOUND = 'Brochure introuvable.';

const newToken = () => crypto.randomBytes(18).toString('base64url');
const mine = (uid: string) => sql`${brochures.owner_user_id} in ${companyIdsOf(uid)}`;

/** Couverture lue en base ou envoyée par l'éditeur : textes simples, photo en adresse http(s). */
function parseCover(raw: unknown, fallbackTitle: string): BrochureCover {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const photo = typeof r.photoUrl === 'string' && /^https?:\/\//.test(r.photoUrl) ? r.photoUrl : null;
  return { title: text(r.title, 120) || fallbackTitle, subtitle: text(r.subtitle, 200) || null, photoUrl: photo };
}

/** Contenu nettoyé avant d'être enregistré : textes riches passés au nettoyage HTML. */
function cleanContent(raw: unknown): BrochureContent {
  const c = parseBrochureContent(raw);
  return {
    about: { ...c.about, html: sanitizeHtml(c.about.html) },
    contact: c.contact,
    sections: c.sections.map((s) => ({
      ...s,
      title: s.title.slice(0, 120),
      items: s.items.map((i) => (i.html ? { ...i, html: sanitizeHtml(i.html) } : i)),
    })),
  };
}

/** Le profil de l'entreprise : celui du titulaire, même pour une brochure faite par un collaborateur. */
async function companyProfile(userId: string) {
  const [p] = await db.select({
    name: profiles.company_name, logoUrl: profiles.logo_url, address: profiles.company_address, phone: profiles.company_phone,
    email: profiles.company_email, website: profiles.company_website, vat: profiles.default_vat_rate,
  }).from(profiles).where(sql`${profiles.id} = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${userId}::uuid)`).limit(1);
  return p ?? null;
}

export async function listBrochures(): Promise<BrochureSummary[]> {
  const user = await requireUser();
  const rows = await db.select().from(brochures).where(mine(user.id)).orderBy(desc(brochures.updated_at));
  return rows.map((b) => ({
    id: b.id, name: b.name, style: b.style as BrochureStyle, is_active: b.is_active, view_count: b.view_count,
    viewed_at: b.viewed_at, updated_at: b.updated_at, share_token: b.share_token,
    coverPhotoUrl: parseCover(b.cover, b.name).photoUrl ?? null,
  }));
}

export async function createBrochure(input: { name: string; style?: BrochureStyle }): Promise<{ error: string | null; id?: string }> {
  const user = await requireWriter();
  const name = (input.name ?? '').trim().slice(0, 120);
  if (!name) return { error: 'Donnez un nom à la brochure.' };
  const style = input.style && BROCHURE_STYLES.includes(input.style) ? input.style : 'editorial';
  const company = await companyProfile(user.id);
  const [row] = await db.insert(brochures).values({
    owner_user_id: user.id, user_id: user.id, name, style, share_token: newToken(),
    vat_rate: String(defaultVatRate(company ? { default_vat_rate: company.vat } : null)),
    cover: { title: name }, content: parseBrochureContent(null),
  }).returning({ id: brochures.id });
  return { error: null, id: row.id };
}

export async function getBrochure(id: string): Promise<BrochureRow | null> {
  const user = await requireUser();
  if (!UUID.test(id ?? '')) return null;
  const [row] = await db.select().from(brochures).where(and(eq(brochures.id, id), mine(user.id))).limit(1);
  return row ?? null;
}

type Editable = Pick<BrochureRow, 'name' | 'style' | 'language' | 'show_prices' | 'price_mode' | 'vat_rate' | 'cover' | 'content' | 'is_active'>;

export async function saveBrochure(id: string, patch: Partial<Editable>): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (!UUID.test(id ?? '')) return { error: NOT_FOUND };
  const set: Partial<BrochureRow> = {};
  if (patch.name !== undefined) {
    const name = String(patch.name).trim().slice(0, 120);
    if (!name) return { error: 'Donnez un nom à la brochure.' };
    set.name = name;
  }
  if (patch.style !== undefined) {
    if (!BROCHURE_STYLES.includes(patch.style as BrochureStyle)) return { error: 'Style inconnu.' };
    set.style = patch.style;
  }
  if (patch.language !== undefined) set.language = patch.language === 'en' ? 'en' : 'fr';
  if (patch.price_mode !== undefined) set.price_mode = patch.price_mode === 'ht' ? 'ht' : 'ttc';
  if (patch.show_prices !== undefined) set.show_prices = !!patch.show_prices;
  if (patch.is_active !== undefined) set.is_active = !!patch.is_active;
  if (patch.vat_rate !== undefined) {
    const rate = Number(patch.vat_rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 30) return { error: 'Taux de TVA invalide.' };
    set.vat_rate = String(rate);
  }
  if (patch.cover !== undefined) set.cover = parseCover(patch.cover, set.name ?? '');
  if (patch.content !== undefined) set.content = cleanContent(patch.content);
  const done = await db.update(brochures).set({ ...set, updated_at: new Date().toISOString() })
    .where(and(eq(brochures.id, id), mine(user.id))).returning({ id: brochures.id });
  return done.length ? { error: null } : { error: NOT_FOUND };
}

export async function duplicateBrochure(id: string): Promise<{ error: string | null; id?: string }> {
  const user = await requireWriter();
  const source = await getBrochure(id);
  if (!source) return { error: NOT_FOUND };
  const [row] = await db.insert(brochures).values({
    owner_user_id: user.id, user_id: user.id, name: `${source.name} (copie)`.slice(0, 120), style: source.style,
    language: source.language, show_prices: source.show_prices, price_mode: source.price_mode, vat_rate: source.vat_rate,
    is_active: true, share_token: newToken(), cover: source.cover, content: source.content,
  }).returning({ id: brochures.id });
  return { error: null, id: row.id };
}

export async function deleteBrochure(id: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (!UUID.test(id ?? '')) return { error: NOT_FOUND };
  const done = await db.delete(brochures).where(and(eq(brochures.id, id), mine(user.id))).returning({ id: brochures.id });
  return done.length ? { error: null } : { error: NOT_FOUND };
}

/** Nouveau lien : l'ancien cesse de marcher. */
export async function renewBrochureLink(id: string): Promise<{ error: string | null; token?: string }> {
  const user = await requireWriter();
  if (!UUID.test(id ?? '')) return { error: NOT_FOUND };
  const token = newToken();
  const done = await db.update(brochures).set({ share_token: token, updated_at: new Date().toISOString() })
    .where(and(eq(brochures.id, id), mine(user.id))).returning({ id: brochures.id });
  return done.length ? { error: null, token } : { error: NOT_FOUND };
}

async function byToken(token: string, activeOnly: boolean): Promise<BrochureRow | null> {
  if (!TOKEN.test(token ?? '')) return null;
  const [row] = await db.select().from(brochures)
    .where(and(eq(brochures.share_token, token), ...(activeOnly ? [eq(brochures.is_active, true)] : []))).limit(1);
  return row ?? null;
}

/** Prestations du catalogue de l'entreprise citées par la brochure. */
async function catalogFor(row: BrochureRow): Promise<Map<string, CatalogPrestation>> {
  const ids = [...new Set(parseBrochureContent(row.content).sections.flatMap((s) => s.items.map((i) => i.prestationId)))].filter((i) => UUID.test(i));
  if (ids.length === 0) return new Map();
  const rows = await db.select({
    id: prestations.id, name: prestations.name, description: prestations.description,
    gastro_card_html: prestations.gastro_card_html, gastro_card_html_en: prestations.gastro_card_html_en,
    unit_price: prestations.unit_price, child_unit_price: prestations.child_unit_price,
    category: prestations.category, photo_url: prestations.photo_url,
  }).from(prestations).where(and(inArray(prestations.id, ids), sql`${prestations.user_id} in ${companyIdsOf(row.owner_user_id)}`));
  return new Map(rows.map((p) => [p.id, p]));
}

/** La brochure telle que le lecteur la feuillette, ou null (jeton invalide, inconnu, lien désactivé). */
export async function getPublicBrochure(token: string): Promise<PublicBrochure | null> {
  const row = await byToken(token, true);
  if (!row) return null;
  const [company, catalog] = await Promise.all([companyProfile(row.owner_user_id), catalogFor(row)]);
  const language = row.language === 'en' ? 'en' : 'fr';
  const style = row.style as BrochureStyle;
  return {
    name: row.name, style, language,
    cover: parseCover(row.cover, row.name),
    pages: paginateBrochure(parseBrochureContent(row.content), catalog, style, {
      show: row.show_prices, mode: row.price_mode === 'ht' ? 'ht' : 'ttc', vatRate: Number(row.vat_rate), language, forEditor: false,
    }),
    company: {
      name: company?.name ?? '', logoUrl: company?.logoUrl ?? null, address: company?.address ?? null,
      phone: company?.phone ?? null, email: company?.email ?? null, website: company?.website ?? null,
    },
  };
}

/** Lien désactivé : de quoi joindre l'entreprise sur la page « plus disponible ». */
export async function brochureUnavailableCompany(token: string): Promise<{ name: string; email: string | null } | null> {
  const row = await byToken(token, false);
  if (!row) return null;
  const company = await companyProfile(row.owner_user_id);
  return company?.name ? { name: company.name, email: company.email ?? null } : null;
}

/** Compte une ouverture du lien, sauf quand c'est quelqu'un de l'entreprise (aperçu). */
export async function recordBrochureView(token: string): Promise<void> {
  const row = await byToken(token, true);
  if (!row) return;
  const viewer = await getSessionUser().catch(() => null);
  if (viewer) {
    const [same] = await db.select({ id: profiles.id }).from(profiles)
      .where(and(eq(profiles.id, viewer.id), sql`${profiles.id} in ${companyIdsOf(row.owner_user_id)}`)).limit(1);
    if (same) return;
  }
  await db.update(brochures).set({ view_count: sql`${brochures.view_count} + 1`, viewed_at: new Date().toISOString() })
    .where(eq(brochures.id, row.id));
}
