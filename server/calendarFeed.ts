import 'server-only';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { buildCalendar, type IcsEvent } from '@/lib/ical';
import { CONFIRMED_STATUSES, isConfirmed, PENDING_STATUSES } from '@/lib/quoteStatus';

// Abonnement agenda (iCal) : une adresse secrète, propre à chaque compte, que Google Agenda, Apple Calendrier
// ou Outlook relisent régulièrement. Elle donne les événements confirmés et les devis envoyés en attente
// (marqués « (option) »), sur douze mois passés et à venir. Le jeton ne s'écrit que côté serveur.
// Ce module n'est pas une action serveur : rien ici n'est appelable depuis le navigateur.

/** Nouveau jeton : 32 octets aléatoires, lisibles dans une adresse. */
export const newCalendarToken = () => randomBytes(32).toString('base64url');

export const isCalendarToken = (token: string) => /^[A-Za-z0-9_-]{32,128}$/.test(token);

/** Adresse publique du flux pour un jeton. */
export const calendarFeedUrl = (origin: string, token: string) => `${origin}/api/agenda/${token}.ics`;

const parisDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
function shiftMonths(date: string, months: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

interface Row {
  id: string;
  status: string;
  event_type: string | null;
  event_date: string;
  team_arrival_time: string | null;
  event_location: string | null;
  guest_count: number | null;
  client: string;
  quote_number: string | null;
  company_name: string | null;
}

/** Contenu du flux pour un jeton, ou null si le jeton ne correspond à aucun compte actif. */
export async function calendarFeed(token: string, origin: string, now = new Date()): Promise<string | null> {
  if (!isCalendarToken(token)) return null;
  const { rows: owners } = await db.execute<{ id: string; company_name: string | null }>(sql`
    select p.id, coalesce(c.company_name, p.company_name) as company_name
    from public.profiles p left join public.profiles c on c.id = p.parent_user_id
    where p.ical_token = ${token} and p.is_active and p.deletion_requested_at is null limit 1`);
  const owner = owners[0];
  if (!owner) return null;

  const today = parisDate(now);
  const statuses = sql.join([...CONFIRMED_STATUSES, ...PENDING_STATUSES].map((s) => sql`${s}`), sql`, `);
  const confirmed = sql.join(CONFIRMED_STATUSES.map((s) => sql`${s}`), sql`, `);
  const uid = owner.id;
  // Mêmes devis que ceux visibles par le compte : les siens et ceux de son entreprise.
  const { rows } = await db.execute<Row & Record<string, unknown>>(sql`
    select q.id, q.status, q.event_type, q.event_date::text as event_date, q.team_arrival_time::text as team_arrival_time,
      q.event_location, q.guest_count, q.quote_number,
      case when q.client_type = 'entreprise' then coalesce(nullif(q.company_name, ''), q.client_name) else q.client_name end as client
    from public.quotes q
    where (q.user_id = ${uid} or q.owner_user_id = ${uid} or q.owner_user_id in (
        select cp.id from public.profiles cp
        where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))
      and coalesce(q.is_archived, false) = false
      and q.status in (${statuses})
      and (q.status in (${confirmed}) or q.sent_at is not null)
      and q.event_date between ${shiftMonths(today, -12)}::date and ${shiftMonths(today, 12)}::date
    order by q.event_date, q.id`);

  const events: IcsEvent[] = rows.map((q) => {
    const option = !isConfirmed(q.status);
    const title = [q.event_type?.trim() || 'Événement', q.client?.trim()].filter(Boolean).join(' – ');
    const link = `${origin}/evenements/${q.id}`;
    return {
      uid: `evenement-${q.id}@webodevis.fr`,
      date: q.event_date,
      start: q.team_arrival_time,
      summary: option ? `(option) ${title}` : title,
      location: q.event_location,
      description: [
        option ? 'Devis envoyé, en attente de réponse du client.' : '',
        q.guest_count ? `${q.guest_count} couverts` : '',
        q.team_arrival_time ? `Arrivée de l’équipe : ${q.team_arrival_time.slice(0, 5)}` : '',
        q.quote_number ? `Devis n° ${q.quote_number}` : '',
        `Fiche de l’événement : ${link}`,
      ].filter(Boolean).join('\n'),
      url: link,
      status: option ? 'TENTATIVE' : 'CONFIRMED',
    };
  });

  return buildCalendar({
    prodId: '-//WeboDevis//Evenements//FR',
    name: owner.company_name ? `${owner.company_name} – événements` : 'WeboDevis – événements',
    events,
    now,
  });
}
