import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { document_reminders, notifications } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { isValidEmail, splitEmails } from '@/lib/emailList';
import { sendMail } from '@/lib/mail';
import { invoiceReminderEmail, quoteReminderEmail } from '@/lib/mail/templates';
import { PENDING_STATUSES } from '@/lib/quoteStatus';

// Relances automatiques, lancées une fois par jour par la tâche planifiée (voir app/api/cron/rappels-extras).
// Pour chaque entreprise qui les a activées (Paramètres) :
//  - devis envoyés et toujours en attente : au plus 2 relances, la première `délai` jours après l'envoi ;
//  - factures émises échues et pas entièrement payées : au plus 3 relances, la première le lendemain de l'échéance.
// Deux relances d'un même document sont toujours espacées d'au moins `délai` jours.
// Chaque email envoyé est noté dans document_reminders (une facture émise est figée : on n'y écrit rien).
// Ce module n'est pas une action serveur : rien ici n'est appelable depuis le navigateur.

export const MAX_QUOTE_REMINDERS = 2;
export const MAX_INVOICE_REMINDERS = 3;

/** Date du jour (AAAA-MM-JJ) à l'heure de Paris. */
export const parisDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

export function addDays(date: string, n: number): string {
  const d = new Date(date.slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const toDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));
/** Premier destinataire valide d'un champ qui peut contenir plusieurs adresses. */
const firstEmail = (text: string | null | undefined) => splitEmails(text ?? '').find(isValidEmail) ?? null;

interface Company {
  company: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_email: string | null;
  account_email: string;
  delay: number;
}

const companyName = (c: Company) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Votre traiteur';
const replyTo = (c: Company) => c.company_email || c.account_email || null;

const companyColumns = sql`cp.id as company, cp.company_name, cp.first_name, cp.last_name, cp.company_email, cp.email as account_email, cp.reminder_delay_days as delay`;
const companyEnabled = sql`cp.auto_reminders and cp.is_active and cp.deletion_requested_at is null`;

export interface QuoteToRemind extends Company {
  id: string;
  quote_number: string | null;
  client_name: string;
  client_display: string | null;
  to: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  valid_until: string | null;
  share_token: string;
  /** Relances déjà envoyées. */
  reminders: number;
}

/** Devis à relancer aujourd'hui. */
export async function quotesToRemind(today: string): Promise<QuoteToRemind[]> {
  const pending = sql.join(PENDING_STATUSES.map((s) => sql`${s}`), sql`, `);
  const { rows } = await db.execute(sql`
    select q.id, q.quote_number, q.client_name, q.client_email, q.event_type, q.event_date::text as event_date,
      q.guest_count, q.valid_until::text as valid_until, q.share_token, q.sent_at,
      case when q.client_type = 'entreprise' then coalesce(nullif(q.contact_person_name, ''), nullif(q.company_name, ''))
           else nullif(trim(concat_ws(' ', q.client_first_name, q.client_last_name)), '') end as client_display,
      (select count(*)::int from public.document_reminders r where r.quote_id = q.id) as reminders,
      (select max(r.sent_at) from public.document_reminders r where r.quote_id = q.id) as last_reminder,
      ${companyColumns}
    from public.quotes q
    left join public.profiles op on op.id = q.owner_user_id
    join public.profiles cp on cp.id = coalesce(op.parent_user_id, q.owner_user_id)
    where ${companyEnabled}
      and q.status in (${pending})
      and q.sent_at is not null and q.share_token is not null
      and coalesce(trim(q.client_email), '') <> ''
      and coalesce(q.is_archived, false) = false
      and (q.valid_until is null or q.valid_until >= ${today}::date)
      and q.event_date >= ${today}::date`);

  const out: QuoteToRemind[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const c = r as unknown as QuoteToRemind & { client_email: string; sent_at: unknown; last_reminder: unknown };
    if (isDemoUser(c.company)) continue;
    const to = firstEmail(c.client_email);
    if (!to || c.reminders >= MAX_QUOTE_REMINDERS) continue;
    const delay = Math.max(1, Number(c.delay) || 7);
    const last = parisDate(toDate(c.last_reminder ?? c.sent_at));
    if (last > addDays(today, -delay)) continue;
    out.push({ ...c, to, delay, reminders: Number(c.reminders) });
  }
  return out;
}

export interface InvoiceToRemind extends Company {
  id: string;
  number: string;
  due_date: string;
  to: string;
  buyer_name: string | null;
  remaining: number;
  iban: string | null;
  bic: string | null;
  reminders: number;
}

