'use server';

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, site_requests } from '@/db/schema';
import { appOrigin, isTestAddress, sendMail } from '@/lib/mail';
import { siteRequestAckEmail, siteRequestNotificationEmail } from '@/lib/mail/templates';

export interface SiteRequestInput {
  kind: 'devis' | 'message';
  name: string;
  email: string;
  phone?: string;
  company?: string;
  /** Taille de l'équipe, pour une demande de devis. */
  teamSize?: string;
  message: string;
  /** Champ piège, invisible pour une personne : s'il est rempli, l'envoi vient d'un robot. */
  website?: string;
}

const MAX_PER_HOUR = 5;
const clean = (value: string | undefined, max: number) => (value ?? '').trim().slice(0, max);

/** Formulaire de contact du site : enregistre la demande, prévient l'équipe, accuse réception. */
export async function submitSiteRequest(input: SiteRequestInput): Promise<{ error: string | null }> {
  // Un robot reçoit la même réponse qu'une personne, mais rien n'est enregistré.
  if (input.website) return { error: null };

  const kind = input.kind === 'devis' ? 'devis' : 'message';
  const name = clean(input.name, 120);
  const email = clean(input.email, 200).toLowerCase();
  const message = clean(input.message, 4000);
  if (!name) return { error: 'Indiquez votre nom.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'L’adresse email n’est pas valide.' };
  if (message.length < 10) return { error: 'Écrivez quelques mots pour que nous puissions vous répondre.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const ip_hash = crypto.createHash('sha256').update(`${ip}:${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex');
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(site_requests)
    .where(and(eq(site_requests.ip_hash, ip_hash), gt(site_requests.created_at, new Date(Date.now() - 3600_000).toISOString())));
  if (n >= MAX_PER_HOUR) return { error: 'Vous avez déjà envoyé plusieurs messages. Réessayez dans une heure.' };

  const request = {
    kind: kind as 'devis' | 'message',
    name,
    email,
    phone: clean(input.phone, 40) || null,
    company: clean(input.company, 160) || null,
    teamSize: clean(input.teamSize, 60) || null,
    message,
  };
  await db.insert(site_requests).values({
    kind, name, email, message, ip_hash,
    phone: request.phone, company: request.company, team_size: request.teamSize,
  });

  // Une adresse d'essai (tests automatiques) ne prévient personne.
  if (isTestAddress(email)) return { error: null };

  // La demande est enregistrée : un email qui ne part pas ne doit pas faire échouer l'envoi du formulaire.
  const admins = process.env.CONTACT_EMAIL
    ? [process.env.CONTACT_EMAIL]
    : (await db.select({ email: profiles.email }).from(profiles).where(and(eq(profiles.role, 'admin'), eq(profiles.is_active, true)))).map((a) => a.email);
  const appUrl = await appOrigin();
  await Promise.all([
    ...admins.map((to) => sendMail({ to, replyTo: email, ...siteRequestNotificationEmail({ request, appUrl }) })),
    sendMail({ to: email, ...siteRequestAckEmail({ request }) }),
  ]);
  return { error: null };
}
