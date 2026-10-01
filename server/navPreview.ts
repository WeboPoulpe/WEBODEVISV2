'use server';

import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { addDays, parisToday, relativeDay } from '@/lib/dashboard';
import { checklistProgress, materialProgress } from '@/lib/events/prep';
import { enabledModules } from '@/lib/modules';
import type { NavPreviewKey } from '@/lib/navMega';
import { CONFIRMED_STATUSES, PENDING_STATUSES, quoteStatusLabel } from '@/lib/quoteStatus';
import { requireUser } from './session';

// Aperçu vivant du mégamenu de la barre latérale : quelques lignes et un ou deux chiffres par page.
// Chargé seulement à l'ouverture d'un panneau (et gardé un moment par le navigateur) ; une à trois
// requêtes regroupées par page, jamais une par ligne. Mêmes droits que server/dashboard.ts.

export type NavPreviewTone = 'ok' | 'warn' | 'muted';

export interface NavPreviewItem {
  id: string;
  label: string;
  detail?: string;
  href: string;
  tag?: { text: string; tone: NavPreviewTone };
}

export interface NavPreview {
  title: string;
  items: NavPreviewItem[];
  /** Texte affiché quand la liste est vide. */
  empty: string;
  stats: { label: string; value: number; href?: string; tone?: NavPreviewTone }[];
}

/** Un devis envoyé sans réponse depuis ce nombre de jours est à relancer (comme au tableau de bord). */
const RELANCE_DAYS = 7;

