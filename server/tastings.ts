'use server';

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isDemoUser } from '@/lib/demo';
import { isValidEmail, normalizeEmail } from '@/lib/emailList';
import { hhmm } from '@/lib/ical';
import type { Tasting, TastingStatus } from '@/lib/tastings';
import { companyIdsOf, companyOf } from './companyScope';
import { parisDate } from './reminders';
import { isMissingTable, sendTastingMail, tastingCompany } from './tastingReminders';
import { requireUser, requireWriter } from './session';

// Rendez-vous de dégustation : liste (agenda, fiche d'un devis), création, modification, annulation.
// Visibles et modifiables par les comptes de l'entreprise ; un compte en consultation seule ne modifie rien.
// Le client est prévenu par email (confirmation, changement d'horaire, annulation) si le rendez-vous le prévoit.
// Tant que la table n'existe pas (migration 0028 pas appliquée), les listes sont vides et l'enregistrement est refusé.

const UNAVAILABLE = 'Les dégustations seront disponibles après la prochaine mise à jour de la base.';
const STATUSES: TastingStatus[] = ['prevu', 'fait', 'annule'];

const columns = sql`t.id, t.quote_id, q.quote_number, t.client_name, t.client_email, t.client_phone,
  t.tasting_date::text as tasting_date, to_char(t.start_time, 'HH24:MI') as start_time, t.duration_minutes, t.location,
  t.guest_count, t.notes, t.status, t.notify_client,
  to_char(t.reminder_sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reminder_sent_at`;

async function canWrite(userId: string): Promise<boolean> {
  const { rows } = await db.execute<{ company_role: string | null }>(sql`select company_role from public.profiles where id = ${userId}`);
  return rows[0]?.company_role !== 'lecture';
}

/** Un devis visible par le compte (le sien ou celui de son entreprise), ou rien. */
async function visibleQuote(userId: string, quoteId: string) {
  const { rows } = await db.execute<{ id: string; client_name: string; client_display: string | null; client_email: string | null; client_phone: string | null; guest_count: number | null }>(sql`
    select q.id, q.client_name, q.client_email, q.client_phone, q.guest_count,
      case when q.client_type = 'entreprise' then coalesce(nullif(q.contact_person_name, ''), nullif(q.company_name, ''))
           else nullif(trim(concat_ws(' ', q.client_first_name, q.client_last_name)), '') end as client_display
    from public.quotes q
    where q.id = ${quoteId}::uuid and (q.user_id = ${userId} or q.owner_user_id = ${userId} or q.owner_user_id in ${companyIdsOf(userId)})
    limit 1`);
  return rows[0] ?? null;
}

