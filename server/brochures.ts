'use server';

// Brochures : gestion par le traiteur (son entreprise entière, comme les devis), lecture publique par le lien
// (jeton seul, aucun compte) et compte des ouvertures. Voir lib/brochure.ts pour le contenu et la mise en pages.

import crypto from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochures, prestations, profiles, prospect_requests } from '@/db/schema';
import { sanitizeHtml } from '@/lib/sanitize';
import { defaultVatRate } from '@/lib/vat';
import {
  BROCHURE_STYLES, paginateBrochure, parseBrochureContent,
  type BrochureContent, type BrochureCover, type BrochurePage, type BrochureStyle, type CatalogPrestation, type PriceOptions,
} from '@/lib/brochure';
import {
  layoutError, layoutFonts, layoutFromSimple, layoutPrestationIds, mergeLayout, parseLayout, resolveLayout, sanitizeLayout, sectionsFromLayout,
  type PublicPage,
} from '@/lib/brochureLayout';
import { appOrigin, sendMail } from '@/lib/mail';
import { brochureEmail } from '@/lib/mail/templates';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { isValidEmail, MAX_RECIPIENTS, splitEmails, uniqueEmails } from '@/lib/emailList';
import { googleFontsHref } from '@/lib/quoteOutput';
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
  /** Page « qui sommes-nous » (vide si elle est désactivée). */
  about: { html: string; photoUrl: string | null };
  /** Pages de l'éditeur simple, ou pages de la mise en page avancée (pages à blocs déjà résolues). */
  pages: PublicPage[];
  /** Feuille Google Fonts des polices choisies dans les blocs (éditeur avancé), ou null. */
  fontsHref: string | null;
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

type Editable = Pick<BrochureRow, 'name' | 'style' | 'language' | 'show_prices' | 'price_mode' | 'vat_rate' | 'cover' | 'content' | 'is_active' | 'layout'>;

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
  if (patch.layout !== undefined) {
    const layout = parseLayout(patch.layout);
    if (!layout) return { error: 'Mise en page illisible.' };
    const problem = layoutError(layout);
    if (problem) return { error: problem };
    set.layout = sanitizeLayout(layout);
  }
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
  const layout = row.editor_mode === 'advanced' ? parseLayout(row.layout) : null;
  const ids = [...new Set([
    ...parseBrochureContent(row.content).sections.flatMap((s) => s.items.map((i) => i.prestationId)),
    ...(layout ? layoutPrestationIds(layout) : []),
  ])].filter((i) => UUID.test(i));
  if (ids.length === 0) return new Map();
  const rows = await db.select({
    id: prestations.id, name: prestations.name, description: prestations.description,
    gastro_card_html: prestations.gastro_card_html, gastro_card_html_en: prestations.gastro_card_html_en,
    unit_price: prestations.unit_price, child_unit_price: prestations.child_unit_price,
    category: prestations.category, photo_url: prestations.photo_url,
  }).from(prestations).where(and(inArray(prestations.id, ids), sql`${prestations.user_id} in ${companyIdsOf(row.owner_user_id)}`));
  return new Map(rows.map((p) => [p.id, p]));
}

/** Tout ce que l'éditeur affiche : la brochure, le catalogue de l'entreprise (à piocher) et ses coordonnées (aperçu). */
export async function getBrochureEditorData(id: string): Promise<{ brochure: BrochureRow; catalog: CatalogPrestation[]; company: PublicBrochure['company'] } | null> {
  const user = await requireUser();
  const brochure = await getBrochure(id);
  if (!brochure) return null;
  const [company, catalog] = await Promise.all([
    companyProfile(brochure.owner_user_id),
    db.select({
      id: prestations.id, name: prestations.name, description: prestations.description,
      gastro_card_html: prestations.gastro_card_html, gastro_card_html_en: prestations.gastro_card_html_en,
      unit_price: prestations.unit_price, child_unit_price: prestations.child_unit_price,
      category: prestations.category, photo_url: prestations.photo_url,
    }).from(prestations).where(sql`${prestations.user_id} in ${companyIdsOf(user.id)}`).orderBy(prestations.category, prestations.name),
  ]);
  return {
    brochure, catalog,
    company: {
      name: company?.name ?? '', logoUrl: company?.logoUrl ?? null, address: company?.address ?? null,
      phone: company?.phone ?? null, email: company?.email ?? null, website: company?.website ?? null,
    },
  };
}

/** Pages du lien public : mise en page avancée (pages à blocs résolues) ou pagination de l'éditeur simple. */
function publicPages(row: BrochureRow, content: BrochureContent, catalog: Map<string, CatalogPrestation>, o: Omit<PriceOptions, 'forEditor'>): PublicPage[] {
  const layout = row.editor_mode === 'advanced' ? parseLayout(row.layout) : null;
  if (!layout) return paginateBrochure(content, catalog, row.style as BrochureStyle, { ...o, forEditor: false });
  return resolveLayout(layout, catalog, { ...o, forEditor: false })
    .map((p): PublicPage => (p.kind === 'blocks' ? { kind: 'blocks', background: p.background, font: p.font, blocks: p.blocks } : { kind: p.kind }));
}