/** Factures échues à relancer aujourd'hui. */
export async function invoicesToRemind(today: string): Promise<InvoiceToRemind[]> {
  const { rows } = await db.execute(sql`
    select i.id, i.number, i.due_date::text as due_date, i.total_ttc, i.buyer, i.seller,
      coalesce((select sum(p.amount) from public.customer_invoice_payments p where p.invoice_id = i.id), 0) as paid,
      (select count(*)::int from public.document_reminders r where r.invoice_id = i.id) as reminders,
      (select max(r.sent_at) from public.document_reminders r where r.invoice_id = i.id) as last_reminder,
      ${companyColumns}
    from public.customer_invoices i
    join public.profiles cp on cp.id = i.owner_user_id
    where ${companyEnabled}
      and i.status in ('emise', 'payee_partiellement')
      and i.kind <> 'avoir'
      and i.number is not null
      and i.due_date < ${today}::date
      and coalesce(trim(i.buyer->>'email'), '') <> ''`);

  const out: InvoiceToRemind[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const c = r as unknown as Company & {
      id: string; number: string; due_date: string; total_ttc: unknown; paid: unknown; reminders: number; last_reminder: unknown;
      buyer: { name?: string | null; email?: string | null } | null; seller: { iban?: string | null; bic?: string | null } | null;
    };
    if (isDemoUser(c.company)) continue;
    const to = firstEmail(c.buyer?.email);
    const remaining = Math.round((Number(c.total_ttc) - Number(c.paid)) * 100) / 100;
    if (!to || remaining <= 0 || c.reminders >= MAX_INVOICE_REMINDERS) continue;
    const delay = Math.max(1, Number(c.delay) || 7);
    if (c.last_reminder && parisDate(toDate(c.last_reminder)) > addDays(today, -delay)) continue;
    out.push({
      company: c.company, company_name: c.company_name, first_name: c.first_name, last_name: c.last_name,
      company_email: c.company_email, account_email: c.account_email, delay,
      id: c.id, number: c.number, due_date: c.due_date, to, buyer_name: c.buyer?.name?.trim() || null, remaining,
      iban: c.seller?.iban?.trim() || null, bic: c.seller?.bic?.trim() || null, reminders: Number(c.reminders),
    });
  }
  return out;
}

export interface ReminderRun {
  quotes: number;
  invoices: number;
  failed: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Envoie les relances du jour et prévient chaque traiteur par une notification récapitulative. */
export async function runReminders({ origin, now = new Date() }: { origin: string; now?: Date }): Promise<ReminderRun> {
  const today = parisDate(now);
  const result: ReminderRun = { quotes: 0, invoices: 0, failed: 0 };
  // Par entreprise : ce qui a été relancé, pour la notification.
  const quoteDone = new Map<string, string[]>();
  const invoiceDone = new Map<string, string[]>();

  for (const q of await quotesToRemind(today)) {
    const name = companyName(q);
    const mail = quoteReminderEmail({
      quote: {
        companyName: name, clientName: q.client_display || q.client_name, quoteNumber: q.quote_number,
        eventType: q.event_type, eventDate: q.event_date, guestCount: q.guest_count, validUntil: q.valid_until,
      },
      link: `${origin}/d/${q.share_token}`,
    });
    try {
      const { error } = await sendMail({ to: q.to, fromName: name, replyTo: replyTo(q), ...mail });
      if (error) { result.failed++; continue; }
      await db.insert(document_reminders).values({ owner_user_id: q.company, kind: 'devis', quote_id: q.id, sent_to: q.to, sent_at: now.toISOString() });
      result.quotes++;
      quoteDone.set(q.company, [...(quoteDone.get(q.company) ?? []), q.quote_number ? `${q.client_name} (devis ${q.quote_number})` : q.client_name]);
    } catch (e) {
      result.failed++;
      console.error('[relances] devis', q.id, e instanceof Error ? e.message : e);
    }
  }

  for (const i of await invoicesToRemind(today)) {
    const name = companyName(i);
    const mail = invoiceReminderEmail({
      invoice: { companyName: name, buyerName: i.buyer_name, number: i.number, remaining: i.remaining, dueDate: i.due_date, iban: i.iban, bic: i.bic, previous: i.reminders },
    });
    try {
      const { error } = await sendMail({ to: i.to, fromName: name, replyTo: replyTo(i), ...mail });
      if (error) { result.failed++; continue; }
      await db.insert(document_reminders).values({ owner_user_id: i.company, kind: 'facture', invoice_id: i.id, sent_to: i.to, sent_at: now.toISOString() });
      result.invoices++;
      invoiceDone.set(i.company, [...(invoiceDone.get(i.company) ?? []), `${i.number}${i.buyer_name ? ` (${i.buyer_name})` : ''}`]);
    } catch (e) {
      result.failed++;
      console.error('[relances] facture', i.id, e instanceof Error ? e.message : e);
    }
  }

  const recap = [
    ...[...quoteDone].map(([user_id, items]) => ({
      user_id, type: 'task_reminder', priority: 'low', action_url: '/devis', data: { kind: 'devis', items },
      title: plural(items.length, 'devis relancé', 'devis relancés'),
      message: `Relance envoyée par email à : ${items.join(', ')}.`,
    })),
    ...[...invoiceDone].map(([user_id, items]) => ({
      user_id, type: 'invoice_due', priority: 'medium', action_url: '/factures', data: { kind: 'facture', items },
      title: plural(items.length, 'facture échue relancée', 'factures échues relancées'),
      message: `Rappel de paiement envoyé pour : ${items.join(', ')}.`,
    })),
  ];
  if (recap.length) await db.insert(notifications).values(recap);
  return result;
}
