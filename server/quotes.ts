'use server';

import crypto from 'node:crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customer_contacts, customers, profiles, quotes } from '@/db/schema';
import { appOrigin, sendMail } from '@/lib/mail';
import { quoteProposalEmail } from '@/lib/mail/templates';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { MAX_RECIPIENTS, isValidEmail, normalizeEmail, splitEmails, uniqueEmails } from '@/lib/emailList';
import { requireUser } from './session';

/** Statuts d'avant l'envoi : à l'envoi, le devis passe à « Devis envoyé ». */
const BEFORE_SENT = ['nouveau', 'broch_envoyee', 'devis_a_faire'];

export interface SendQuoteResult {
  error: string | null;
  /** Nouveau statut du devis, s'il a changé. */
  status?: string;
  /** Adresses auxquelles l'email est parti. */
  sent?: string[];
  /** Adresses où l'envoi a échoué alors que d'autres sont parties. */
  failed?: string[];
  /** Email du client enregistré sur le devis après l'envoi. */
  clientEmail?: string | null;
  /** La copie demandée par le traiteur est partie (absent : pas de copie demandée). */
  copySent?: boolean;
}

/**
 * Envoie le devis au client par email, avec un lien pour le consulter en ligne.
 * Le lien est propre au devis ; il est créé au premier envoi et reste le même ensuite.
 *
 * Plusieurs destinataires (`to` en liste, ou une chaîne séparée par des virgules) : chacun reçoit son
 * propre email, avec le même lien. Personne ne voit ainsi les adresses des autres, et un envoi refusé
 * pour une adresse n'empêche pas les autres de partir.
 */
export async function sendQuoteToClient(input: { quoteId: string; to: string | string[]; message: string; copyToMe?: boolean }): Promise<SendQuoteResult> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const recipients = uniqueEmails(Array.isArray(input.to) ? input.to.flatMap(splitEmails) : splitEmails(input.to));
  if (recipients.length === 0) return { error: 'Indiquez l’adresse email du client.' };
  const invalid = recipients.filter((e) => !isValidEmail(e));
  if (invalid.length === 1) return { error: `L’adresse « ${invalid[0]} » n’est pas valide.` };
  if (invalid.length > 1) return { error: `Ces adresses ne sont pas valides : ${invalid.join(', ')}.` };
  if (recipients.length > MAX_RECIPIENTS) return { error: `Un devis part à ${MAX_RECIPIENTS} adresses au plus. Retirez-en ${recipients.length - MAX_RECIPIENTS}.` };
  if (!input.message.trim()) return { error: 'Écrivez quelques mots pour accompagner le devis.' };

  const [quote] = await db
    .select({
      id: quotes.id, status: quotes.status, share_token: quotes.share_token, client_name: quotes.client_name, client_email: quotes.client_email,
      client_first_name: quotes.client_first_name, event_type: quotes.event_type, event_date: quotes.event_date, guest_count: quotes.guest_count,
    })
    .from(quotes)
    .where(and(eq(quotes.id, input.quoteId), sql`(${quotes.user_id} = ${user.id} or ${quotes.owner_user_id} = ${user.id})`))
    .limit(1);
  if (!quote) return { error: 'Devis introuvable.' };

  const [profile] = await db
    .select({ email: profiles.email, company_name: profiles.company_name, company_email: profiles.company_email })
    .from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const companyName = profile?.company_name || 'Votre traiteur';

  // Le lien est enregistré avant l'envoi : un email parti doit toujours mener à un devis.
  const token = quote.share_token ?? crypto.randomBytes(18).toString('base64url');
  if (!quote.share_token) await db.update(quotes).set({ share_token: token }).where(eq(quotes.id, quote.id));

  const mail = {
    fromName: companyName,
    replyTo: profile?.company_email || profile?.email || user.email,
    ...quoteProposalEmail({
      companyName,
      clientName: quote.client_first_name || quote.client_name || '',
      eventType: quote.event_type,
      eventDate: quote.event_date,
      guestCount: quote.guest_count,
      message: input.message.trim(),
      link: `${await appOrigin()}/d/${token}`,
    }),
  };

  // Un email par destinataire, l'un après l'autre (Resend limite le nombre d'envois par seconde).
  const sent: string[] = [];
  const failed: string[] = [];
  for (const to of recipients) {
    const res = await sendMail({ to, ...mail });
    (res.error ? failed : sent).push(to);
  }
  if (sent.length === 0) {
    return { error: recipients.length === 1 ? 'L’email n’a pas pu être envoyé. Réessayez dans un instant.' : 'Aucun email n’a pu être envoyé. Réessayez dans un instant.' };
  }

  // Copie au traiteur : le même email, sauf s'il fait déjà partie des destinataires.
  let copySent: boolean | undefined;
  const own = normalizeEmail(profile?.email || user.email || '');
  if (input.copyToMe && isValidEmail(own) && !recipients.includes(own)) copySent = !(await sendMail({ to: own, ...mail })).error;

  // L'email du client n'est rempli que s'il manquait : un contact ajouté aux destinataires ne le remplace pas.
  const clientEmail = quote.client_email?.trim() ? quote.client_email : sent[0];
  const status = BEFORE_SENT.includes(quote.status) ? 'devis_envoye' : quote.status;
  await db.transaction(async (tx) => {
    // Lu par le trigger d'historique des statuts, qui note qui a fait le changement.
    await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);
    await tx.update(quotes)
      .set({ sent_at: new Date().toISOString(), status, client_email: clientEmail })
      .where(eq(quotes.id, quote.id));
  });
  return { error: null, status, sent, failed, clientEmail, copySent };
}

