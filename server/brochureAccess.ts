import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochure_links, brochures, profiles } from '@/db/schema';
import { pushToUser } from '@/lib/push';
import { companyIdsOf } from './companyScope';

// Accès à une brochure par un lien reçu : le lien principal (brochures.share_token) ou un lien supplémentaire
// (brochure_links : par source ou par client). Chacun peut être désactivé, expirer ou demander un code ; le code
// n'est jamais gardé en clair (empreinte), et un code juste ouvre la brochure pour 30 jours dans ce navigateur
// (cookie signé). Les notifications au traiteur (ouverture, arrivée au formulaire) partent d'ici, une au plus par
// demi-heure et par lien.

export type BrochureRow = typeof brochures.$inferSelect;
export type LinkRow = typeof brochure_links.$inferSelect;
export interface Access { row: BrochureRow; link: LinkRow | null; token: string }
export type Gate = 'ok' | 'code' | 'expired' | 'gone';

const TOKEN = /^[A-Za-z0-9_-]{16,}$/;
const secret = () => process.env.NEXTAUTH_SECRET ?? 'webodevis';

export const newLinkToken = () => crypto.randomBytes(18).toString('base64url');
/** Empreinte d'un code d'accès (insensible à la casse et aux espaces autour). */
export const hashCode = (code: string) => crypto.createHmac('sha256', secret()).update(`code:${code.trim().toLowerCase()}`).digest('hex');

/** Le lien reçu : brochure et lien supplémentaire éventuel ; null si le jeton n'existe pas. */
export async function findByToken(token: string): Promise<Access | null> {
  if (!TOKEN.test(token ?? '')) return null;
  const [row] = await db.select().from(brochures).where(eq(brochures.share_token, token)).limit(1);
  if (row) return { row, link: null, token };
  const [link] = await db.select().from(brochure_links).where(eq(brochure_links.token, token)).limit(1);
  if (!link) return null;
  const [b] = await db.select().from(brochures).where(eq(brochures.id, link.brochure_id)).limit(1);
  return b ? { row: b, link, token } : null;
}

const codeOf = (a: Access) => a.link?.access_code ?? a.row.access_code ?? null;
const cookieName = (token: string) => `wb_b_${crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
const cookieValue = (a: Access) => crypto.createHmac('sha256', secret()).update(`${a.token}:${codeOf(a)}`).digest('hex');

/** Où en est ce lien : ouvert, code demandé, expiré, ou plus disponible (désactivé, inconnu). */
export async function gateOf(a: Access | null, now = new Date()): Promise<Gate> {
  if (!a || !a.row.is_active || (a.link && !a.link.is_active)) return 'gone';
  const expired = [a.row.expires_at, a.link?.expires_at].some((d) => d && new Date(d) <= now);
  if (expired) return 'expired';
  if (codeOf(a)) {
    const jar = await cookies().catch(() => null);
    if (jar?.get(cookieName(a.token))?.value !== cookieValue(a)) return 'code';
  }
  return 'ok';
}

/** Le lien, seulement s'il est ouvert à ce lecteur. */
export async function openAccess(token: string): Promise<Access | null> {
  const a = await findByToken(token);
  return (await gateOf(a)) === 'ok' ? a : null;
}

/** Code juste : la brochure s'ouvre dans ce navigateur (30 jours). */
export async function unlock(a: Access, code: string): Promise<boolean> {
  const expected = codeOf(a);
  if (!expected || !code || !crypto.timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(expected))) return false;
  (await cookies()).set(cookieName(a.token), cookieValue(a), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400 });
  return true;
}

/** Quelqu'un de l'entreprise de la brochure (aperçu) : ni compté ni notifié. */
export async function isCompanyViewer(ownerId: string, viewerId: string | null): Promise<boolean> {
  if (!viewerId) return false;
  const [same] = await db.select({ id: profiles.id }).from(profiles)
    .where(and(eq(profiles.id, viewerId), sql`${profiles.id} in ${companyIdsOf(ownerId)}`)).limit(1);
  return !!same;
}

const QUIET_MS = 30 * 60_000;

/**
 * Notifie le traiteur (titulaire et auteur de la brochure) : ouverture du lien ou arrivée au formulaire. Une au plus
 * par demi-heure et par lien (la date est prise d'abord, en une écriture : deux ouvertures simultanées n'en font
 * qu'une). Rien si les notifications de la brochure sont coupées.
 */
export async function notifyOwner(a: Access, kind: 'open' | 'form', now = new Date()): Promise<boolean> {
  if (!a.row.notify) return false;
  const limit = new Date(now.getTime() - QUIET_MS).toISOString();
  const stamp = now.toISOString();
  const won = a.link
    ? await db.update(brochure_links).set(kind === 'open' ? { open_notified_at: stamp } : { form_notified_at: stamp })
      .where(and(eq(brochure_links.id, a.link.id), sql`coalesce(${kind === 'open' ? brochure_links.open_notified_at : brochure_links.form_notified_at}, '-infinity') < ${limit}`))
      .returning({ id: brochure_links.id })
    : await db.update(brochures).set(kind === 'open' ? { open_notified_at: stamp } : { form_notified_at: stamp })
      .where(and(eq(brochures.id, a.row.id), sql`coalesce(${kind === 'open' ? brochures.open_notified_at : brochures.form_notified_at}, '-infinity') < ${limit}`))
      .returning({ id: brochures.id });
  if (!won.length) return false;
  const who = a.link ? (a.link.kind === 'client' ? ` par ${a.link.label}` : ` (lien ${a.link.label})`) : '';
  const message = kind === 'open'
    ? { title: 'Brochure ouverte', body: `« ${a.row.name} » vient d’être ouverte${who}.` }
    : { title: 'Un lecteur arrive au formulaire', body: `Dans « ${a.row.name} »${who} : une demande peut arriver.` };
  const users = [...new Set([a.row.owner_user_id, a.row.user_id])];
  const existing = await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.id, users));
  await Promise.all(existing.map((u) => pushToUser(u.id, { ...message, url: `/brochures/${a.row.id}`, tag: `brochure-${kind}-${a.link?.id ?? a.row.id}` }).catch(() => 0)));
  return true;
}
