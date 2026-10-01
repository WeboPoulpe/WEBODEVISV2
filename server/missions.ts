'use server';

import { and, asc, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { event_extras, event_ingredients, extras, ingredients, notifications, profiles, quotes, suppliers } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { forgetSubscription, pushEnabled, pushToUser, saveSubscription, type BrowserSubscription } from '@/lib/push';

// Liste de courses d'une mission, pour un extra qui n'a pas de compte : le lien personnel de l'extra
// (son jeton) est la seule clé, et il n'ouvre que les événements où les courses lui ont été confiées.

export interface MissionCourses {
  extraName: string;
  event: { client_name: string; event_type: string; event_date: string; guest_count: number };
  lines: { id: string; name: string; quantity: number; unit: string | null; supplier: string | null; notes: string | null; checked: boolean }[];
}

/** L'événement, si les courses en ont été confiées à l'extra qui détient ce lien. */
async function entrustedQuote(token: string, quoteId: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(quoteId)) return null;
  const [row] = await db
    .select({
      extraName: extras.name, owner: quotes.owner_user_id,
      client_name: quotes.client_name, event_type: quotes.event_type, event_date: quotes.event_date, guest_count: quotes.guest_count,
    })
    .from(event_extras)
    .innerJoin(extras, eq(extras.id, event_extras.extra_id))
    .innerJoin(quotes, eq(quotes.id, event_extras.quote_id))
    .where(and(eq(extras.access_token, token), eq(event_extras.quote_id, quoteId), eq(event_extras.assign_courses, true)))
    .limit(1);
  return row ?? null;
}

export async function getMissionCourses(token: string, quoteId: string): Promise<MissionCourses | null> {
  const quote = await entrustedQuote(token, quoteId);
  if (!quote) return null;
  const rows = await db
    .select({
      id: event_ingredients.id, name: ingredients.name, quantity: event_ingredients.quantity, unit: event_ingredients.unit,
      defaultUnit: ingredients.unit, supplier: suppliers.name, notes: event_ingredients.notes, checked: event_ingredients.checked,
    })
    .from(event_ingredients)
    .innerJoin(ingredients, eq(ingredients.id, event_ingredients.ingredient_id))
    .leftJoin(suppliers, eq(suppliers.id, event_ingredients.supplier_id))
    .where(eq(event_ingredients.quote_id, quoteId))
    .orderBy(asc(suppliers.name), asc(ingredients.name));
  return {
    extraName: quote.extraName,
    event: { client_name: quote.client_name, event_type: quote.event_type, event_date: quote.event_date, guest_count: quote.guest_count },
    lines: rows.map((r) => ({
      id: r.id, name: r.name, quantity: Number(r.quantity), unit: r.unit ?? r.defaultUnit, supplier: r.supplier, notes: r.notes, checked: r.checked,
    })),
  };
}

/** Coche ou décoche un article pris. */
export async function setMissionCourseChecked(token: string, quoteId: string, lineId: string, checked: boolean): Promise<{ error: string | null }> {
  const quote = await entrustedQuote(token, quoteId);
  if (!quote) return { error: 'Ce lien ne donne plus accès à cette liste.' };
  // Compte de démonstration : rien n'est enregistré.
  if (isDemoUser(quote.owner)) return { error: null };
  await db.update(event_ingredients).set({ checked: !!checked })
    .where(and(eq(event_ingredients.id, lineId), eq(event_ingredients.quote_id, quoteId)));
  return { error: null };
}

// ── Page de missions de l'extra ───────────────────────────────────────────────

export interface MissionPage {
  extra: { id: string; name: string; role: string | null; unavailableDates: string[] };
  company: { name: string; phone: string | null; email: string | null };
  missions: {
    id: string; quoteId: string; status: string; arrival: string | null; departure: string | null; notes: string | null;
    courses: boolean; respondedAt: string | null;
    eventType: string; clientName: string; eventDate: string; location: string | null; guestCount: number;
  }[];
}

const validToken = (token: string) => /^[a-f0-9]{16,64}$/i.test(token);

async function extraByToken(token: string) {
  if (!validToken(token)) return null;
  const [row] = await db.select({ id: extras.id, name: extras.name, role: extras.role, owner: extras.user_id, unavailable: extras.unavailable_dates })
    .from(extras).where(eq(extras.access_token, token)).limit(1);
  return row ?? null;
}

