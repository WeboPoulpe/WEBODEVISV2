'use server';

// Liens d'une brochure, gérés par le traiteur : le lien principal (expiration, code, notifications) et des liens
// supplémentaires, par source (Instagram, salon, site…) ou par client (brochure personnalisée). Chacun a ses
// chiffres : ouvertures, dernière ouverture, demandes reçues.

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochure_links, brochures, prospect_requests } from '@/db/schema';
import { companyIdsOf } from './companyScope';
import { hashCode, newLinkToken } from './brochureAccess';
import { requireUser, requireWriter } from './session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'Brochure introuvable.';
const MAX_LINKS = 100;

export interface LinkSummary {
  /** null : le lien principal. */
  id: string | null;
  token: string;
  kind: 'main' | 'source' | 'client';
  label: string;
  greeting: string | null;
  expiresAt: string | null;
  hasCode: boolean;
  isActive: boolean;
  views: number;
  viewedAt: string | null;
  requests: number;
}

async function ownBrochure(userId: string, id: string) {
  if (!UUID.test(id ?? '')) return null;
  const [b] = await db.select().from(brochures).where(and(eq(brochures.id, id), sql`${brochures.owner_user_id} in ${companyIdsOf(userId)}`)).limit(1);
  return b ?? null;
}
async function ownLink(userId: string, id: string) {
  if (!UUID.test(id ?? '')) return null;
  const [l] = await db.select().from(brochure_links).where(and(eq(brochure_links.id, id), sql`${brochure_links.owner_user_id} in ${companyIdsOf(userId)}`)).limit(1);
  return l ?? null;
}

/** Date d'expiration saisie (AAAA-MM-JJ, fin de journée à Paris environ) ; null = sans expiration ; erreur si illisible. */
function expiry(v: unknown): string | null | Error {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Error('Date d’expiration invalide.');
  const d = new Date(`${v}T23:59:59+01:00`);
  return Number.isNaN(d.getTime()) ? new Error('Date d’expiration invalide.') : d.toISOString();
}
/** Code saisi : undefined = inchangé, '' ou null = retiré, sinon 4 à 40 caractères. */
function code(v: unknown): string | null | undefined | Error {
  if (v === undefined) return undefined;
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length < 4 || v.trim().length > 40) return new Error('Le code d’accès fait de 4 à 40 caractères.');
  return hashCode(v);
}

export async function listBrochureLinks(brochureId: string): Promise<LinkSummary[] | null> {
  const user = await requireUser();
  const b = await ownBrochure(user.id, brochureId);
  if (!b) return null;
  const links = await db.select().from(brochure_links).where(eq(brochure_links.brochure_id, b.id)).orderBy(desc(brochure_links.created_at));
  const counts = await db.select({ link: prospect_requests.brochure_link_id, n: sql<number>`count(*)::int` }).from(prospect_requests)
    .where(eq(prospect_requests.brochure_id, b.id)).groupBy(prospect_requests.brochure_link_id);
  const byLink = new Map(counts.map((c) => [c.link ?? 'main', c.n]));
  const linkViews = links.reduce((t, l) => t + l.view_count, 0);
  return [
    {
      id: null, token: b.share_token, kind: 'main', label: 'Lien principal', greeting: null, expiresAt: b.expires_at, hasCode: !!b.access_code,
      isActive: b.is_active, views: Math.max(0, b.view_count - linkViews), viewedAt: b.viewed_at, requests: byLink.get('main') ?? 0,
    },
    ...links.map((l): LinkSummary => ({
      id: l.id, token: l.token, kind: l.kind === 'client' ? 'client' : 'source', label: l.label, greeting: l.greeting, expiresAt: l.expires_at,
      hasCode: !!l.access_code, isActive: l.is_active, views: l.view_count, viewedAt: l.viewed_at, requests: byLink.get(l.id) ?? 0,
    })),
  ];
}

