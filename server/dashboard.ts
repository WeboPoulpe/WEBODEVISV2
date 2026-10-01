'use server';

import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  addDays, bucketOf, daysBetween, longDate, parisToday, relativeDay,
  type DashboardData, type TodoItem, type TodoKind, type TodoLink, type UpcomingEvent,
} from '@/lib/dashboard';
import { checklistProgress, materialProgress } from '@/lib/events/prep';
import { FAMILY_LABELS, roleFamily, suggestedStaff } from '@/lib/extras';
import { enabledModules } from '@/lib/modules';
import { CONFIRMED_STATUSES, PENDING_STATUSES } from '@/lib/quoteStatus';
import { quoteTotalTTC } from '@/lib/quoteTotals';
import { requireUser } from './session';

// Tableau de bord : tout ce qu'il faut faire, trié par échéance, et le résumé de l'activité.
// Une dizaine de requêtes lancées ensemble, chacune déjà regroupée (pas une requête par événement).
// Les droits sont ceux des règles de /api/db : devis de l'entreprise, le reste au compte connecté.

const MONTHS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
/** Ordre d'affichage à échéance égale : ce qui touche un événement d'abord. */
const KIND_ORDER: TodoKind[] = ['preparation', 'location', 'acompte', 'relance', 'prospect', 'devis', 'commande', 'stock', 'notification'];
/** Fenêtre des événements à préparer, en jours. */
const PREP_DAYS = 14;
/** Un devis envoyé sans réponse depuis ce nombre de jours est à relancer. */
const RELANCE_DAYS = 7;

interface QuoteRow {
  id: string; client_name: string; internal_name: string | null; event_type: string | null; event_date: string;
  guest_count: number | null; guest_count_adults: number | null; guest_count_children: number | null;
  status: string; total_amount: string | null; vat_rate: string | null; services: unknown;
  created_day: string; sent_day: string | null;
  checklist: unknown; event_materials: unknown; event_material_checks: unknown;
}

const list = (values: readonly string[]) => sql.join(values.map((v) => sql`${v}`), sql`, `);
const rows = async <T>(query: SQL) => (await db.execute(query)).rows as T[];
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « demain », « dans 3 jours », « le samedi 4 octobre ». */
const onDay = (iso: string, today: string) => {
  const rel = relativeDay(iso, today);
  return /^(dans|il y a|aujourd|demain|hier)/.test(rel) ? rel : `le ${rel}`;
};

