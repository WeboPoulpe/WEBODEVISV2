'use server';

// Formulaire de la dernière page d'une brochure : la demande arrive dans les Prospects du traiteur, avec la brochure
// d'où elle vient. Il marche même sans lien de prospection actif : la brochure (active) est la seule clé.

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochures, prospect_requests } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { notifyProspect } from './prospectMail';

/** Demandes acceptées par heure, pour une brochure, depuis une même connexion. */
const MAX_REQUESTS_PER_HOUR = 5;
const TOKEN = /^[A-Za-z0-9_-]{16,}$/;

export interface BrochureRequestFields {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  event_type?: string;
  event_date?: string;
  guest_count?: number;
  guest_count_children?: number;
  service_address?: string;
  message?: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const count = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 100000 ? n : null; };

export async function submitBrochureRequest(token: string, fields: BrochureRequestFields): Promise<{ error: string | null }> {
  if (!TOKEN.test(token ?? '')) return { error: 'Ce lien n’est plus valable.' };
  const [b] = await db.select({ id: brochures.id, owner: brochures.owner_user_id, name: brochures.name }).from(brochures)
    .where(and(eq(brochures.share_token, token), eq(brochures.is_active, true))).limit(1);
  if (!b) return { error: 'Cette brochure n’est plus disponible.' };

  const first = clean(fields.first_name, 80);
  const last = clean(fields.last_name, 80);
  const email = clean(fields.email, 200).toLowerCase();
  if (!first || !last) return { error: 'Indiquez votre prénom et votre nom.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'L’adresse email n’est pas valide.' };
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(fields.event_date ?? '') ? fields.event_date! : null;

  // Compte de démonstration : la page répond normalement, mais rien n'est enregistré ni envoyé.
  if (isDemoUser(b.owner)) return { error: null };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const ipHash = crypto.createHash('sha256').update(`${ip}:${process.env.NEXTAUTH_SECRET ?? ''}`).digest('hex');
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(prospect_requests).where(and(
    eq(prospect_requests.brochure_id, b.id), eq(prospect_requests.ip_hash, ipHash),
    gt(prospect_requests.created_at, new Date(Date.now() - 3600_000).toISOString()),
  ));
  if (n >= MAX_REQUESTS_PER_HOUR) return { error: 'Trop de demandes envoyées depuis cette connexion. Réessayez dans une heure.' };

  const prospect = {
    firstName: first, lastName: last, email,
    phone: clean(fields.phone, 40) || null,
    eventType: clean(fields.event_type, 60) || null,
    eventDate,
    guestCount: count(fields.guest_count),
    guestCountChildren: count(fields.guest_count_children),
    location: clean(fields.service_address, 300) || null,
    message: clean(fields.message, 4000) || null,
  };
  await db.insert(prospect_requests).values({
    first_name: first, last_name: last, email, phone: prospect.phone, service_address: prospect.location,
    event_type: prospect.eventType, event_date: eventDate, guest_count: prospect.guestCount,
    guest_count_children: prospect.guestCountChildren, message: prospect.message,
    owner_user_id: b.owner, brochure_id: b.id, ip_hash: ipHash, status: 'nouveau',
  });
  await notifyProspect({ ownerId: b.owner, prospect, brochureName: b.name }).catch(() => {});
  return { error: null };
}