async function findTasting(userId: string, id: string): Promise<Tasting | null> {
  const { rows } = await db.execute<Tasting & Record<string, unknown>>(sql`
    select ${columns} from public.tastings t left join public.quotes q on q.id = t.quote_id
    where t.id = ${id}::uuid and t.owner_user_id in ${companyIdsOf(userId)} limit 1`);
  return rows[0] ?? null;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

export interface TastingList {
  tastings: Tasting[];
  /** Le compte peut créer et modifier (pas en consultation seule). */
  canEdit: boolean;
  /** La table existe (migration appliquée). */
  available: boolean;
}

/** Dégustations de l'entreprise entre deux dates (AAAA-MM-JJ, incluses). */
export async function listTastings({ from, to }: { from: string; to: string }): Promise<TastingList> {
  const user = await requireUser();
  if (!isDate(from) || !isDate(to)) return { tastings: [], canEdit: false, available: true };
  const canEdit = await canWrite(user.id);
  try {
    const { rows } = await db.execute<Tasting & Record<string, unknown>>(sql`
      select ${columns} from public.tastings t left join public.quotes q on q.id = t.quote_id
      where t.owner_user_id in ${companyIdsOf(user.id)} and t.tasting_date between ${from}::date and ${to}::date
      order by t.tasting_date, t.start_time`);
    return { tastings: rows, canEdit, available: true };
  } catch (e) {
    if (!isMissingTable(e)) console.error('[dégustations] liste', e instanceof Error ? e.message : e);
    return { tastings: [], canEdit, available: !isMissingTable(e) };
  }
}

export interface QuoteTastings extends TastingList {
  /** Coordonnées du client du devis, pour pré-remplir un nouveau rendez-vous. */
  defaults: { client_name: string; client_email: string | null; client_phone: string | null; guest_count: number | null };
}

/** Dégustations d'un devis, ou null si le devis n'est pas visible par le compte. */
export async function getQuoteTastings(quoteId: string): Promise<QuoteTastings | null> {
  const user = await requireUser();
  if (!isUuid(quoteId)) return null;
  const quote = await visibleQuote(user.id, quoteId);
  if (!quote) return null;
  const canEdit = await canWrite(user.id);
  const defaults = {
    client_name: quote.client_display || quote.client_name || '',
    client_email: quote.client_email?.trim() || null,
    client_phone: quote.client_phone?.trim() || null,
    guest_count: null as number | null,
  };
  try {
    const { rows } = await db.execute<Tasting & Record<string, unknown>>(sql`
      select ${columns} from public.tastings t left join public.quotes q on q.id = t.quote_id
      where t.quote_id = ${quoteId}::uuid and t.owner_user_id in ${companyIdsOf(user.id)}
      order by t.tasting_date desc, t.start_time desc`);
    return { tastings: rows, canEdit, available: true, defaults };
  } catch (e) {
    if (!isMissingTable(e)) console.error('[dégustations] devis', e instanceof Error ? e.message : e);
    return { tastings: [], canEdit, available: !isMissingTable(e), defaults };
  }
}

export interface TastingInput {
  /** Absent : nouveau rendez-vous. */
  id?: string | null;
  quote_id?: string | null;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  tasting_date: string;
  start_time: string;
  duration_minutes: number;
  location?: string | null;
  guest_count?: number | null;
  notes?: string | null;
  /** Le client reçoit les emails (confirmation, rappels, changements). */
  notify_client: boolean;
  /** Envoyer tout de suite la confirmation (création) ou le changement d'horaire (modification). */
  send_email?: boolean;
}

export interface TastingResult {
  error: string | null;
  tasting?: Tasting;
  /** Un email est parti au client (absent : aucun email prévu). */
  mailed?: boolean;
}

const clean = (v: string | null | undefined, max: number) => (v ?? '').trim().slice(0, max) || null;

/** Crée ou modifie un rendez-vous de dégustation. */
export async function saveTasting(input: TastingInput): Promise<TastingResult> {
  const user = await requireWriter();

  const client_name = clean(input.client_name, 200);
  if (!client_name) return { error: 'Indiquez le nom du client.' };
  const email = input.client_email?.trim() ? normalizeEmail(input.client_email) : null;
  if (email && !isValidEmail(email)) return { error: `L’adresse « ${email} » n’est pas valide.` };
  if (!isDate(input.tasting_date ?? '')) return { error: 'Choisissez la date du rendez-vous.' };
  const start = hhmm(input.start_time);
  if (!start) return { error: 'Indiquez l’heure du rendez-vous.' };
  const duration = Math.round(Number(input.duration_minutes));
  if (!Number.isFinite(duration) || duration < 15 || duration > 720) return { error: 'La durée doit être comprise entre 15 minutes et 12 heures.' };
  const guests = input.guest_count == null || (input.guest_count as unknown) === '' ? null : Math.round(Number(input.guest_count));
  if (guests != null && (!Number.isFinite(guests) || guests < 1 || guests > 1000)) return { error: 'Le nombre de personnes n’est pas valide.' };
  const values = {
    client_name, client_email: email, client_phone: clean(input.client_phone, 40), tasting_date: input.tasting_date,
    start_time: start, duration_minutes: duration, location: clean(input.location, 300), guest_count: guests,
    notes: clean(input.notes, 2000), notify_client: !!input.notify_client,
  };
  const today = parisDate(new Date());

  try {
    let id: string;
    let kind: 'confirmation' | 'changement' | null = null;
    if (input.id) {
      if (!isUuid(input.id)) return { error: 'Rendez-vous introuvable.' };
      const before = await findTasting(user.id, input.id);
      if (!before) return { error: 'Rendez-vous introuvable.' };
      if (before.status === 'annule') return { error: 'Ce rendez-vous est annulé : créez-en un nouveau.' };
      const moved = before.tasting_date !== values.tasting_date || before.start_time !== start
        || before.duration_minutes !== duration || (before.location ?? null) !== values.location;
      await db.execute(sql`
        update public.tastings set client_name = ${values.client_name}, client_email = ${values.client_email}, client_phone = ${values.client_phone},
          tasting_date = ${values.tasting_date}::date, start_time = ${values.start_time}::time, duration_minutes = ${values.duration_minutes},
          location = ${values.location}, guest_count = ${values.guest_count}, notes = ${values.notes}, notify_client = ${values.notify_client},
          ${moved ? sql`reminder_sent_at = null, early_reminder_sent_at = null,` : sql``}
          updated_at = now()
        where id = ${before.id}::uuid and owner_user_id in ${companyIdsOf(user.id)}`);
      id = before.id;
      if (moved && before.status === 'prevu') kind = 'changement';
    } else {
      let quoteId: string | null = null;
      if (input.quote_id) {
        if (!isUuid(input.quote_id) || !(await visibleQuote(user.id, input.quote_id))) return { error: 'Devis introuvable.' };
        quoteId = input.quote_id;
      }
      const { rows } = await db.execute<{ id: string }>(sql`
        insert into public.tastings (owner_user_id, quote_id, client_name, client_email, client_phone, tasting_date, start_time,
          duration_minutes, location, guest_count, notes, notify_client, created_by)
        values (${companyOf(user.id)}, ${quoteId}, ${values.client_name}, ${values.client_email}, ${values.client_phone}, ${values.tasting_date}::date,
          ${values.start_time}::time, ${values.duration_minutes}, ${values.location}, ${values.guest_count}, ${values.notes}, ${values.notify_client}, ${user.id})
        returning id`);
      id = rows[0].id;
      kind = 'confirmation';
    }

    const tasting = (await findTasting(user.id, id))!;
    let mailed: boolean | undefined;
    if (kind && input.send_email && tasting.notify_client && tasting.client_email && tasting.tasting_date >= today && !isDemoUser(user.id)) {
      const company = await tastingCompany(await ownerOf(id));
      mailed = await sendTastingMail(kind, tasting, company);
    }
    return { error: null, tasting, mailed };
  } catch (e) {
    if (isMissingTable(e)) return { error: UNAVAILABLE };
    console.error('[dégustations] enregistrement', e instanceof Error ? e.message : e);
    return { error: 'Le rendez-vous n’a pas pu être enregistré. Réessayez.' };
  }
}

async function ownerOf(id: string): Promise<string> {
  const { rows } = await db.execute<{ owner_user_id: string }>(sql`select owner_user_id from public.tastings where id = ${id}::uuid`);
  return rows[0].owner_user_id;
}

/** Marque un rendez-vous fait, annulé ou de nouveau prévu. L'annulation prévient le client si demandé. */
export async function setTastingStatus({ id, status, sendEmail = true }: { id: string; status: TastingStatus; sendEmail?: boolean }): Promise<TastingResult> {
  const user = await requireWriter();
  if (!isUuid(id ?? '') || !STATUSES.includes(status)) return { error: 'Rendez-vous introuvable.' };
  try {
    const before = await findTasting(user.id, id);
    if (!before) return { error: 'Rendez-vous introuvable.' };
    if (before.status === status) return { error: null, tasting: before };
    await db.execute(sql`update public.tastings set status = ${status}, updated_at = now()
      where id = ${id}::uuid and owner_user_id in ${companyIdsOf(user.id)}`);
    const tasting = (await findTasting(user.id, id))!;
    let mailed: boolean | undefined;
    if (status === 'annule' && before.status === 'prevu' && sendEmail && before.notify_client && before.client_email
      && before.tasting_date >= parisDate(new Date()) && !isDemoUser(user.id)) {
      mailed = await sendTastingMail('annulation', before, await tastingCompany(await ownerOf(id)));
    }
    return { error: null, tasting, mailed };
  } catch (e) {
    if (isMissingTable(e)) return { error: UNAVAILABLE };
    console.error('[dégustations] statut', e instanceof Error ? e.message : e);
    return { error: 'Le rendez-vous n’a pas pu être modifié. Réessayez.' };
  }
}
