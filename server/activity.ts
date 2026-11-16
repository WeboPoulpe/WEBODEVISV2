'use server';

import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, entityHref, type ActivityAction, type ActivityEntity } from '@/lib/activity';
import { companyOf } from './companyScope';
import { requireUser } from './session';

// Lecture de l'historique (page Historique) : réservée au titulaire et aux gérants de l'entreprise.

export interface ActivityFilters {
  /** Jours au format AAAA-MM-JJ, heure de Paris, bornes incluses. */
  from?: string;
  to?: string;
  /** Un auteur (uuid), ou « client » pour les actions sans auteur (le client, les tâches automatiques). */
  actor?: string;
  entity?: ActivityEntity;
  action?: ActivityAction;
  q?: string;
  order?: 'desc' | 'asc';
  cursor?: string | null;
}

export interface ActivityEntry {
  id: string;
  at: string;
  /** Fin d'un regroupement de modifications (null quand la ligne n'a pas été prolongée). */
  until: string | null;
  actor: string | null;
  viaAdmin: boolean;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId: string | null;
  label: string;
  summary: string;
  details: Record<string, unknown> | null;
  /** Lien vers l'élément ; null s'il n'existe plus. */
  href: string | null;
}

export interface ActivityPage {
  allowed: boolean;
  entries: ActivityEntry[];
  next: string | null;
  people: { id: string; label: string }[];
}

const PAGE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED: ActivityPage = { allowed: false, entries: [], next: null, people: [] };

/** Éléments dont le lien mène à la fiche : on vérifie qu'ils existent encore. */
const EXISTENCE: Partial<Record<ActivityEntity, string>> = {
  devis: 'quotes', facture: 'customer_invoices', client: 'customers', brochure: 'brochures', prestation: 'prestations',
};

const encodeCursor = (at: string, id: string) => Buffer.from(`${at}|${id}`).toString('base64url');
function decodeCursor(c: string | null | undefined): { at: string; id: string } | null {
  if (!c) return null;
  const [at, id] = Buffer.from(c, 'base64url').toString().split('|');
  return at && id && UUID.test(id) && !Number.isNaN(Date.parse(at)) ? { at, id } : null;
}

type Row = {
  id: string; at: string; until: string; actor: string | null; via_admin: boolean; action: ActivityAction; entity: ActivityEntity;
  entity_id: string | null; label: string; summary: string; details: Record<string, unknown> | null;
};

export async function listActivity(f: ActivityFilters): Promise<ActivityPage> {
  const user = await requireUser();
  // Même règle que la gestion de l'équipe (server/team.ts) : le titulaire, ou un gérant.
  const me = (await db.execute(sql`select parent_user_id, company_role from public.profiles where id = ${user.id}::uuid`)) as unknown as
    { rows: { parent_user_id: string | null; company_role: string }[] };
  const p = me.rows[0];
  if (!p || (p.parent_user_id && p.company_role !== 'gerant')) return DENIED;

  const asc = f.order === 'asc';
  const where: SQL[] = [sql`a.company_id = ${companyOf(user.id)}`];
  if (f.from && DAY.test(f.from)) where.push(sql`a.created_at >= (${f.from}::date)::timestamp at time zone 'Europe/Paris'`);
  if (f.to && DAY.test(f.to)) where.push(sql`a.created_at < (${f.to}::date + 1)::timestamp at time zone 'Europe/Paris'`);
  if (f.actor === 'client') where.push(sql`a.actor_id is null`);
  else if (f.actor && UUID.test(f.actor)) where.push(sql`a.actor_id = ${f.actor}::uuid`);
  if (f.entity && (ACTIVITY_ENTITIES as readonly string[]).includes(f.entity)) where.push(sql`a.entity_type = ${f.entity}`);
  if (f.action && (ACTIVITY_ACTIONS as readonly string[]).includes(f.action)) where.push(sql`a.action = ${f.action}`);
  const q = (f.q ?? '').trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(a.summary ilike ${like} or a.entity_label ilike ${like} or coalesce(a.actor_label, '') ilike ${like})`);
  }
  const cursor = decodeCursor(f.cursor);
  if (cursor) {
    where.push(asc
      ? sql`(a.created_at, a.id) > (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
      : sql`(a.created_at, a.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`);
  }

  const res = (await db.execute(sql`
    select a.id, to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at,
           to_char(a.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as until, a.actor_label as actor, a.via_admin, a.action,
           a.entity_type as entity, a.entity_id, a.entity_label as label, a.summary, a.details
    from public.activity_log a
    where ${sql.join(where, sql` and `)}
    order by a.created_at ${asc ? sql`asc` : sql`desc`}, a.id ${asc ? sql`asc` : sql`desc`}
    limit ${PAGE + 1}`)) as unknown as { rows: Row[] };
  const rows = res.rows.slice(0, PAGE);
  const last = rows[rows.length - 1];
  const next = res.rows.length > PAGE && last ? encodeCursor(last.at, last.id) : null;

  // Liens : vérifier, type par type, que les éléments existent encore.
  const alive = new Set<string>();
  for (const [entity, table] of Object.entries(EXISTENCE)) {
    const ids = [...new Set(rows.filter((r) => r.entity === entity && r.entity_id).map((r) => r.entity_id!))];
    if (!ids.length) continue;
    const found = (await db.execute(sql`select id from ${sql.raw(`public.${table}`)} where id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)) as unknown as { rows: { id: string }[] };
    for (const r of found.rows) alive.add(r.id);
  }

  const people = (await db.execute(sql`
    select distinct on (a.actor_id) a.actor_id as id, coalesce(a.actor_label, '') as label
    from public.activity_log a
    where a.company_id = ${companyOf(user.id)} and a.actor_id is not null
    order by a.actor_id, a.created_at desc`)) as unknown as { rows: { id: string; label: string }[] };

  return {
    allowed: true,
    next,
    people: people.rows.sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    entries: rows.map((r) => {
      const checked = r.entity in EXISTENCE;
      const href = !r.entity_id ? (checked ? null : entityHref(r.entity, null))
        : checked && !alive.has(r.entity_id) ? null : entityHref(r.entity, r.entity_id);
      return {
        id: r.id, at: r.at, until: r.until !== r.at ? r.until : null, actor: r.actor, viaAdmin: r.via_admin,
        action: r.action, entity: r.entity, entityId: r.entity_id, label: r.label, summary: r.summary, details: r.details, href,
      };
    }),
  };
}