/**
 * Change d'éditeur. Vers l'avancé : conversion des pages simples, ou, si une mise en page avancée est gardée, choix
 * demandé (`needsChoice`) puis reprise (`resume`, mise à jour des prestations) ou nouvelle conversion. Vers le
 * simple : les sections sont reconstruites depuis les blocs (contenu gardé, disposition perdue), la mise en page
 * avancée reste de côté.
 */
export async function switchBrochureEditor(id: string, to: 'simple' | 'advanced', opts: { resume?: boolean } = {}): Promise<{ error: string | null; needsChoice?: boolean }> {
  const user = await requireWriter();
  const row = await getBrochure(id);
  if (!row) return { error: NOT_FOUND };
  const content = parseBrochureContent(row.content);
  const set: Partial<BrochureRow> = { editor_mode: to };
  if (to === 'simple') {
    const layout = parseLayout(row.layout);
    if (row.editor_mode === 'advanced' && layout) set.content = { ...content, sections: sectionsFromLayout(layout) };
  } else {
    const saved = parseLayout(row.layout);
    if (saved && row.editor_mode !== 'advanced' && opts.resume === undefined) return { error: null, needsChoice: true };
    set.layout = saved && (opts.resume || row.editor_mode === 'advanced')
      ? mergeLayout(saved, content)
      : layoutFromSimple(content, row.style as BrochureStyle, await catalogFor({ ...row, editor_mode: 'simple' }));
  }
  await db.update(brochures).set({ ...set, updated_at: new Date().toISOString() }).where(and(eq(brochures.id, row.id), mine(user.id)));
  return { error: null };
}

/** La brochure telle que le lecteur la feuillette, ou null (jeton invalide, inconnu, lien désactivé). */
export async function getPublicBrochure(token: string): Promise<PublicBrochure | null> {
  const row = await byToken(token, true);
  if (!row) return null;
  const [company, catalog] = await Promise.all([companyProfile(row.owner_user_id), catalogFor(row)]);
  const language = row.language === 'en' ? 'en' : 'fr';
  const style = row.style as BrochureStyle;
  const content = parseBrochureContent(row.content);
  return {
    name: row.name, style, language,
    cover: parseCover(row.cover, row.name),
    about: content.about.enabled ? { html: sanitizeHtml(content.about.html), photoUrl: content.about.photoUrl ?? null } : { html: '', photoUrl: null },
    pages: publicPages(row, content, catalog, { show: row.show_prices, mode: row.price_mode === 'ht' ? 'ht' : 'ttc', vatRate: Number(row.vat_rate), language }),
    fontsHref: row.editor_mode === 'advanced' ? googleFontsHref(layoutFonts(parseLayout(row.layout))) : null,
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

/**
 * Envoie le lien de la brochure par email, au nom de l'entreprise (une adresse ou plusieurs). Envoyée à une demande
 * de Prospects de l'entreprise encore « nouvelle », celle-ci passe à « Brochure envoyée ».
 */
export async function sendBrochure(input: { brochureId: string; to: string; message?: string; prospectId?: string }): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const recipients = uniqueEmails(splitEmails(input.to ?? ''));
  if (recipients.length === 0) return { error: 'Indiquez l’adresse email du destinataire.' };
  const invalid = recipients.filter((e) => !isValidEmail(e));
  if (invalid.length) return { error: invalid.length === 1 ? `L’adresse « ${invalid[0]} » n’est pas valide.` : `Ces adresses ne sont pas valides : ${invalid.join(', ')}.` };
  if (recipients.length > MAX_RECIPIENTS) return { error: `Une brochure part à ${MAX_RECIPIENTS} adresses au plus.` };

  const row = await getBrochure(input.brochureId);
  if (!row) return { error: NOT_FOUND };
  if (!row.is_active) return { error: 'Le lien de cette brochure est désactivé : réactivez-le avant de l’envoyer.' };
  const company = await companyProfile(row.owner_user_id);
  const companyName = company?.name || 'Votre traiteur';
  const mail = {
    fromName: companyName,
    replyTo: company?.email || user.email,
    ...brochureEmail({
      companyName, brochureName: row.name, message: input.message ?? null,
      link: `${await appOrigin()}/b/${row.share_token}`, language: row.language === 'en' ? 'en' : 'fr',
    }),
  };
  // Un email par destinataire, l'un après l'autre (Resend limite le nombre d'envois par seconde).
  const failed: string[] = [];
  for (const to of recipients) {
    const res = await sendMail({ to, ...mail });
    if (res.error) failed.push(to);
  }
  if (failed.length === recipients.length) return { error: 'L’email n’a pas pu partir. Vérifiez l’adresse, puis réessayez.' };

  if (input.prospectId && UUID.test(input.prospectId)) {
    await db.update(prospect_requests).set({ status: 'broch_envoyee', updated_at: new Date().toISOString() }).where(and(
      eq(prospect_requests.id, input.prospectId), eq(prospect_requests.status, 'nouveau'),
      sql`${prospect_requests.owner_user_id} in ${companyIdsOf(user.id)}`,
    ));
  }
  return failed.length ? { error: `L’email n’a pas pu partir vers : ${failed.join(', ')}.` } : { error: null };
}
