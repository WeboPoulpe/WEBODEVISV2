'use server';

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, site_requests } from '@/db/schema';
import { appOrigin, isTestAddress, sendMail } from '@/lib/mail';
import { demoAccessEmail, demoLeadNotificationEmail } from '@/lib/mail/templates';
import { hmac, readTicket, signTicket } from './tickets';

// Accès à la démonstration : la personne laisse ses coordonnées et répond à une question de vérification.
// En échange, elle reçoit un ticket signé qui ouvre la démonstration (voir le fournisseur « demo » de lib/auth.ts).

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_PER_HOUR = 5;
const NUMBERS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];

export interface DemoChallenge {
  /** Question posée en toutes lettres, par exemple « Combien font sept plus cinq ? ». */
  question: string;
  token: string;
}

/** Vérification maison : une addition écrite en lettres. La réponse n'est pas dans le jeton, seulement son empreinte. */
export async function getDemoChallenge(): Promise<DemoChallenge> {
  const a = crypto.randomInt(2, 13);
  const b = crypto.randomInt(1, 10);
  const nonce = crypto.randomBytes(9).toString('base64url');
  return {
    question: `Combien font ${NUMBERS[a]} plus ${NUMBERS[b]} ?`,
    token: signTicket({ k: 'defi', n: nonce, h: hmac(`${a + b}:${nonce}`), iat: Date.now() }, 15 * MINUTE),
  };
}

export interface DemoAccessInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  answer: string;
  challenge: string;
  /** Champ piège, invisible pour une personne. */
  website?: string;
}

export interface DemoAccessResult {
  error: string | null;
  /** Ticket à présenter tout de suite pour ouvrir la démonstration. */
  ticket?: string;
  /** Ticket longue durée, gardé par le navigateur pour revenir sans ressaisir ses coordonnées. */
  returnTicket?: string;
  /** La question de vérification doit être redemandée (mauvaise réponse ou question expirée). */
  retryChallenge?: boolean;
}

const clean = (value: string | undefined, max: number) => (value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export async function requestDemoAccess(input: DemoAccessInput): Promise<DemoAccessResult> {
  if (input.website) return { error: 'La vérification a échoué. Réessayez.', retryChallenge: true };

  const firstName = clean(input.firstName, 80);
  const lastName = clean(input.lastName, 80);
  const email = clean(input.email, 200).toLowerCase();
  const phone = clean(input.phone, 30);
  const company = clean(input.company, 160) || null;
  if (!firstName || !lastName) return { error: 'Indiquez votre prénom et votre nom.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'L’adresse email n’est pas valide.' };
  if (!/^[+\d][\d\s().-]*$/.test(phone) || phone.replace(/\D/g, '').length < 9) return { error: 'Le numéro de téléphone n’est pas valide.' };

  const challenge = readTicket<{ k: string; n: string; h: string; iat: number }>(input.challenge);
  if (!challenge || challenge.k !== 'defi') return { error: 'La question a expiré. En voici une nouvelle.', retryChallenge: true };
  const answer = clean(input.answer, 4);
  // Une réponse arrivée en moins d'une seconde et demie ne vient pas d'une personne.
  if (!/^\d{1,2}$/.test(answer) || hmac(`${Number(answer)}:${challenge.n}`) !== challenge.h || Date.now() - challenge.iat < 1500) {
    return { error: 'La réponse n’est pas la bonne. Voici une nouvelle question.', retryChallenge: true };
  }

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const ip_hash = crypto.createHash('sha256').update(`${ip}:${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex');
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(site_requests)
    .where(and(eq(site_requests.ip_hash, ip_hash), gt(site_requests.created_at, new Date(Date.now() - 60 * MINUTE).toISOString())));
  if (n >= MAX_PER_HOUR) return { error: 'Trop de demandes depuis cette connexion. Réessayez dans une heure.' };

  const tickets = {
    ticket: signTicket({ k: 'demo', e: email }, 5 * MINUTE),
    returnTicket: signTicket({ k: 'demo', e: email }, 7 * DAY),
  };

  // Une même personne qui revient dans la journée n'est enregistrée qu'une fois.
  const [recent] = await db.select({ id: site_requests.id }).from(site_requests)
    .where(and(eq(site_requests.kind, 'demo'), eq(site_requests.email, email), gt(site_requests.created_at, new Date(Date.now() - DAY).toISOString())))
    .limit(1);
  if (recent) return { error: null, ...tickets };

  const name = `${firstName} ${lastName}`;
  await db.insert(site_requests).values({
    kind: 'demo', name, email, phone, company, ip_hash,
    message: 'A ouvert la démonstration depuis le site.',
  });

  // Une adresse d'essai (tests automatiques) ne prévient personne.
  if (isTestAddress(email)) return { error: null, ...tickets };

  const appUrl = await appOrigin();
  const admins = process.env.CONTACT_EMAIL
    ? [process.env.CONTACT_EMAIL]
    : (await db.select({ email: profiles.email }).from(profiles).where(and(eq(profiles.role, 'admin'), eq(profiles.is_active, true)))).map((a) => a.email);
  await Promise.all([
    ...admins.map((to) => sendMail({ to, replyTo: email, ...demoLeadNotificationEmail({ name, email, phone, company, appUrl }) })),
    sendMail({ to: email, ...demoAccessEmail({ firstName, link: `${appUrl}/demo?acces=${encodeURIComponent(tickets.returnTicket)}`, contactUrl: `${appUrl}/contact?objet=devis` }) }),
  ]);
  return { error: null, ...tickets };
}
