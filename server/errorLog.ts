import 'server-only';
import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { error_groups, profiles } from '@/db/schema';
import { appOrigin, sendMail } from '@/lib/mail';
import { errorAlertEmail } from '@/lib/mail/templates';

// Journal d'erreurs maison : chaque erreur (navigateur ou serveur) est rangée sous une empreinte — même message,
// même endroit du code — avec un compteur. L'équipe est prévenue par email à la première apparition, ou quand
// une erreur marquée résolue revient. Rien ne sort de la base de l'application.
// Ce module n'est pas une action serveur : il n'est appelé que par la route /api/erreurs et par instrumentation.ts.

export type ErrorSource = 'navigateur' | 'serveur';

export interface ErrorReport {
  source: ErrorSource;
  message: string;
  stack?: string | null;
  path?: string | null;
  userId?: string | null;
  userAgent?: string | null;
  digest?: string | null;
}

// Au-delà de 50 erreurs nouvelles en une heure (boucle, robot), les suivantes ne créent plus de ligne.
const MAX_NEW_PER_HOUR = 50;
const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

/** Message sans ce qui change d'une fois à l'autre (nombres, identifiants), pour regrouper les mêmes erreurs. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b[0-9a-f]{16,}\b/gi, '<id>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Premier cadre de la pile qui vient du code de l'application (sans numéros de ligne, qui changent à chaque version). */
export function firstFrame(stack: string | null | undefined): string {
  const lines = (stack ?? '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('at ') || l.includes('@'));
  const own = lines.find((l) => !/node_modules|node:internal|webpack-internal:\/\/\/\(app-pages-browser\)\/\.\/node_modules/.test(l)) ?? lines[0] ?? '';
  return own.replace(/:\d+:\d+\)?$/, '').replace(/\?[^)\s]*/, '').slice(0, 200);
}

export function fingerprintOf(r: Pick<ErrorReport, 'source' | 'message' | 'stack'>): string {
  return crypto.createHash('sha256').update(`${r.source}|${normalizeMessage(r.message)}|${firstFrame(r.stack)}`).digest('hex').slice(0, 32);
}

/** Chemin de la page, sans paramètres ni jetons des liens publics (devis client, mission d'extra, invitation). */
export function cleanPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const p = path.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+/, '');
  return p.replace(/^\/(d|e|p|embed|invitation)\/[^/]+/, '/$1/<jeton>').slice(0, 300);
}

export async function recordError(r: ErrorReport): Promise<void> {
  const message = clip(r.message?.trim() || 'Erreur sans message', 1000)!;
  const fingerprint = fingerprintOf({ ...r, message });
  const values = {
    source: r.source, message, stack: clip(r.stack, 8000), last_path: cleanPath(r.path),
    last_user_id: r.userId ?? null, last_user_agent: clip(r.userAgent, 300), digest: clip(r.digest, 100),
  };

  const [existing] = await db.select({ resolved: error_groups.resolved_at }).from(error_groups).where(eq(error_groups.fingerprint, fingerprint)).limit(1);
  if (existing) {
    await db.update(error_groups).set({
      ...values, count: sql`${error_groups.count} + 1`, last_seen: new Date().toISOString(), resolved_at: null,
    }).where(eq(error_groups.fingerprint, fingerprint));
    // Une erreur résolue qui revient est signalée de nouveau.
    if (existing.resolved) await notify(fingerprint, message, r.source, values.last_path, true);
    return;
  }

  const [{ recent }] = await db.select({ recent: sql<number>`count(*)::int` }).from(error_groups)
    .where(sql`${error_groups.first_seen} > now() - interval '1 hour'`);
  if (recent >= MAX_NEW_PER_HOUR) return;
  const inserted = await db.insert(error_groups).values({ fingerprint, ...values }).onConflictDoNothing().returning({ fingerprint: error_groups.fingerprint });
  if (inserted.length) await notify(fingerprint, message, r.source, values.last_path, false);
}

/** Email à l'équipe, au plus une fois par heure et par erreur. */
async function notify(fingerprint: string, message: string, source: ErrorSource, path: string | null, reappeared: boolean) {
  const claimed = await db.update(error_groups).set({ notified_at: new Date().toISOString() })
    .where(and(eq(error_groups.fingerprint, fingerprint), sql`(${error_groups.notified_at} is null or ${error_groups.notified_at} < now() - interval '1 hour')`))
    .returning({ fingerprint: error_groups.fingerprint });
  if (!claimed.length) return;
  const admins = process.env.CONTACT_EMAIL
    ? [process.env.CONTACT_EMAIL]
    : (await db.select({ email: profiles.email }).from(profiles).where(and(eq(profiles.role, 'admin'), eq(profiles.is_active, true)))).map((a) => a.email);
  const appUrl = await appOrigin().catch(() => 'https://webodevis.fr');
  await Promise.all(admins.map((to) => sendMail({ to, ...errorAlertEmail({ message, source, path, reappeared, appUrl }) })));
}

/** Nettoyage quotidien : erreurs résolues depuis 90 jours, ou plus vues depuis 180 jours. */
export async function purgeOldErrors(): Promise<void> {
  await db.delete(error_groups).where(sql`(${error_groups.resolved_at} < now() - interval '90 days') or (${error_groups.last_seen} < now() - interval '180 days')`);
}
