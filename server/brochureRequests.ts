'use server';

// Formulaire de la dernière page d'une brochure : la demande arrive dans les Prospects du traiteur, avec la brochure
// d'où elle vient. Il marche même sans lien de prospection actif : la brochure (active) est la seule clé.

import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { prestations, prospect_requests } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { isPerGuestPrestation } from '@/lib/brochure';
import type { ChosenLine } from '@/lib/brochureChoice';
import { parseStudio } from '@/lib/brochureStudio';
import { companyIdsOf } from './companyScope';
import { openAccess } from './brochureAccess';
import { notifyProspect } from './prospectMail';
import { companyAccessOfUser, OWNER_UNAVAILABLE_MESSAGE } from './subscriptionGuard';

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

const MESSAGES = {
  fr: {
    gone: 'Cette brochure n’est plus disponible.', names: 'Indiquez votre prénom et votre nom.', email: 'L’adresse email n’est pas valide.',
    tooMany: 'Trop de demandes envoyées depuis cette connexion. Réessayez dans une heure.',
    unavailable: OWNER_UNAVAILABLE_MESSAGE,
  },
  en: {
    gone: 'This brochure is no longer available.', names: 'Please enter your first and last name.', email: 'The email address is not valid.',
    tooMany: 'Too many requests sent from this connection. Please try again in an hour.',
    unavailable: 'This caterer cannot receive replies online at the moment, please contact them directly.',
  },
};

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const count = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n < 100000 ? n : null; };

/**
 * Prestations choisies par le lecteur : il n'envoie que leurs rangs dans la brochure (jamais d'identifiant), relus
 * ici dans les pages du Studio puis dans le catalogue de l'entreprise, figés tels qu'ils sont maintenant.
 */
async function chosenLines(studio: unknown, owner: string, keys: unknown): Promise<ChosenLine[]> {
  const doc = parseStudio(studio);
  if (!doc || !Array.isArray(keys)) return [];
  const order = doc.pages.flatMap((p) => p.els.flatMap((e) => (e.type === 'prestation' ? [e.prestationId] : [])));
  const ids = [...new Set(keys.slice(0, 30).map((k) => order[Number(k)]).filter((x): x is string => typeof x === 'string'))];
  if (!ids.length) return [];
  const rows = await db.select().from(prestations)
    .where(and(inArray(prestations.id, ids), sql`${prestations.user_id} in ${companyIdsOf(owner)}`));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id): ChosenLine[] => {
    const p = byId.get(id);
    if (!p) return [];
    return [{
      prestationId: p.id, name: p.name, unitPrice: Number(p.unit_price ?? 0) || 0,
      childUnitPrice: p.child_unit_price != null && p.child_unit_price !== '' ? Number(p.child_unit_price) : null,
      perGuest: isPerGuestPrestation(p), category: p.category ?? null, description: p.description ?? null, gastroCardHtml: p.gastro_card_html ?? null,
    }];
  });
}

export async function submitBrochureRequest(token: string, fields: BrochureRequestFields, chosen: string[] = []): Promise<{ error: string | null }> {
  if (!TOKEN.test(token ?? '')) return { error: 'Ce lien n’est plus valable.' };
  // Lien principal ou lien supplémentaire (source, client) ; actif, pas expiré, code saisi s'il en faut un.
  const access = await openAccess(token);
  if (!access) return { error: MESSAGES.fr.gone };
  const b = { id: access.row.id, owner: access.row.owner_user_id, name: access.row.name, language: access.row.language, studio: access.row.studio, mode: access.row.editor_mode };
  const linkId = access.link?.id ?? null;
  const language = b.language === 'en' ? 'en' : 'fr';
  const t = MESSAGES[language];
  // Traiteur sans abonnement actif : la brochure reste consultable, mais la demande n'est pas reçue.
  if (await companyAccessOfUser(b.owner) !== 'full') return { error: t.unavailable };

  const first = clean(fields.first_name, 80);
  const last = clean(fields.last_name, 80);
  const email = clean(fields.email, 200).toLowerCase();
  if (!first || !last) return { error: t.names };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t.email };
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
  if (n >= MAX_REQUESTS_PER_HOUR) return { error: t.tooMany };

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
  const lines = b.mode === 'studio' ? await chosenLines(b.studio, b.owner, chosen) : [];
  await db.insert(prospect_requests).values({
    first_name: first, last_name: last, email, phone: prospect.phone, service_address: prospect.location,
    event_type: prospect.eventType, event_date: eventDate, guest_count: prospect.guestCount,
    guest_count_children: prospect.guestCountChildren, message: prospect.message,
    owner_user_id: b.owner, brochure_id: b.id, ip_hash: ipHash, status: 'nouveau',
    ...(lines.length ? { chosen: lines } : {}),
    ...(linkId ? { brochure_link_id: linkId } : {}),
  });
  // Le traiteur voit dans l'email ce que le client a choisi.
  const withChoice = lines.length
    ? { ...prospect, message: [`Prestations choisies : ${lines.map((l) => l.name).join(', ')}.`, prospect.message].filter(Boolean).join('\n\n') }
    : prospect;
  await notifyProspect({ ownerId: b.owner, prospect: withChoice, brochureName: b.name, language }).catch(() => {});
  return { error: null };
}