/** Tout ce que la page de l'extra affiche : ses missions à venir (et celles des sept derniers jours). */
export async function getMissionPage(token: string): Promise<MissionPage | null> {
  const extra = await extraByToken(token);
  if (!extra) return null;
  const [owner] = await db.select({ company: profiles.company_name, first: profiles.first_name, last: profiles.last_name, phone: profiles.company_phone, email: profiles.email })
    .from(profiles).where(eq(profiles.id, extra.owner)).limit(1);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const rows = await db.select({
    id: event_extras.id, quoteId: event_extras.quote_id, status: event_extras.status, arrival: event_extras.arrival_time,
    departure: event_extras.departure_time, notes: event_extras.mission_notes, courses: event_extras.assign_courses,
    respondedAt: event_extras.responded_at, eventType: quotes.event_type, clientName: quotes.client_name, eventDate: quotes.event_date,
    location: quotes.event_location, guestCount: quotes.guest_count,
  })
    .from(event_extras).innerJoin(quotes, eq(quotes.id, event_extras.quote_id))
    .where(and(eq(event_extras.extra_id, extra.id), gte(quotes.event_date, since)))
    .orderBy(asc(quotes.event_date), asc(event_extras.arrival_time));
  return {
    extra: { id: extra.id, name: extra.name, role: extra.role, unavailableDates: (extra.unavailable ?? []).filter((d) => d >= since).sort() },
    company: {
      name: owner?.company || [owner?.first, owner?.last].filter(Boolean).join(' ') || 'Votre traiteur',
      phone: owner?.phone ?? null,
      email: owner?.email ?? null,
    },
    missions: rows,
  };
}

/** L'extra accepte ou décline une mission ; le traiteur est prévenu (notification et push). */
export async function respondToMission(token: string, assignmentId: string, answer: 'confirme' | 'refuse'): Promise<{ error: string | null }> {
  if (answer !== 'confirme' && answer !== 'refuse') return { error: 'Réponse inconnue.' };
  const extra = await extraByToken(token);
  if (!extra || !/^[0-9a-f-]{36}$/i.test(assignmentId)) return { error: 'Ce lien ne donne plus accès à cette mission.' };
  const [mission] = await db.select({ quoteId: event_extras.quote_id, status: event_extras.status, eventType: quotes.event_type, eventDate: quotes.event_date, clientName: quotes.client_name })
    .from(event_extras).innerJoin(quotes, eq(quotes.id, event_extras.quote_id))
    .where(and(eq(event_extras.id, assignmentId), eq(event_extras.extra_id, extra.id))).limit(1);
  if (!mission) return { error: 'Cette mission n’existe plus. Contactez votre traiteur.' };
  if (mission.status === 'present') return { error: 'Cette mission est déjà terminée.' };
  // Compte de démonstration : rien n'est enregistré.
  if (isDemoUser(extra.owner)) return { error: null };
  if (mission.status === answer) return { error: null };

  await db.update(event_extras).set({ status: answer, responded_at: new Date().toISOString() }).where(eq(event_extras.id, assignmentId));
  const day = mission.eventDate ? new Date(mission.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
  const what = `${mission.eventType || 'Événement'}${day ? ` du ${day}` : ''}`;
  const title = answer === 'confirme' ? `${extra.name} a confirmé` : `${extra.name} n’est pas disponible`;
  const message = answer === 'confirme' ? `${extra.name} sera présent pour : ${what} (${mission.clientName}).` : `${extra.name} ne peut pas venir pour : ${what} (${mission.clientName}). Pensez à le remplacer.`;
  const url = `/evenements/${mission.quoteId}?onglet=extras`;
  await db.insert(notifications).values({ user_id: extra.owner, title, message, type: 'extra_response', priority: answer === 'refuse' ? 'high' : 'medium', action_url: url });
  await pushToUser(extra.owner, { title, body: message, url, tag: `mission-${assignmentId}` });
  return { error: null };
}

/** Jours où l'extra n'est pas disponible (il les coche sur sa page). */
export async function setUnavailableDates(token: string, dates: string[]): Promise<{ error: string | null }> {
  const extra = await extraByToken(token);
  if (!extra) return { error: 'Ce lien ne donne plus accès à vos missions.' };
  const today = new Date().toISOString().slice(0, 10);
  const clean = [...new Set((Array.isArray(dates) ? dates : []).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today))].sort().slice(0, 200);
  if (isDemoUser(extra.owner)) return { error: null };
  await db.update(extras).set({ unavailable_dates: clean }).where(eq(extras.id, extra.id));
  return { error: null };
}

/** Cet appareil recevra les notifications de l'extra (nouvelle mission, changement, rappel). */
export async function subscribeExtraDevice(token: string, sub: BrowserSubscription): Promise<{ error: string | null }> {
  const extra = await extraByToken(token);
  if (!extra) return { error: 'Ce lien ne donne plus accès à vos missions.' };
  if (!pushEnabled()) return { error: 'Les notifications ne sont pas encore disponibles. Réessayez plus tard.' };
  return saveSubscription(sub, { extraId: extra.id });
}

export async function unsubscribeDevice(endpoint: string): Promise<void> {
  await forgetSubscription(endpoint);
}