export interface RecipientSuggestion {
  email: string;
  /** Qui est derrière l'adresse : « Client », ou le nom et le rôle d'un contact de l'entreprise. */
  label: string;
}

/**
 * Adresses connues pour le client du devis, proposées en un clic dans la fenêtre d'envoi :
 * l'email du devis, celui de la fiche client, le contact choisi pour le devis et les contacts de l'entreprise.
 */
export async function quoteRecipientSuggestions(quoteId: string): Promise<{ suggestions: RecipientSuggestion[]; accountEmail: string | null }> {
  const user = await requireUser();
  const [quote] = await db
    .select({
      customer_id: quotes.customer_id, client_email: quotes.client_email, contact_person_name: quotes.contact_person_name,
      recipient_contact_email: quotes.recipient_contact_email, recipient_contact_role: quotes.recipient_contact_role,
    })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), sql`(${quotes.user_id} = ${user.id} or ${quotes.owner_user_id} = ${user.id})`))
    .limit(1);
  const [profile] = await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const accountEmail = profile?.email || user.email || null;
  if (!quote) return { suggestions: [], accountEmail };

  const found: RecipientSuggestion[] = [];
  const add = (email: string | null | undefined, label: string) => {
    const e = normalizeEmail(email ?? '');
    if (isValidEmail(e) && !found.some((f) => f.email === e)) found.push({ email: e, label });
  };
  const contactLabel = (name: string | null, role: string | null) => [name, role].filter(Boolean).join(', ') || 'Contact';

  add(quote.client_email, 'Client');
  add(quote.recipient_contact_email, contactLabel(quote.contact_person_name, quote.recipient_contact_role));
  if (quote.customer_id) {
    const [customer] = await db
      .select({ id: customers.id, email: customers.email, contact_person_name: customers.contact_person_name, contact_person_email: customers.contact_person_email })
      .from(customers)
      .where(and(eq(customers.id, quote.customer_id), sql`(${customers.owner_user_id} = ${user.id} or ${customers.user_id} = ${user.id})`))
      .limit(1);
    if (customer) {
      add(customer.email, 'Client');
      const contacts = await db
        .select({ name: customer_contacts.name, role: customer_contacts.role, email: customer_contacts.email })
        .from(customer_contacts)
        .where(eq(customer_contacts.customer_id, customer.id))
        .orderBy(desc(customer_contacts.is_primary), asc(customer_contacts.created_at));
      for (const c of contacts) add(c.email, contactLabel(c.name, c.role));
      add(customer.contact_person_email, contactLabel(customer.contact_person_name, null));
    }
  }
  return { suggestions: found, accountEmail };
}