export async function createBrochureLink(brochureId: string, input: { kind: 'source' | 'client'; label: string; greeting?: string | null; expiresAt?: string | null; code?: string | null }): Promise<{ error: string | null; token?: string; id?: string }> {
  const user = await requireWriter();
  const b = await ownBrochure(user.id, brochureId);
  if (!b) return { error: NOT_FOUND };
  const label = String(input.label ?? '').trim().slice(0, 80);
  if (!label) return { error: input.kind === 'client' ? 'Indiquez le nom du client.' : 'Donnez un nom au lien (Instagram, salon…).' };
  const exp = expiry(input.expiresAt);
  if (exp instanceof Error) return { error: exp.message };
  const c = code(input.code);
  if (c instanceof Error) return { error: c.message };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(brochure_links).where(eq(brochure_links.brochure_id, b.id));
  if (n >= MAX_LINKS) return { error: `Une brochure a ${MAX_LINKS} liens au plus.` };
  const token = newLinkToken();
  const [row] = await db.insert(brochure_links).values({
    brochure_id: b.id, owner_user_id: b.owner_user_id, token, kind: input.kind === 'client' ? 'client' : 'source', label,
    greeting: input.kind === 'client' ? String(input.greeting ?? '').trim().slice(0, 140) || null : null,
    expires_at: exp, access_code: c ?? null,
  }).returning({ id: brochure_links.id });
  return { error: null, token, id: row.id };
}

export async function updateBrochureLink(id: string, patch: { label?: string; greeting?: string | null; expiresAt?: string | null; code?: string | null; isActive?: boolean }): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const l = await ownLink(user.id, id);
  if (!l) return { error: 'Lien introuvable.' };
  const set: Partial<typeof brochure_links.$inferInsert> = {};
  if (patch.label !== undefined) {
    const label = String(patch.label).trim().slice(0, 80);
    if (!label) return { error: 'Le nom du lien ne peut pas être vide.' };
    set.label = label;
  }
  if (patch.greeting !== undefined) set.greeting = String(patch.greeting ?? '').trim().slice(0, 140) || null;
  if (patch.expiresAt !== undefined) {
    const exp = expiry(patch.expiresAt);
    if (exp instanceof Error) return { error: exp.message };
    set.expires_at = exp;
  }
  const c = code(patch.code);
  if (c instanceof Error) return { error: c.message };
  if (c !== undefined) set.access_code = c;
  if (patch.isActive !== undefined) set.is_active = !!patch.isActive;
  if (Object.keys(set).length) await db.update(brochure_links).set(set).where(eq(brochure_links.id, l.id));
  return { error: null };
}

export async function deleteBrochureLink(id: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const l = await ownLink(user.id, id);
  if (!l) return { error: 'Lien introuvable.' };
  await db.delete(brochure_links).where(eq(brochure_links.id, l.id));
  return { error: null };
}

/** Lien principal : expiration, code d'accès, notifications au traiteur. */
export async function setBrochureAccess(brochureId: string, patch: { expiresAt?: string | null; code?: string | null; notify?: boolean }): Promise<{ error: string | null }> {
  const user = await requireWriter();
  const b = await ownBrochure(user.id, brochureId);
  if (!b) return { error: NOT_FOUND };
  const set: Partial<typeof brochures.$inferInsert> = {};
  if (patch.expiresAt !== undefined) {
    const exp = expiry(patch.expiresAt);
    if (exp instanceof Error) return { error: exp.message };
    set.expires_at = exp;
  }
  const c = code(patch.code);
  if (c instanceof Error) return { error: c.message };
  if (c !== undefined) set.access_code = c;
  if (patch.notify !== undefined) set.notify = !!patch.notify;
  if (Object.keys(set).length) await db.update(brochures).set(set).where(eq(brochures.id, b.id));
  return { error: null };
}

/** Demandes reçues par des liens supplémentaires (pour les fiches Prospects) : nom du lien par identifiant. */
export async function linkLabels(ids: string[]): Promise<Record<string, string>> {
  const user = await requireUser();
  const valid = [...new Set((ids ?? []).filter((i) => UUID.test(i)))].slice(0, 500);
  if (!valid.length) return {};
  const rows = await db.select({ id: brochure_links.id, label: brochure_links.label, kind: brochure_links.kind }).from(brochure_links)
    .where(and(inArray(brochure_links.id, valid), sql`${brochure_links.owner_user_id} in ${companyIdsOf(user.id)}`));
  return Object.fromEntries(rows.map((r) => [r.id, r.kind === 'client' ? `lien de ${r.label}` : `lien ${r.label}`]));
}
