import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDemoUser } from '@/lib/demo';
import { isValidEmail, splitEmails } from '@/lib/emailList';
import { sendMail } from '@/lib/mail';
import { tastingEmail, type TastingMailKind } from '@/lib/mail/templates';
import { durationLabel, tastingEnd, tastingIcs } from '@/lib/tastings';
import { addDays, parisDate } from './reminders';

// Emails des dégustations au client : confirmation, changement, annulation (depuis les actions de server/tastings.ts)
// et rappels automatiques, lancés une fois par jour par la tâche planifiée de 16 h (app/api/cron/rappels-extras) :
//  - la veille du rendez-vous ;
//  - trois jours avant, si le rendez-vous a été pris avant ce jour-là.
// Chaque rappel n'est envoyé qu'une fois (reminder_sent_at, early_reminder_sent_at). Un rendez-vous annulé,
// fait, ou dont le client ne doit pas être prévenu, n'en reçoit aucun.
// Ce module n'est pas une action serveur : rien ici n'est appelable depuis le navigateur.

/** Rappel envoyé quelques jours avant, en plus de celui de la veille. */
export const EARLY_REMINDER_DAYS = 3;

/** La table n'existe pas encore (migration 0028 pas appliquée). */
export function isMissingTable(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 4; x = (x as { cause?: unknown }).cause, i++) {
    const err = x as { code?: string; message?: string };
    if (err.code === '42P01' || /relation "?(public\.)?tastings"? does not exist/i.test(err.message ?? '')) return true;
  }
  return false;
}

/** Premier destinataire valide d'un champ qui peut contenir plusieurs adresses. */
export const firstEmail = (text: string | null | undefined) => splitEmails(text ?? '').find(isValidEmail) ?? null;

export interface TastingCompany {
  name: string;
  replyTo: string | null;
  phone: string | null;
}

/** Nom, adresse de réponse et téléphone de l'entreprise (compte titulaire). */
export async function tastingCompany(ownerId: string): Promise<TastingCompany> {
  const { rows } = await db.execute<{ company_name: string | null; first_name: string | null; last_name: string | null; company_email: string | null; email: string | null; company_phone: string | null }>(sql`
    select company_name, first_name, last_name, company_email, email, company_phone from public.profiles where id = ${ownerId}`);
  const p = rows[0];
  return {
    name: p?.company_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Votre traiteur',
    replyTo: p?.company_email || p?.email || null,
    phone: p?.company_phone?.trim() || null,
  };
}

export interface TastingForMail {
  id: string;
  client_name: string;
  client_email: string | null;
  tasting_date: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  guest_count: number | null;
  notes?: string | null;
}

/** Envoie un email de dégustation au client. Renvoie true s'il est parti. */
export async function sendTastingMail(kind: TastingMailKind, t: TastingForMail, company: TastingCompany): Promise<boolean> {
  const to = firstEmail(t.client_email);
  if (!to) return false;
  const start = t.start_time.slice(0, 5);
  const end = tastingEnd(start, t.duration_minutes);
  const mail = tastingEmail({
    kind,
    tasting: {
      companyName: company.name, clientName: t.client_name, date: t.tasting_date.slice(0, 10), start, end,
      location: t.location, guestCount: t.guest_count, phone: company.phone,
    },
  });
  // Le rendez-vous au format agenda, joint à la confirmation et au changement d'horaire.
  const attach = kind === 'confirmation' || kind === 'changement';
  const ics = attach
    ? tastingIcs({
      id: t.id, date: t.tasting_date.slice(0, 10), start, minutes: t.duration_minutes, companyName: company.name, location: t.location,
      description: [`Dégustation (${durationLabel(t.duration_minutes)})`, company.phone ? `Contact : ${company.phone}` : ''].filter(Boolean).join('\n'),
    })
    : null;
  const { error } = await sendMail({
    to, fromName: company.name, replyTo: company.replyTo, ...mail,
    ...(ics ? { attachments: [{ filename: `degustation-${t.tasting_date.slice(0, 10)}.ics`, content: Buffer.from(ics, 'utf8').toString('base64') }] } : {}),
  });
  return !error;
}

export interface TastingReminderRun {
  sent: number;
  failed: number;
}

interface DueRow extends TastingForMail {
  owner_user_id: string;
  early: boolean;
}

/** Envoie les rappels de dégustation du jour. null si la table n'existe pas encore. */
export async function runTastingReminders({ now = new Date() }: { now?: Date } = {}): Promise<TastingReminderRun | null> {
  const today = parisDate(now);
  const tomorrow = addDays(today, 1);
  const early = addDays(today, EARLY_REMINDER_DAYS);
  let due: DueRow[];
  try {
    const { rows } = await db.execute<DueRow & Record<string, unknown>>(sql`
      select t.id, t.owner_user_id, t.client_name, t.client_email, t.tasting_date::text as tasting_date, t.start_time::text as start_time,
        t.duration_minutes, t.location, t.guest_count, (t.tasting_date = ${early}::date) as early
      from public.tastings t
      join public.profiles cp on cp.id = t.owner_user_id
      where t.status = 'prevu' and t.notify_client
        and coalesce(trim(t.client_email), '') <> ''
        and cp.is_active and cp.deletion_requested_at is null
        and (
          (t.tasting_date = ${tomorrow}::date and t.reminder_sent_at is null)
          or (t.tasting_date = ${early}::date and t.early_reminder_sent_at is null
              and (t.created_at at time zone 'Europe/Paris')::date < ${today}::date)
        )
      order by t.tasting_date, t.start_time`);
    due = rows;
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }

  const result: TastingReminderRun = { sent: 0, failed: 0 };
  const companies = new Map<string, TastingCompany>();
  for (const t of due) {
    if (isDemoUser(t.owner_user_id)) continue;
    try {
      const company = companies.get(t.owner_user_id) ?? await tastingCompany(t.owner_user_id);
      companies.set(t.owner_user_id, company);
      if (!(await sendTastingMail(t.early ? 'rappel_avance' : 'rappel_veille', t, company))) { result.failed++; continue; }
      const stamp = now.toISOString();
      // Noté seulement s'il n'a pas déjà été noté : une tâche relancée deux fois n'envoie pas de second rappel la fois suivante.
      if (t.early) await db.execute(sql`update public.tastings set early_reminder_sent_at = ${stamp} where id = ${t.id} and early_reminder_sent_at is null`);
      else await db.execute(sql`update public.tastings set reminder_sent_at = ${stamp} where id = ${t.id} and reminder_sent_at is null`);
      result.sent++;
    } catch (e) {
      result.failed++;
      console.error('[dégustations] rappel', t.id, e instanceof Error ? e.message : e);
    }
  }
  return result;
}
