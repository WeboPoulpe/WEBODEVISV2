'use server';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { quotes } from '@/db/schema';
import { INVOICE_KIND_LABELS, type InvoiceKind } from '@/lib/invoices';
import { QUOTE_STATUS_LABELS, type QuoteStatus } from '@/lib/quoteStatus';
import { companyIdsOf } from './companyScope';
import { requireUser } from './session';

// Historique d'un devis : tout ce qui lui est arrivé, du plus récent au plus ancien — création, changements de
// statut, envois (email, WhatsApp), consultations du client, signature en ligne, relances, factures et paiements.
// Chaque source est lue à part et tolère une table absente (base pas encore à jour).

export type HistoryKind = 'creation' | 'statut' | 'envoi_email' | 'envoi_whatsapp' | 'consultation' | 'acceptation' | 'relance' | 'facture' | 'paiement' | 'degustation';

export interface HistoryEntry {
  at: string;
  kind: HistoryKind;
  title: string;
  detail?: string;
  /** Qui l'a fait (email du compte), quand c'est connu. */
  by?: string | null;
}

const statusLabel = (s: string | null) => (s ? QUOTE_STATUS_LABELS[s as QuoteStatus] ?? s : '');
const euro = (n: unknown) => `${Number(n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const iso = (v: unknown) => new Date(v as string).toISOString();

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  try {
    return (await db.execute(q)).rows as unknown as T[];
  } catch {
    return [];
  }
}

export async function getQuoteHistory(quoteId: string): Promise<HistoryEntry[] | null> {
  const user = await requireUser();
  const [q] = await db.select({ id: quotes.id, created_at: quotes.created_at, user_id: quotes.user_id }).from(quotes).where(and(
    eq(quotes.id, quoteId),
    sql`(${quotes.user_id} = ${user.id} or ${quotes.owner_user_id} = ${user.id} or ${quotes.owner_user_id} in ${companyIdsOf(user.id)})`,
  )).limit(1);
  if (!q) return null;
  const id = q.id;

  const [creator, statuses, events, acceptances, reminders, invoices, payments, tastings] = await Promise.all([
    rows<{ email: string }>(sql`select email from public.profiles where id = ${q.user_id}`),
    rows<{ at: string; old_status: string | null; new_status: string; by: string | null }>(sql`
      select h.changed_at as at, h.old_status, h.new_status, p.email as by
      from public.quote_status_history h left join public.profiles p on p.id = h.changed_by where h.quote_id = ${id}`),
    rows<{ at: string; kind: 'envoi_email' | 'envoi_whatsapp' | 'consultation'; details: { to?: string[]; cc?: string[]; phone?: string | null } | null; by: string | null }>(sql`
      select e.created_at as at, e.kind, e.details, p.email as by
      from public.quote_events e left join public.profiles p on p.id = e.actor_id where e.quote_id = ${id}`),
    rows<{ at: string; signer_name: string; signer_role: string | null; invalidated_at: string | null }>(sql`
      select accepted_at as at, signer_name, signer_role, invalidated_at from public.quote_acceptances where quote_id = ${id}`),
    rows<{ at: string; sent_to: string }>(sql`
      select sent_at as at, sent_to from public.document_reminders where quote_id = ${id} and kind = 'devis'`),
    rows<{ at: string; kind: string; number: string | null; total_ttc: string; by: string | null }>(sql`
      select coalesce(i.issued_at, i.created_at) as at, i.kind, i.number, i.total_ttc::text, p.email as by
      from public.customer_invoices i left join public.profiles p on p.id = i.created_by
      where i.quote_id = ${id} and i.status <> 'brouillon'`),
    rows<{ at: string; amount: string; number: string | null; method: string }>(sql`
      select pay.created_at as at, pay.amount::text, i.number, pay.method
      from public.customer_invoice_payments pay join public.customer_invoices i on i.id = pay.invoice_id where i.quote_id = ${id}`),
    rows<{ at: string; date: string; start: string; status: string; reminded: string | null; by: string | null }>(sql`
      select t.created_at as at, t.tasting_date::text as date, to_char(t.start_time, 'HH24:MI') as start, t.status, t.reminder_sent_at as reminded, p.email as by
      from public.tastings t left join public.profiles p on p.id = t.created_by where t.quote_id = ${id}`),
  ]);

  const out: HistoryEntry[] = [{ at: iso(q.created_at), kind: 'creation', title: 'Devis créé', by: creator[0]?.email ?? null }];
  for (const s of statuses) {
    out.push({ at: iso(s.at), kind: 'statut', title: `Statut : ${statusLabel(s.new_status)}`, detail: s.old_status ? `Avant : ${statusLabel(s.old_status)}` : undefined, by: s.by });
  }
  for (const e of events) {
    if (e.kind === 'envoi_email') {
      const cc = e.details?.cc?.length ? ` (en copie : ${e.details.cc.join(', ')})` : '';
      out.push({ at: iso(e.at), kind: 'envoi_email', title: 'Envoyé par email', detail: `${(e.details?.to ?? []).join(', ')}${cc}`, by: e.by });
    } else if (e.kind === 'envoi_whatsapp') {
      out.push({ at: iso(e.at), kind: 'envoi_whatsapp', title: 'Envoyé par WhatsApp', detail: e.details?.phone ? `+${e.details.phone}` : undefined, by: e.by });
    } else {
      out.push({ at: iso(e.at), kind: 'consultation', title: 'Consulté par le client' });
    }
  }
  for (const a of acceptances) {
    out.push({
      at: iso(a.at), kind: 'acceptation', title: `Accepté et signé en ligne par ${a.signer_name}${a.signer_role ? ` (${a.signer_role})` : ''}`,
      detail: a.invalidated_at ? 'Le devis a été modifié depuis : cet accord porte sur une version précédente.' : undefined,
    });
  }
  for (const r of reminders) out.push({ at: iso(r.at), kind: 'relance', title: 'Relance automatique envoyée', detail: r.sent_to });
  for (const i of invoices) {
    out.push({ at: iso(i.at), kind: 'facture', title: `${INVOICE_KIND_LABELS[i.kind as InvoiceKind] ?? 'Facture'} n° ${i.number}`, detail: euro(i.total_ttc), by: i.by });
  }
  for (const t of tastings) {
    const when = `${new Date(`${t.date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} à ${t.start.replace(':', ' h ')}`;
    const state = t.status === 'annule' ? ' (annulée)' : t.status === 'fait' ? ' (faite)' : '';
    out.push({ at: iso(t.at), kind: 'degustation', title: `Dégustation prévue${state}`, detail: when, by: t.by });
    if (t.reminded) out.push({ at: iso(t.reminded), kind: 'degustation', title: 'Rappel de dégustation envoyé au client', detail: when });
  }
  for (const p of payments) out.push({ at: iso(p.at), kind: 'paiement', title: `Paiement reçu : ${euro(p.amount)}`, detail: p.number ? `Facture n° ${p.number}` : undefined });

  return out.sort((a, b) => b.at.localeCompare(a.at));
}
