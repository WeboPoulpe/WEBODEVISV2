'use server';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, prestations, profiles, prospect_requests, quotes, webo_proposals } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { sendMail } from '@/lib/mail';
import { esc, renderEmail } from '@/lib/mail/layout';
import { quoteVatBreakdown } from '@/lib/quoteTotals';
import { companyIdsOf } from '../companyScope';
import { createInvoiceDraft } from '../invoices';
import { requireWriter } from '../session';
import { companyIdFor } from '../weboWallet';
import { isUuid } from './tools';

// Valider ou annuler une proposition de Webo. La proposition passe d'abord de « proposée » à « faite » ou « annulée »
// par une mise à jour conditionnelle (une seule exécution, même sur un double clic), puis l'écriture est faite ici,
// par du code déterministe, avec les droits du traiteur. Webo lui-même n'écrit jamais.

export interface ProposalResult { href: string; label: string }

type QuotePayload = {
  customerId: string | null;
  newCustomer: { first_name: string; last_name: string; email: string; phone: string | null } | null;
  clientName: string; eventType: string; eventDate: string; guests: number; eventLocation: string | null; remarks: string | null;
  vatRate: number;
  lines: ({ name: string; quantity: number; unitPrice: number; fromCatalogue?: boolean } & Record<string, unknown>)[];
};

const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => esc(p).replace(/\n/g, '<br>'));

async function createQuote(userId: string, companyId: string, p: QuotePayload): Promise<ProposalResult> {
  let customer: typeof customers.$inferSelect | undefined;
  if (p.customerId) {
    [customer] = await db.select().from(customers).where(and(eq(customers.id, p.customerId), sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
    if (!customer) throw new Error('Client introuvable.');
  } else if (p.newCustomer) {
    // Même email déjà dans l'entreprise : on reprend ce client.
    [customer] = await db.select().from(customers).where(and(eq(customers.email, p.newCustomer.email), sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
    if (!customer) {
      [customer] = await db.insert(customers).values({
        owner_user_id: userId, user_id: userId, customer_type: 'particulier',
        first_name: p.newCustomer.first_name, last_name: p.newCustomer.last_name, email: p.newCustomer.email, phone: p.newCustomer.phone,
      }).onConflictDoNothing().returning();
      if (!customer) [customer] = await db.select().from(customers).where(and(eq(customers.email, p.newCustomer.email), eq(customers.owner_user_id, userId))).limit(1);
    }
  }
  const services = p.lines.map(({ fromCatalogue: _f, ...l }) => ({ id: crypto.randomUUID(), ...l }));
  const total = quoteVatBreakdown(services, p.vatRate, p.guests, 0).ttc;
  const [q] = await db.insert(quotes).values({
    owner_user_id: userId, user_id: userId, customer_id: customer?.id ?? null,
    client_name: p.clientName,
    client_first_name: customer?.first_name ?? null, client_last_name: customer?.last_name ?? null,
    client_email: customer?.email ?? null, client_phone: customer?.phone ?? null,
    ...(customer?.customer_type === 'entreprise' ? { client_type: 'entreprise', company_name: customer.company_name, contact_person_name: customer.contact_person_name } : {}),
    event_type: p.eventType, event_date: p.eventDate, guest_count: p.guests, event_location: p.eventLocation, remarks: p.remarks,
    status: 'devis_a_faire', template: 'classique', vat_rate: String(p.vatRate), services, total_amount: String(total), hide_price: false, language: 'fr',
  }).returning({ id: quotes.id });
  return { href: `/devis/${q.id}/modifier?mode=weboword`, label: 'Ouvrir le devis' };
}

async function sendProspectReply(companyId: string, p: { prospectId: string; to: string; subject: string; body: string }): Promise<ProposalResult> {
  const [prospect] = await db.select().from(prospect_requests).where(and(eq(prospect_requests.id, p.prospectId), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  if (!prospect) throw new Error('Demande introuvable.');
  const [owner] = await db.select({ name: profiles.company_name, email: profiles.email, companyEmail: profiles.company_email }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
  const companyName = owner?.name || 'Votre traiteur';
  const res = await sendMail({
    to: prospect.email, fromName: companyName, replyTo: owner?.companyEmail || owner?.email || null, subject: p.subject,
    html: renderEmail({ brand: companyName, preheader: p.subject, title: p.subject, paragraphs: paragraphs(p.body) }),
  });
  if (res.error) throw new Error(res.error);
  return { href: '/prospects', label: 'Voir les prospects' };
}

export async function decideProposal(id: string, decision: 'accept' | 'cancel'): Promise<{ error: string | null; result?: ProposalResult }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  if (!isUuid(id)) return { error: 'Proposition introuvable.' };
  const companyId = await companyIdFor(user.id);
  const now = new Date().toISOString();
  const [taken] = await db.update(webo_proposals)
    .set({ status: decision === 'accept' ? 'done' : 'cancelled', decided_at: now })
    .where(and(eq(webo_proposals.id, id), eq(webo_proposals.company_id, companyId), eq(webo_proposals.status, 'proposed')))
    .returning();
  if (!taken) return { error: 'Cette proposition a déjà été traitée, ou elle est introuvable.' };
  if (decision === 'cancel') return { error: null };

  try {
    const p = taken.payload as Record<string, unknown>;
    let result: ProposalResult;
    switch (taken.kind) {
      case 'quote':
        result = await createQuote(user.id, companyId, p as unknown as QuotePayload);
        break;
      case 'invoice': {
        const r = await createInvoiceDraft({ quoteId: String(p.quoteId), kind: p.kind as 'acompte' | 'solde' | 'facture', ...(p.percent != null ? { percent: Number(p.percent) } : {}) });
        if (r.error || !('id' in r)) throw new Error(r.error ?? 'La facture n’a pas pu être préparée.');
        result = { href: '/factures', label: 'Voir les factures' };
        break;
      }
      case 'prestation': {
        const description = p.description ? paragraphs(String(p.description)).map((x) => `<p>${x}</p>`).join('') : null;
        const [row] = await db.insert(prestations).values({
          user_id: user.id, name: String(p.name), unit_price: String(p.unitPrice), category: (p.category as string | null) ?? null, description,
        }).returning({ id: prestations.id });
        result = { href: `/prestations/${row.id}`, label: 'Ouvrir la prestation' };
        break;
      }
      case 'prestation_update': {
        const patch: Partial<typeof prestations.$inferInsert> = {};
        if (p.unitPrice != null) patch.unit_price = String(p.unitPrice);
        if (p.description) patch.description = paragraphs(String(p.description)).map((x) => `<p>${x}</p>`).join('');
        const [row] = await db.update(prestations).set(patch)
          .where(and(eq(prestations.id, String(p.prestationId)), sql`${prestations.user_id} in ${companyIdsOf(companyId)}`))
          .returning({ id: prestations.id });
        if (!row) throw new Error('Prestation introuvable.');
        result = { href: `/prestations/${row.id}`, label: 'Ouvrir la prestation' };
        break;
      }
      case 'prospect_reply':
        result = await sendProspectReply(companyId, p as { prospectId: string; to: string; subject: string; body: string });
        break;
      default:
        throw new Error('Proposition inconnue.');
    }
    await db.update(webo_proposals).set({ result }).where(eq(webo_proposals.id, id));
    return { error: null, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'L’action n’a pas pu être faite.';
    await db.update(webo_proposals).set({ status: 'failed', result: { error: message } }).where(eq(webo_proposals.id, id));
    return { error: message };
  }
}