const list = (values: readonly string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);
const rows = async <T>(query: SQL) => (await db.execute(query)).rows as T[];
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function getNavPreview(key: NavPreviewKey, clientToday?: string): Promise<NavPreview | null> {
  const { id: uid } = await requireUser();
  const today = clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday) ? clientToday : parisToday();
  const [profile] = await rows<{ modules: unknown }>(sql`select modules from public.profiles where id = ${uid}`);
  const modules = enabledModules(profile?.modules);
  const on = (m: string) => modules.includes(m);

  // Devis de l'entreprise (mêmes droits que la règle « quotes » de server/compat/rules.ts).
  const access = sql`(q.user_id = ${uid} or q.owner_user_id = ${uid} or q.owner_user_id in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`;
  const upcomingConfirmed = sql`${access} and q.status in (${list(CONFIRMED_STATUSES)}) and q.event_date >= ${today}::date`;
  const when = (iso: string) => relativeDay(iso, today);
  /** Détail d'une ligne : morceaux séparés par des virgules, majuscule au début. */
  const detail = (parts: (string | null | undefined)[], sep = ', ') => upper(parts.filter(Boolean).join(sep));

  switch (key) {
    case 'devis': {
      const [recent, [counts]] = await Promise.all([
        rows<{ id: string; name: string; event_type: string | null; event_date: string; status: string }>(sql`
          select q.id, coalesce(nullif(trim(q.internal_name), ''), q.client_name, 'Sans nom') as name, q.event_type,
            q.event_date::text as event_date, q.status
          from public.quotes q where ${access}
          order by q.updated_at desc limit 3`),
        rows<{ pending: number; relance: number }>(sql`
          select count(*) filter (where q.status in (${list(PENDING_STATUSES)}) and q.event_date >= ${today}::date)::int as pending,
            count(*) filter (where q.status in ('devis_envoye', 'devis_final') and q.event_date >= ${today}::date
              and q.sent_at is not null and (q.sent_at at time zone 'Europe/Paris')::date < ${addDays(today, -RELANCE_DAYS)}::date)::int as relance
          from public.quotes q where ${access}`),
      ]);
      return {
        title: 'Derniers devis modifiés',
        empty: 'Aucun devis pour le moment.',
        items: recent.map((q) => ({
          id: q.id, label: q.name, href: `/devis/${q.id}/modifier`,
          detail: detail([q.event_type, when(q.event_date)]),
          tag: { text: quoteStatusLabel(q.status), tone: 'muted' },
        })),
        stats: [
          { label: 'en cours', value: counts?.pending ?? 0, href: '/devis' },
          { label: 'à relancer', value: counts?.relance ?? 0, href: '/', tone: (counts?.relance ?? 0) > 0 ? 'warn' : undefined },
        ],
      };
    }

    case 'evenements':
    case 'calendrier': {
      const week = key === 'calendrier';
      const end = addDays(today, 6);
      const [events, [count], courses, team] = await Promise.all([
        rows<{ id: string; client_name: string; event_type: string | null; event_date: string; guest_count: number | null; checklist: unknown; event_materials: unknown; event_material_checks: unknown; services: unknown }>(sql`
          select q.id, q.client_name, q.event_type, q.event_date::text as event_date, q.guest_count,
            q.checklist, q.event_materials, q.event_material_checks, q.services
          from public.quotes q where ${upcomingConfirmed} ${week ? sql`and q.event_date <= ${end}::date` : sql``}
          order by q.event_date limit 3`),
        rows<{ n: number }>(sql`select count(*)::int as n from public.quotes q where ${upcomingConfirmed} ${week ? sql`and q.event_date <= ${end}::date` : sql``}`),
        // Courses et équipe des trois prochains événements, en une requête chacune.
        !week && on('evenements') ? rows<{ quote_id: string; todo: number }>(sql`
          select ei.quote_id, count(*) filter (where not ei.checked)::int as todo
          from public.event_ingredients ei
          where ei.quote_id in (select q.id from public.quotes q where ${upcomingConfirmed} order by q.event_date limit 3)
          group by ei.quote_id`) : Promise.resolve([]),
        !week && on('evenements') && on('extras') ? rows<{ quote_id: string; waiting: number; refused: number }>(sql`
          select ee.quote_id, count(*) filter (where ee.status = 'a_solliciter')::int as waiting,
            count(*) filter (where ee.status = 'refuse')::int as refused
          from public.event_extras ee
          where ee.quote_id in (select q.id from public.quotes q where ${upcomingConfirmed} order by q.event_date limit 3)
          group by ee.quote_id`) : Promise.resolve([]),
      ]);
      const pointsOf = (e: (typeof events)[number]) => {
        const check = checklistProgress(e.checklist);
        const mat = materialProgress(e.event_materials, e.services, e.event_material_checks);
        const c = courses.find((r) => r.quote_id === e.id);
        const t = team.find((r) => r.quote_id === e.id);
        return (check.total - check.done > 0 ? 1 : 0) + (mat.total - mat.done > 0 ? 1 : 0)
          + (c && c.todo > 0 ? 1 : 0) + (t && t.waiting > 0 ? 1 : 0) + (t && t.refused > 0 ? 1 : 0);
      };
      const prepared = on('evenements');
      return {
        title: week ? 'Cette semaine' : 'Prochains événements',
        empty: week ? 'Aucun événement confirmé dans les sept prochains jours.' : 'Aucun événement confirmé à venir.',
        items: events.map((e) => {
          const points = !week && prepared ? pointsOf(e) : null;
          return {
            id: e.id, label: e.client_name || 'Sans nom',
            href: prepared ? `/evenements/${e.id}` : `/devis/${e.id}/modifier`,
            detail: detail([when(e.event_date), e.event_type, e.guest_count ? `${e.guest_count} couverts` : null]),
            tag: points === null ? undefined : points === 0
              ? { text: 'Prêt', tone: 'ok' as const }
              : { text: plural(points, 'point à régler', 'points à régler'), tone: 'warn' as const },
          };
        }),
        stats: [{ label: week ? 'dans les 7 jours' : 'à venir', value: count?.n ?? 0, href: prepared ? '/evenements' : '/calendrier' }],
      };
    }

    case 'prospects': {
      if (!on('prospects')) return null;
      const mine = sql`(p.owner_user_id = ${uid} or p.user_token in (select k.token from public.user_prospect_tokens k where k.user_id = ${uid}))`;
      const fresh = sql`${mine} and p.status = 'nouveau' and not exists (select 1 from public.quotes pq where pq.prospect_id = p.id::text)`;
      const [latest, [count]] = await Promise.all([
        rows<{ id: string; who: string; event_type: string | null; event_date: string | null; guest_count: number | null; created_day: string }>(sql`
          select p.id, trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as who, p.event_type,
            p.event_date::text as event_date, p.guest_count, (p.created_at at time zone 'Europe/Paris')::date::text as created_day
          from public.prospect_requests p where ${fresh}
          order by p.created_at desc limit 3`),
        rows<{ n: number }>(sql`select count(*)::int as n from public.prospect_requests p where ${fresh}`),
      ]);
      return {
        title: 'Demandes non traitées',
        empty: 'Aucune demande en attente.',
        items: latest.map((p) => ({
          id: p.id, label: p.who || 'Demande sans nom', href: `/prospects?convert=${p.id}`,
          detail: detail([p.event_type, p.guest_count ? `${p.guest_count} couverts` : null, p.event_date ? when(p.event_date) : null]),
          tag: { text: `Reçue ${relativeDay(p.created_day, today)}`, tone: 'muted' as const },
        })),
        stats: [{ label: 'à traiter', value: count?.n ?? 0, href: '/prospects', tone: (count?.n ?? 0) > 0 ? 'warn' : undefined }],
      };
    }

    case 'clients': {
      const [latest, [count]] = await Promise.all([
        rows<{ id: string; name: string; email: string; customer_type: string }>(sql`
          select c.id, c.email, c.customer_type::text as customer_type,
            case when c.customer_type = 'entreprise' then coalesce(nullif(trim(c.company_name), ''), c.email)
              else coalesce(nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.email) end as name
          from public.customers c where c.owner_user_id = ${uid}
          order by c.created_at desc limit 3`),
        rows<{ n: number }>(sql`select count(*)::int as n from public.customers c where c.owner_user_id = ${uid}`),
      ]);
      return {
        title: 'Clients récents',
        empty: 'Aucun client pour le moment.',
        items: latest.map((c) => ({
          id: c.id, label: c.name, href: `/clients?fiche=${c.id}`, detail: c.email,
          tag: { text: c.customer_type === 'entreprise' ? 'Entreprise' : 'Particulier', tone: 'muted' as const },
        })),
        stats: [{ label: count?.n === 1 ? 'client' : 'clients', value: count?.n ?? 0, href: '/clients' }],
      };
    }

    case 'stock': {
      if (!on('stock')) return null;
      const low = sql`i.user_id = ${uid} and coalesce(i.min_stock_alert, 0) > 0 and coalesce(i.stock_quantity, 0) <= i.min_stock_alert`;
      const [items, [count]] = await Promise.all([
        rows<{ id: string; name: string; stock_quantity: number | null; min_stock_alert: number | null; unit: string | null }>(sql`
          select i.id, i.name, i.stock_quantity::float as stock_quantity, i.min_stock_alert::float as min_stock_alert, i.unit
          from public.ingredients i where ${low}
          order by coalesce(i.stock_quantity, 0) / nullif(i.min_stock_alert, 0), i.name limit 3`),
        rows<{ n: number }>(sql`select count(*)::int as n from public.ingredients i where ${low}`),
      ]);
      const qty = (n: number | null, unit: string | null) => `${(n ?? 0).toLocaleString('fr-FR')}${unit ? ` ${unit}` : ''}`;
      return {
        title: 'Sous le seuil d’alerte',
        empty: 'Aucun ingrédient sous son seuil.',
        items: items.map((i) => ({
          id: i.id, label: i.name, href: '/stock?action=alertes',
          detail: `Reste ${qty(i.stock_quantity, i.unit)}, seuil ${qty(i.min_stock_alert, i.unit)}`,
          tag: { text: (i.stock_quantity ?? 0) <= 0 ? 'Épuisé' : 'Bas', tone: 'warn' as const },
        })),
        stats: [{ label: 'à commander', value: count?.n ?? 0, href: '/stock?action=alertes', tone: (count?.n ?? 0) > 0 ? 'warn' : undefined }],
      };
    }

    case 'extras': {
      if (!on('extras')) return null;
      const waiting = sql`e.user_id = ${uid} and ee.status = 'a_solliciter' and ${upcomingConfirmed}`;
      const [items, [count]] = await Promise.all([
        rows<{ id: string; quote_id: string; extra: string; role: string | null; client_name: string; event_date: string }>(sql`
          select ee.id, ee.quote_id, e.name as extra, e.role, q.client_name, q.event_date::text as event_date
          from public.event_extras ee
          join public.extras e on e.id = ee.extra_id
          join public.quotes q on q.id = ee.quote_id
          where ${waiting}
          order by q.event_date, e.name limit 3`),
        rows<{ n: number }>(sql`
          select count(*)::int as n from public.event_extras ee
          join public.extras e on e.id = ee.extra_id join public.quotes q on q.id = ee.quote_id
          where ${waiting}`),
      ]);
      return {
        title: 'Missions sans réponse',
        empty: 'Tous vos extras ont répondu.',
        items: items.map((a) => ({
          id: a.id, label: a.extra, href: `/evenements/${a.quote_id}?onglet=extras`,
          detail: detail([a.role, `${a.client_name}, ${relativeDay(a.event_date, today)}`], ' · '),
          tag: { text: 'En attente', tone: 'warn' as const },
        })),
        stats: [{ label: 'en attente', value: count?.n ?? 0, href: '/extras', tone: (count?.n ?? 0) > 0 ? 'warn' : undefined }],
      };
    }

    case 'commandes': {
      if (!on('stock')) return null;
      const [items, [count]] = await Promise.all([
        rows<{ id: string; supplier: string | null; ordered_day: string | null }>(sql`
          select o.id, s.name as supplier, (coalesce(o.ordered_at, o.created_at) at time zone 'Europe/Paris')::date::text as ordered_day
          from public.supplier_orders o left join public.suppliers s on s.id = o.supplier_id
          where o.user_id = ${uid} and o.status = 'sent'
          order by o.ordered_at limit 3`),
        rows<{ n: number }>(sql`select count(*)::int as n from public.supplier_orders o where o.user_id = ${uid} and o.status = 'sent'`),
      ]);
      return {
        title: 'Envoyées, pas encore reçues',
        empty: 'Aucune commande en attente de réception.',
        items: items.map((o) => ({
          id: o.id, label: o.supplier ?? 'Fournisseur', href: '/commandes',
          detail: o.ordered_day ? `Envoyée ${relativeDay(o.ordered_day, today)}` : 'Envoyée',
          tag: { text: 'À réceptionner', tone: 'warn' as const },
        })),
        stats: [{ label: 'à réceptionner', value: count?.n ?? 0, href: '/commandes' }],
      };
    }
  }
  return null;
}
