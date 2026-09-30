'use server';

import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, quotes } from '@/db/schema';
import { appOrigin, sendMail } from '@/lib/mail';
import { quoteProposalEmail } from '@/lib/mail/templates';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { requireUser } from './session';

/** Statuts d'avant l'envoi : à l'envoi, le devis passe à « Devis envoyé ». */
const BEFORE_SENT = ['nouveau', 'broch_envoyee', 'devis_a_faire'];

export interface SendQuoteResult {
  error: string | null;
  /** Nouveau statut du devis, s'il a changé. */
  status?: string;
}

/**
 * Envoie le devis au client par email, avec un lien pour le consulter en ligne.
 * Le lien est propre au devis ; il est créé au premier envoi et reste le même ensuite.
 */
export async function sendQuoteToClient(input: { quoteId: string; to: string; message: string }): Promise<SendQuoteResult> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: 'L’adresse email du client n’est pas valide.' };
  if (!input.message.trim()) return { error: 'Écrivez quelques mots pour accompagner le devis.' };

  const [quote] = await db
    .select({
      id: quotes.id, status: quotes.status, share_token: quotes.share_token, client_name: quotes.client_name,
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

  const sent = await sendMail({
    to,
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
  });
  if (sent.error) return { error: sent.error };

  const status = BEFORE_SENT.includes(quote.status) ? 'devis_envoye' : quote.status;
  await db.transaction(async (tx) => {
    // Lu par le trigger d'historique des statuts, qui note qui a fait le changement.
    await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);
    await tx.update(quotes)
      .set({ sent_at: new Date().toISOString(), status, client_email: to })
      .where(eq(quotes.id, quote.id));
  });
  return { error: null, status };
}
