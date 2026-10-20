'use server';

import crypto from 'node:crypto';
import { getServerSession } from 'next-auth';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, site_requests, users } from '@/db/schema';
import { authOptions } from '@/lib/auth';
import { isDemoUser } from '@/lib/demo';
import { appOrigin, isTestAddress, sendMail } from '@/lib/mail';
import { supportAckEmail, supportNotificationEmail, type SupportRequestDetails } from '@/lib/mail/templates';

// « Écrire au support », depuis le centre d'aide. Le message arrive avec les demandes du site
// (/admin/demandes), l'équipe est prévenue par email et le client reçoit un accusé de réception.

export type SupportTopic = 'question' | 'probleme' | 'suggestion';

export interface SupportInput {
  topic: SupportTopic;
  message: string;
  /** Joint seulement si la personne a laissé la case cochée. */
  context?: { page?: string; browser?: string } | null;
}

const TOPICS: Record<SupportTopic, string> = { question: 'Question', probleme: 'Problème', suggestion: 'Suggestion' };
const MAX_PER_HOUR = 5;
const clean = (value: string | undefined | null, max: number) => (value ?? '').trim().slice(0, max);

export async function contactSupport(input: SupportInput): Promise<{ error: string | null }> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { error: 'Votre session a expiré. Reconnectez-vous puis recommencez.' };
  if (isDemoUser(userId)) return { error: 'Le support n’est pas ouvert depuis la démonstration : écrivez-nous depuis la page Contact du site (/contact).' };
  if (session.actingAsAdmin) return { error: 'Vous êtes dans le compte d’un client : seul son titulaire peut écrire au support.' };

  const topic = TOPICS[input.topic] ?? TOPICS.question;
  const message = clean(input.message, 4000);
  if (message.length < 10) return { error: 'Écrivez quelques mots pour que nous puissions vous répondre.' };

  // Limite par compte : l'empreinte du compte tient lieu d'empreinte d'adresse IP dans site_requests.
  const accountHash = 'support:' + crypto.createHash('sha256').update(`${userId}:${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex');
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(site_requests)
    .where(and(eq(site_requests.ip_hash, accountHash), gt(site_requests.created_at, new Date(Date.now() - 3600_000).toISOString())));
  if (n >= MAX_PER_HOUR) return { error: 'Vous avez déjà envoyé plusieurs messages. Réessayez dans une heure.' };

  // L'entreprise est celle du titulaire pour un collaborateur rattaché.
  const [me] = await db
    .select({
      email: users.email, profileEmail: profiles.email, first: profiles.first_name, last: profiles.last_name,
      company: profiles.company_name, parent: profiles.parent_user_id,
    })
    .from(users).leftJoin(profiles, eq(profiles.id, users.id)).where(eq(users.id, userId)).limit(1);
  if (!me) return { error: 'Compte introuvable.' };
  let company = clean(me.company, 160);
  if (!company && me.parent) {
    const [head] = await db.select({ company: profiles.company_name }).from(profiles).where(eq(profiles.id, me.parent)).limit(1);
    company = clean(head?.company, 160);
  }
  const email = (me.profileEmail || me.email).trim().toLowerCase();
  const name = clean([me.first, me.last].filter(Boolean).join(' '), 120) || email;

  const request: SupportRequestDetails = {
    topic, name, email, company: company || null, message,
    page: input.context ? clean(input.context.page, 300) || null : null,
    browser: input.context ? clean(input.context.browser, 300) || null : null,
    accountId: userId,
  };
  const details = [
    request.page ? `Page : ${request.page}` : null,
    request.browser ? `Navigateur : ${request.browser}` : null,
    `Compte : ${userId}`,
  ].filter(Boolean).join('\n');

  await db.insert(site_requests).values({
    kind: 'message', name, email, company: request.company, ip_hash: accountHash,
    message: `[Support, ${topic}] ${message}\n\n---\n${details}`,
  });

  // Une adresse d'essai (tests automatiques) ne prévient personne.
  if (isTestAddress(email)) return { error: null };

  // La demande est enregistrée : un email qui ne part pas ne doit pas faire échouer l'envoi.
  const admins = process.env.CONTACT_EMAIL
    ? [process.env.CONTACT_EMAIL]
    : (await db.select({ email: profiles.email }).from(profiles).where(and(eq(profiles.role, 'admin'), eq(profiles.is_active, true)))).map((a) => a.email);
  const appUrl = await appOrigin();
  await Promise.all([
    ...admins.map((to) => sendMail({ to, replyTo: email, ...supportNotificationEmail({ request, appUrl }) })),
    sendMail({ to: email, ...supportAckEmail({ request }) }),
  ]);
  return { error: null };
}
