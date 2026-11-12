'use server';

// Formulaire de contact d'une fiche de l'annuaire « Choisir Mon Traiteur » : la demande arrive dans les Prospects
// du traiteur, avec la provenance « annuaire ». Ce fichier n'exporte que l'action : tout export est un point d'entrée public.

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { prospect_requests } from '@/db/schema';
import { DIRECTORY_PREFIX, REQUESTS_PER_HOUR } from '@/lib/annuaire/config';
import { SITE_URL } from '@/lib/site/config';
import { MIN_FILL_MS } from '@/lib/siteSpam';
import { visibleListingOwner } from './directoryPublic';
import { notifyProspect } from './prospectMail';
import { recordEventNow } from './siteStats';

interface DirectoryRequestFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  guestCount: string;
  location: string;
  message: string;
  /** Pot de miel : un champ caché que seul un robot remplit. */
  website: string;
  /** Heure d'ouverture du formulaire (ms) : un envoi en moins de MIN_FILL_MS est un robot. */
  startedAt: number;
}

const GONE = 'Ce traiteur ne reçoit plus de demandes ici. Choisissez-en un autre dans l’annuaire.';
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const count = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 100000 ? n : null; };

export async function submitDirectoryRequest(slug: string, fields: DirectoryRequestFields): Promise<{ error: string | null }> {
  const owner = await visibleListingOwner(slug);
  if (!owner) return { error: GONE };

  const first = clean(fields?.firstName, 80);
  const last = clean(fields?.lastName, 80);
  const email = clean(fields?.email, 200).toLowerCase();
  if (!first || !last) return { error: 'Indiquez votre prénom et votre nom.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'L’adresse e-mail n’est pas valide.' };

  // Un robot reçoit la même réponse qu'une personne, mais rien n'est enregistré ni envoyé.
  const elapsed = typeof fields.startedAt === 'number' ? Date.now() - fields.startedAt : null;
  if (fields.website || (elapsed !== null && elapsed < MIN_FILL_MS)) return { error: null };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const ipHash = crypto.createHash('sha256').update(`${ip}:${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex');
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(prospect_requests).where(and(
    eq(prospect_requests.owner_user_id, owner), eq(prospect_requests.ip_hash, ipHash),
    gt(prospect_requests.created_at, new Date(Date.now() - 3600_000).toISOString()),
  ));
  if (n >= REQUESTS_PER_HOUR) return { error: 'Vous avez déjà envoyé plusieurs demandes. Réessayez dans une heure.' };

  const prospect = {
    firstName: first, lastName: last, email,
    phone: clean(fields.phone, 40) || null,
    eventType: clean(fields.eventType, 60) || null,
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(fields.eventDate ?? '') ? fields.eventDate : null,
    guestCount: count(fields.guestCount),
    location: clean(fields.location, 300) || null,
    message: clean(fields.message, 4000) || null,
  };
  await db.insert(prospect_requests).values({
    first_name: first, last_name: last, email, phone: prospect.phone, service_address: prospect.location,
    event_type: prospect.eventType, event_date: prospect.eventDate, guest_count: prospect.guestCount, message: prospect.message,
    owner_user_id: owner, ip_hash: ipHash, status: 'nouveau', source: 'annuaire', user_token: null,
  });
  await recordEventNow('contact', `${DIRECTORY_PREFIX}/traiteur/${slug}`, { ip, userAgent: h.get('user-agent') ?? '', ownHost: h.get('host') ?? '' }).catch(() => {});
  // La demande est enregistrée : un e-mail qui ne part pas ne doit pas faire échouer l'envoi.
  await notifyProspect({ ownerId: owner, prospect, source: 'annuaire', appUrl: SITE_URL }).catch(() => {});
  return { error: null };
}
