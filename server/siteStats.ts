import 'server-only';
import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { site_visits } from '@/db/schema';
import { RETENTION_MONTHS, cleanPath, deviceOf, isBot, sourceOf, type Device, type SiteEvent, type Source } from '@/lib/siteStats';
import { requireAdmin } from './session';

// Statistiques du site (voir lib/siteStats.ts). Pour ne pas réveiller la base Neon à chaque page vue (le temps de
// calcul est facturé), les visites attendent en mémoire et sont écrites par paquets, en une requête : dès
// FLUSH_COUNT visites, ou quand la plus ancienne attend depuis FLUSH_AGE_MS. Une instance arrêtée avant d'écrire
// perd son paquet : acceptable pour des statistiques. Les conversions faites côté serveur (contact, inscription)
// passent par recordEventNow, dans une requête qui écrit déjà : aucun réveil de plus.

export const FLUSH_COUNT = 100;
export const FLUSH_AGE_MS = 60 * 60_000;

type Row = typeof site_visits.$inferInsert;
let buffer: Row[] = [];
let oldest = 0;

const parisDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

function visitorOf(day: string, ip: string, ua: string): string {
  return crypto.createHash('sha256').update(`${day}|${ip}|${ua}|${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex').slice(0, 32);
}

export interface HitContext { ip: string; userAgent: string; ownHost: string }

/** Une ligne prête à écrire, ou null (robot, chemin invalide). */
export function buildRow(input: { path: string; referrer?: string | null; event?: SiteEvent }, ctx: HitContext, now = new Date()): Row | null {
  if (isBot(ctx.userAgent)) return null;
  const path = cleanPath(input.path);
  if (!path) return null;
  const day = parisDay(now);
  const { source, host } = sourceOf(input.referrer, ctx.ownHost);
  return {
    day, path, event: input.event ?? 'view', source, referrer_host: host, device: deviceOf(ctx.userAgent),
    visitor: visitorOf(day, ctx.ip, ctx.userAgent), created_at: now.toISOString(),
  };
}

/** Met la visite en attente ; écrit le paquet s'il est plein ou trop ancien. */
export async function recordHit(row: Row, now = Date.now()): Promise<void> {
  if (buffer.length === 0) oldest = now;
  buffer.push(row);
  if (buffer.length >= FLUSH_COUNT || now - oldest >= FLUSH_AGE_MS) await flushVisits();
}

export async function flushVisits(): Promise<void> {
  if (buffer.length === 0) return;
  const rows = buffer;
  buffer = [];
  await db.insert(site_visits).values(rows).catch((e) => console.error('[stats] écriture du paquet', e));
}

/** Conversion enregistrée tout de suite, pendant une requête qui écrit déjà en base (et avec le paquet en attente). */
export async function recordEventNow(event: SiteEvent, path: string, ctx: HitContext): Promise<void> {
  const row = buildRow({ path, event }, ctx);
  if (row) buffer.push(row);
  await flushVisits();
}

/** Les lignes de plus de 13 mois (tâche de nuit). */
export async function purgeOldVisits(): Promise<void> {
  await db.execute(sql`delete from public.site_visits where day < (current_date - make_interval(months => ${RETENTION_MONTHS}))`);
}

export function testOnlyResetBuffer() { buffer = []; oldest = 0; }

export interface SiteStats {
  days: number;
  totals: { visitors: number; views: number; demo: number; contact: number; signup: number };
  daily: { day: string; visitors: number; views: number }[];
  pages: { path: string; views: number }[];
  sources: { source: Source; visitors: number }[];
  referrers: { host: string; visitors: number }[];
  devices: { device: Device; visitors: number }[];
}

/** Les statistiques des `days` derniers jours, pour l'admin. Écrit d'abord le paquet en attente. */
export async function getSiteStats(days: number): Promise<SiteStats> {
  await requireAdmin();
  await flushVisits();
  const n = [7, 30, 90].includes(days) ? days : 30;
  const since = sql`current_date - ${n - 1}::int`;
  const q = async <T,>(query: ReturnType<typeof sql>) => (await db.execute(query)).rows as T[];

  const [totals] = await q<SiteStats['totals']>(sql`
    select
      (select count(*)::int from (select distinct day, visitor from public.site_visits where day >= ${since} and event = 'view') v) as visitors,
      count(*) filter (where event = 'view')::int as views,
      count(*) filter (where event = 'demo')::int as demo,
      count(*) filter (where event = 'contact')::int as contact,
      count(*) filter (where event = 'signup')::int as signup
    from public.site_visits where day >= ${since}`);
  const daily = await q<{ day: string; visitors: number; views: number }>(sql`
    select to_char(d, 'YYYY-MM-DD') as day,
      coalesce((select count(distinct visitor)::int from public.site_visits where day = d and event = 'view'), 0) as visitors,
      coalesce((select count(*)::int from public.site_visits where day = d and event = 'view'), 0) as views
    from generate_series(${since}, current_date, interval '1 day') d order by d`);
  const pages = await q<{ path: string; views: number }>(sql`
    select path, count(*)::int as views from public.site_visits where day >= ${since} and event = 'view'
    group by path order by views desc limit 10`);
  const sources = await q<{ source: Source; visitors: number }>(sql`
    select source, count(distinct (day, visitor))::int as visitors from public.site_visits where day >= ${since} and event = 'view'
    group by source order by visitors desc`);
  const referrers = await q<{ host: string; visitors: number }>(sql`
    select referrer_host as host, count(distinct (day, visitor))::int as visitors from public.site_visits
    where day >= ${since} and event = 'view' and referrer_host is not null group by referrer_host order by visitors desc limit 8`);
  const devices = await q<{ device: Device; visitors: number }>(sql`
    select device, count(distinct (day, visitor))::int as visitors from public.site_visits where day >= ${since} and event = 'view'
    group by device order by visitors desc`);

  return { days: n, totals, daily, pages, sources, referrers, devices };
}
