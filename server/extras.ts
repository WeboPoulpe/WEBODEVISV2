'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { event_extras, extras, profiles, quotes } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { appOrigin, sendMail } from '@/lib/mail';
import { missionInviteEmail, type MissionDetails } from '@/lib/mail/templates';
import { forgetSubscription, pushEnabled, pushToExtra, saveSubscription, type BrowserSubscription } from '@/lib/push';
import { getSessionUser } from './session';

// Actions du traiteur sur son équipe : envoyer les missions, prévenir d'un changement, recevoir les réponses
// en notification sur ses appareils. Seules les affectations de ses propres extras sont touchées.

async function ownAssignments(userId: string, ids: string[]) {
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (valid.length === 0) return [];
  return db.select({
    id: event_extras.id, extraId: extras.id, extraName: extras.name, email: extras.email, token: extras.access_token,
    arrival: event_extras.arrival_time, departure: event_extras.departure_time, notes: event_extras.mission_notes,
    eventType: quotes.event_type, eventDate: quotes.event_date, location: quotes.event_location,
  })
    .from(event_extras)
    .innerJoin(extras, eq(extras.id, event_extras.extra_id))
    .innerJoin(quotes, eq(quotes.id, event_extras.quote_id))
    .where(and(inArray(event_extras.id, valid), eq(extras.user_id, userId)));
}

async function companyName(userId: string) {
  const [p] = await db.select({ company: profiles.company_name, first: profiles.first_name, last: profiles.last_name }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return p?.company || [p?.first, p?.last].filter(Boolean).join(' ') || 'Votre traiteur';
}

export interface InviteResult { error: string | null; emailed: number; notified: number; unreachable: string[] }

/** Envoie la mission aux extras choisis : email (s'il en ont un) et notification sur leurs appareils. */
export async function inviteToMissions(assignmentIds: string[]): Promise<InviteResult> {
  const user = await getSessionUser();
  if (!user) return { error: 'Votre session a expiré. Reconnectez-vous.', emailed: 0, notified: 0, unreachable: [] };
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED, emailed: 0, notified: 0, unreachable: [] };
  const rows = await ownAssignments(user.id, assignmentIds);
  if (rows.length === 0) return { error: 'Aucune mission à envoyer.', emailed: 0, notified: 0, unreachable: [] };
  const company = await companyName(user.id);
  const origin = await appOrigin();
  let emailed = 0, notified = 0;
  const unreachable: string[] = [];
  for (const r of rows) {
    const link = `${origin}/e/${r.token}`;
    const mission: MissionDetails = { extraName: r.extraName, companyName: company, eventType: r.eventType, eventDate: r.eventDate, location: r.location, arrival: r.arrival, departure: r.departure, notes: r.notes };
    const day = r.eventDate ? new Date(r.eventDate + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    const pushed = await pushToExtra(r.extraId, {
      title: `Mission proposée par ${company}`,
      body: `${r.eventType || 'Événement'}${day ? ` ${day}` : ''}${r.arrival ? `, arrivée ${r.arrival}` : ''}. Touchez pour répondre.`,
      url: `/e/${r.token}`, tag: `mission-${r.id}`,
    });
    let mailed = false;
    if (r.email) mailed = !(await sendMail({ to: r.email, fromName: company, ...missionInviteEmail({ mission, link }) })).error;
    if (pushed) notified++;
    if (mailed) emailed++;
    if (!pushed && !mailed) unreachable.push(r.extraName);
    if (pushed || mailed) await db.update(event_extras).set({ invited_at: new Date().toISOString() }).where(eq(event_extras.id, r.id));
  }
  return { error: null, emailed, notified, unreachable };
}

/** Horaires ou consignes changés : l'extra est prévenu sur ses appareils. */
export async function notifyMissionChanged(assignmentId: string): Promise<{ error: string | null }> {
  const user = await getSessionUser();
  if (!user || isDemoUser(user.id)) return { error: null };
  const [r] = await ownAssignments(user.id, [assignmentId]);
  if (!r) return { error: null };
  const company = await companyName(user.id);
  await pushToExtra(r.extraId, {
    title: `Mission modifiée par ${company}`,
    body: `${r.eventType || 'Événement'}${r.arrival ? ` : arrivée ${r.arrival}${r.departure ? `, fin ${r.departure}` : ''}` : ''}. Touchez pour voir le détail.`,
    url: `/e/${r.token}`, tag: `mission-${r.id}`,
  });
  return { error: null };
}

/** Cet appareil recevra les réponses des extras du compte. */
export async function subscribeMyDevice(sub: BrowserSubscription): Promise<{ error: string | null }> {
  const user = await getSessionUser();
  if (!user) return { error: 'Votre session a expiré. Reconnectez-vous.' };
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  if (!pushEnabled()) return { error: 'Les notifications ne sont pas encore disponibles. Réessayez plus tard.' };
  return saveSubscription(sub, { userId: user.id });
}

export async function unsubscribeMyDevice(endpoint: string): Promise<void> {
  await forgetSubscription(endpoint);
}