export async function getDashboard(clientToday?: string): Promise<DashboardData> {
  const user = await requireUser();
  const uid = user.id;
  const today = clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday) ? clientToday : parisToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const sixMonthsStart = (() => {
    const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - 5, 1));
    return d.toISOString().slice(0, 10);
  })();
  const since = sixMonthsStart < yearStart ? sixMonthsStart : yearStart;
  const prepEnd = addDays(today, PREP_DAYS);

  const [profile] = await rows<{ modules: unknown }>(sql`select modules from public.profiles where id = ${uid}`);
  const modules = enabledModules(profile?.modules);
  const on = (key: string) => modules.includes(key);

  // Devis de l'entreprise (mêmes droits que la règle « quotes » de server/compat/rules.ts).
  const access = sql`(q.user_id = ${uid} or q.owner_user_id = ${uid} or q.owner_user_id in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`;
  const confirmedIn = list(CONFIRMED_STATUSES);
  const upcomingConfirmed = sql`${access} and q.status in (${confirmedIn}) and q.event_date >= ${today}::date`;
  const paris = (col: SQL) => sql`(${col} at time zone 'Europe/Paris')::date::text`;
  const none = Promise.resolve([] as never[]);

  const [quotes, [counts], prospects, assignments, extrasCount, courses, rentals, rentalModels, lowStock, orders, notifs] = await Promise.all([
    rows<QuoteRow>(sql`
      select q.id, q.client_name, q.internal_name, q.event_type, q.event_date::text as event_date, q.guest_count,
        q.guest_count_adults, q.guest_count_children, q.status, q.total_amount::text, q.vat_rate::text, q.services,
        ${paris(sql`q.created_at`)} as created_day, ${paris(sql`q.sent_at`)} as sent_day,
        q.checklist, q.event_materials, q.event_material_checks
      from public.quotes q
      where ${access} and (
        (q.status in (${list(PENDING_STATUSES)}) and q.event_date >= ${today}::date)
        or (q.status in (${confirmedIn}) and q.event_date >= ${since}::date)
      )
      order by q.event_date`),
    rows<{ confirmed: number; total: number; month: number }>(sql`
      select count(*) filter (where q.status in (${confirmedIn}))::int as confirmed, count(*)::int as total,
        count(*) filter (where q.created_at >= ${monthStart}::date)::int as month
      from public.quotes q where ${access} and q.created_at >= ${addDays(today, -365)}::date`),
    on('prospects') ? rows<{ id: string; first_name: string; last_name: string; event_type: string | null; event_date: string | null; guest_count: number | null; created_day: string; status: string; linked: boolean }>(sql`
      select p.id, p.first_name, p.last_name, p.event_type, p.event_date::text as event_date, p.guest_count, p.status,
        ${paris(sql`p.created_at`)} as created_day,
        exists (select 1 from public.quotes pq where pq.prospect_id = p.id::text) as linked
      from public.prospect_requests p
      where (p.owner_user_id = ${uid} or p.user_token in (select k.token from public.user_prospect_tokens k where k.user_id = ${uid}))
        and (p.created_at >= ${monthStart}::date or p.status = 'nouveau')
      order by p.created_at
      limit 300`) : none,
    on('evenements') && on('extras') ? rows<{ quote_id: string; status: string; role: string | null }>(sql`
      select ee.quote_id, ee.status, e.role
      from public.event_extras ee
      join public.extras e on e.id = ee.extra_id
      join public.quotes q on q.id = ee.quote_id
      where e.user_id = ${uid} and ${upcomingConfirmed}`) : none,
    on('evenements') && on('extras') ? rows<{ n: number }>(sql`select count(*)::int as n from public.extras where user_id = ${uid}`) : none,
    on('evenements') ? rows<{ quote_id: string; total: number; todo: number }>(sql`
      select ei.quote_id, count(*)::int as total, count(*) filter (where not ei.checked)::int as todo
      from public.event_ingredients ei join public.quotes q on q.id = ei.quote_id
      where ${upcomingConfirmed} group by ei.quote_id`) : none,
    on('evenements') ? rows<{ quote_id: string; total: number; todo: number }>(sql`
      select ri.quote_id, count(*)::int as total,
        count(*) filter (where not coalesce(ri.ordered, false) and not coalesce(ri.confirmed_individually, false))::int as todo
      from public.rental_items ri join public.quotes q on q.id = ri.quote_id
      where ${upcomingConfirmed} group by ri.quote_id`) : none,
    on('evenements') ? rows<{ used: boolean }>(sql`
      select (exists (select 1 from public.rental_templates where user_id = ${uid})
        or exists (select 1 from public.rental_template_sets where user_id = ${uid})) as used`) : none,
    on('stock') ? rows<{ name: string }>(sql`
      select name from public.ingredients
      where user_id = ${uid} and coalesce(min_stock_alert, 0) > 0 and coalesce(stock_quantity, 0) <= min_stock_alert
      order by name`) : none,
    on('stock') ? rows<{ id: string; supplier: string | null; ordered_day: string | null; event_id: string | null; event_date: string | null; client: string | null }>(sql`
      select o.id, s.name as supplier, ${paris(sql`coalesce(o.ordered_at, o.created_at)`)} as ordered_day,
        q.id as event_id, q.event_date::text as event_date, q.client_name as client
      from public.supplier_orders o
      left join public.suppliers s on s.id = o.supplier_id
      left join public.quotes q on q.id = o.event_id
      where o.user_id = ${uid} and o.status = 'sent'
      order by o.ordered_at`) : none,
    rows<{ id: string; title: string; message: string; type: string; action_url: string | null; created_day: string }>(sql`
      select n.id, n.title, n.message, n.type, n.action_url, ${paris(sql`n.created_at`)} as created_day
      from public.notifications n
      where n.user_id = ${uid} and not n.is_read and n.priority = 'high'
        and n.type not in ('prospect_request', 'stock_alert')
        and n.created_at >= ${addDays(today, -30)}::date
        and (n.expires_at is null or n.expires_at > now())
      order by n.created_at desc limit 10`),
  ]);

  const todo: TodoItem[] = [];
  const push = (item: Omit<TodoItem, 'bucket'>) => todo.push({ ...item, bucket: bucketOf(item.due, today) });
  const name = (q: QuoteRow) => (q.internal_name && q.internal_name.trim()) || q.client_name || 'Sans nom';
  const total = (q: QuoteRow) => quoteTotalTTC(q) ?? 0;
  const confirmed = quotes.filter((q) => (CONFIRMED_STATUSES as string[]).includes(q.status));
  const pending = quotes.filter((q) => (PENDING_STATUSES as string[]).includes(q.status));
  const future = confirmed.filter((q) => q.event_date >= today);

  // ── Demandes reçues ─────────────────────────────────────────────────────────
  // Une demande déjà transformée en devis est suivie par son devis.
  for (const p of prospects.filter((x) => x.status === 'nouveau' && !x.linked)) {
    const who = `${p.first_name} ${p.last_name}`.trim() || 'un prospect';
    const what = [p.event_type, p.guest_count ? `${p.guest_count} couverts` : null, p.event_date ? onDay(p.event_date, today) : null].filter(Boolean).join(', ');
    push({
      key: `prospect:${p.id}`, kind: 'prospect', title: `Répondre à la demande de ${who}`,
      detail: what ? `Demande de devis : ${what}` : 'Demande de devis reçue par votre formulaire',
      due: addDays(p.created_day, 2), when: `Reçue ${relativeDay(p.created_day, today)}`,
      href: `/prospects?convert=${p.id}`, action: 'Faire le devis',
    });
  }

  // ── Devis à faire et devis à relancer ───────────────────────────────────────
  for (const q of pending) {
    const what = [q.event_type, q.guest_count ? `${q.guest_count} couverts` : null, onDay(q.event_date, today)].filter(Boolean).join(', ');
    if (q.status === 'nouveau' || q.status === 'devis_a_faire') {
      const due = addDays(q.created_day, 3);
      push({
        key: `devis:${q.id}`, kind: 'devis', title: `Faire le devis de ${name(q)}`, detail: what,
        due: due < q.event_date ? due : q.event_date, when: `Événement ${onDay(q.event_date, today)}`,
        href: `/devis/${q.id}/modifier`, action: 'Ouvrir le devis',
      });
    } else if ((q.status === 'devis_envoye' || q.status === 'devis_final') && q.sent_day && daysBetween(q.sent_day, today) > RELANCE_DAYS) {
      const days = daysBetween(q.sent_day, today);
      const amount = total(q);
      push({
        key: `relance:${q.id}`, kind: 'relance', title: `Relancer ${name(q)} : devis envoyé il y a ${days} jours`,
        detail: [amount ? money(amount) : null, what].filter(Boolean).join(', '),
        due: addDays(q.sent_day, RELANCE_DAYS), when: `Sans réponse depuis ${days} jours`,
        href: `/devis/${q.id}/modifier`, action: 'Relancer',
      });
    }
  }

  // ── Acompte : devis validé sans acompte, événement dans le mois ─────────────
  for (const q of future.filter((x) => x.status === 'valide' && daysBetween(today, x.event_date) <= 30)) {
    const amount = total(q);
    push({
      key: `acompte:${q.id}`, kind: 'acompte', title: `Acompte à recevoir : ${name(q)}`,
      detail: `Devis validé${amount ? ` de ${money(amount)}` : ''}, aucun acompte enregistré`,
      due: addDays(q.event_date, -14), when: `Événement ${onDay(q.event_date, today)}`,
      href: `/devis/${q.id}/modifier`, action: 'Voir le devis',
    });
  }

  // ── Préparation des événements ──────────────────────────────────────────────
  const byQuote = <T extends { quote_id: string }>(list: T[]) => new Map(list.map((r) => [r.quote_id, r]));
  const coursesOf = byQuote(courses);
  const rentalsOf = byQuote(rentals);
  const usesRental = !!rentalModels[0]?.used;
  const usesExtras = (extrasCount[0]?.n ?? 0) > 0;

  /** Ce qui manque à un événement, avec l'onglet où le faire. La location est traitée à part. */
  function missingFor(q: QuoteRow): { links: TodoLink[]; rental: { label: string; todo: number } | null } {
    const tab = (t: string) => `/evenements/${q.id}?onglet=${t}`;
    const links: TodoLink[] = [];
    const check = checklistProgress(q.checklist);
    if (check.total > check.done) links.push({ label: `Checklist ${check.done} sur ${check.total}`, href: tab('checklist') });
    const mat = materialProgress(q.event_materials, q.services, q.event_material_checks);
    if (mat.total > mat.done) links.push({ label: `Matériel : ${plural(mat.total - mat.done, 'article', 'articles')} à préparer`, href: tab('materiel') });
    const c = coursesOf.get(q.id);
    if (c && c.todo > 0) links.push({ label: `Courses : ${plural(c.todo, 'article', 'articles')} à acheter`, href: tab('courses') });
    if (on('extras')) {
      const team = assignments.filter((a) => a.quote_id === q.id);
      const waiting = team.filter((a) => a.status === 'a_solliciter').length;
      const refused = team.filter((a) => a.status === 'refuse').length;
      if (refused) links.push({ label: `${plural(refused, 'extra indisponible', 'extras indisponibles')} à remplacer`, href: tab('extras') });
      if (waiting) links.push({ label: `${plural(waiting, 'extra', 'extras')} sans réponse`, href: tab('extras') });
      // Effectif conseillé : seulement pour un compte qui a des extras (sinon il travaille avec sa propre équipe).
      if (usesExtras) {
        const wanted = suggestedStaff(q.guest_count, q.event_type);
        const have = { service: 0, cuisine: 0, plonge: 0 };
        for (const a of team) {
          const f = roleFamily(a.role);
          if (a.status !== 'refuse' && f && f in have) have[f as keyof typeof have]++;
        }
        const short = (Object.keys(have) as (keyof typeof have)[])
          .filter((f) => wanted[f] > have[f])
          .map((f) => { const n = wanted[f] - have[f]; return `${n} ${FAMILY_LABELS[f][n > 1 ? 1 : 0]}`; });
        if (short.length) links.push({ label: `Équipe : il manque ${short.join(', ')}`, href: tab('extras') });
      }
    }
    const r = rentalsOf.get(q.id);
    const rental = !r || r.total === 0
      ? (usesRental ? { label: 'Location à prévoir', todo: 0 } : null)
      : r.todo > 0 ? { label: `Location : ${plural(r.todo, 'article', 'articles')} à commander`, todo: r.todo } : null;
    return { links, rental };
  }

  const prep = new Map<string, ReturnType<typeof missingFor>>();
  if (on('evenements')) for (const q of future) prep.set(q.id, missingFor(q));

  for (const q of future.filter((x) => x.event_date <= prepEnd)) {
    const m = prep.get(q.id);
    if (!m) continue;
    const when = `Événement ${onDay(q.event_date, today)}`;
    const detail = [upper(longDate(q.event_date, today)), q.guest_count ? `${q.guest_count} couverts` : null, q.event_type].filter(Boolean).join(', ');
    if (m.rental) {
      const toPlan = m.rental.todo === 0;
      push({
        key: `location:${q.id}`, kind: 'location',
        title: `${toPlan ? 'Location à prévoir' : 'Location à commander'} : ${q.client_name} (${relativeDay(q.event_date, today)})`,
        detail: [toPlan ? 'Aucune vaisselle ni matériel loué pour cet événement' : upper(m.rental.label.replace('Location : ', '')), q.guest_count ? `${q.guest_count} couverts` : null].filter(Boolean).join(', '),
        due: addDays(q.event_date, -7), when, href: `/evenements/${q.id}?onglet=materiel`, action: toPlan ? 'Prévoir la location' : 'Commander',
      });
    }
    if (m.links.length) {
      push({
        key: `preparation:${q.id}`, kind: 'preparation', title: `Préparer l’événement ${q.client_name}`, detail,
        due: addDays(q.event_date, -3), when, href: m.links[0].href, action: 'Préparer', links: m.links,
      });
    }
  }

  // ── Stock et commandes ──────────────────────────────────────────────────────
  if (lowStock.length) {
    const names = lowStock.slice(0, 4).map((i) => i.name).join(', ');
    push({
      key: 'stock', kind: 'stock', title: `Stock bas : ${plural(lowStock.length, 'ingrédient', 'ingrédients')} sous le seuil d’alerte`,
      detail: `${names}${lowStock.length > 4 ? '…' : ''}`, due: null, when: 'À commander',
      href: '/stock', action: 'Voir le stock',
    });
  }
  for (const o of orders) {
    const forEvent = o.event_date && o.event_date >= today ? o.event_date : null;
    const due = forEvent ? addDays(forEvent, -1) : o.ordered_day ? addDays(o.ordered_day, 3) : null;
    push({
      key: `commande:${o.id}`, kind: 'commande', title: `Vérifier la réception : commande ${o.supplier ?? 'fournisseur'}`,
      detail: forEvent && o.client ? `Pour ${o.client}, ${onDay(forEvent, today)}` : 'Envoyée, pas encore reçue',
      due, when: o.ordered_day ? `Envoyée ${relativeDay(o.ordered_day, today)}` : 'Envoyée',
      href: '/commandes', action: 'Voir la commande',
    });
  }

  // ── Notifications importantes non lues (sauf ce qui est déjà dans la liste) ─
  const listed = new Set(todo.filter((t) => t.kind === 'preparation').map((t) => t.key.split(':')[1]));
  for (const n of notifs) {
    const eventId = n.action_url?.match(/\/evenements\/([0-9a-f-]{36})/i)?.[1];
    if (eventId && listed.has(eventId)) continue;
    push({
      key: `notification:${n.id}`, kind: 'notification', title: n.title, detail: n.message,
      due: n.created_day, when: `Reçue ${relativeDay(n.created_day, today)}`,
      href: n.action_url && n.action_url.startsWith('/') ? n.action_url : '/notifications', action: 'Voir',
    });
  }

  todo.sort((a, b) =>
    (a.due ?? addDays(today, 7)).localeCompare(b.due ?? addDays(today, 7))
    || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    || a.title.localeCompare(b.title, 'fr'));

  // ── Résumé ──────────────────────────────────────────────────────────────────
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (5 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()], amount: 0 };
  });
  let caMonth = 0, caMonthEvents = 0, caYear = 0, caYearEvents = 0;
  for (const q of confirmed) {
    const amount = total(q);
    const month = months.find((m) => m.key === q.event_date.slice(0, 7));
    if (month) month.amount += amount;
    if (q.event_date.slice(0, 7) === today.slice(0, 7)) { caMonth += amount; caMonthEvents++; }
    if (q.event_date.slice(0, 4) === today.slice(0, 4)) { caYear += amount; caYearEvents++; }
  }

  const pipeline = PENDING_STATUSES
    .map((status) => {
      const of = pending.filter((q) => q.status === status);
      return { status, count: of.length, amount: of.reduce((s, q) => s + total(q), 0) };
    })
    .filter((s) => s.count > 0);

  const upcoming: UpcomingEvent[] = future.slice(0, 6).map((q) => {
    const m = prep.get(q.id);
    return {
      id: q.id, client: q.client_name || 'Sans nom', eventType: q.event_type, date: q.event_date,
      guests: q.guest_count ?? 0, total: quoteTotalTTC(q), status: q.status,
      missing: m ? [...m.links.map((l) => l.label), ...(m.rental ? [m.rental.label] : [])] : null,
    };
  });

  return {
    today,
    modules,
    todo,
    upcoming,
    summary: {
      caMonth, caMonthEvents, caYear, caYearEvents, months,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, q) => s + total(q), 0),
      pipeline,
      conversion: { confirmed: counts?.confirmed ?? 0, total: counts?.total ?? 0 },
      upcomingGuests: future.reduce((s, q) => s + (q.guest_count ?? 0), 0),
      upcomingEvents: future.length,
      requestsMonth: on('prospects') ? prospects.filter((p) => p.created_day >= monthStart).length : null,
      quotesMonth: counts?.month ?? 0,
    },
  };
}
