'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { appOrigin } from '@/lib/mail';
import { calendarFeedUrl, newCalendarToken } from './calendarFeed';
import { requireUser, requireWriter } from './session';

// Paramètres : relances automatiques (réglage de l'entreprise) et abonnement agenda (adresse propre au compte).

/** Délais proposés entre deux relances, en jours. */
const DELAY_MIN = 2;
const DELAY_MAX = 30;

async function me(uid: string) {
  const [p] = await db.select({
    parent: profiles.parent_user_id, role: profiles.company_role, ical: profiles.ical_token,
  }).from(profiles).where(eq(profiles.id, uid)).limit(1);
  return p ?? null;
}

export interface ReminderSettings {
  enabled: boolean;
  delayDays: number;
  companyName: string;
  /** Le réglage appartient à l'entreprise : seul son titulaire (ou un gérant) le change. */
  canEdit: boolean;
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const user = await requireUser();
  const mine = await me(user.id);
  const company = mine?.parent ?? user.id;
  const [p] = await db.select({
    enabled: profiles.auto_reminders, delay: profiles.reminder_delay_days,
    name: profiles.company_name, first: profiles.first_name, last: profiles.last_name,
  }).from(profiles).where(eq(profiles.id, company)).limit(1);
  return {
    enabled: !!p?.enabled,
    delayDays: p?.delay ?? 7,
    companyName: p?.name || [p?.first, p?.last].filter(Boolean).join(' ') || 'Votre entreprise',
    canEdit: !isDemoUser(user.id) && (!mine?.parent || mine.role === 'gerant'),
  };
}

export async function saveReminderSettings(input: { enabled: boolean; delayDays: number }): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const mine = await me(user.id);
  if (mine?.parent && mine.role !== 'gerant') return { error: 'Seul le titulaire du compte peut changer les relances.' };
  const delay = Math.round(Number(input.delayDays));
  if (!Number.isFinite(delay) || delay < DELAY_MIN || delay > DELAY_MAX) {
    return { error: `Choisissez un délai entre ${DELAY_MIN} et ${DELAY_MAX} jours.` };
  }
  await db.update(profiles)
    .set({ auto_reminders: input.enabled === true, reminder_delay_days: delay, updated_at: new Date().toISOString() })
    .where(eq(profiles.id, mine?.parent ?? user.id));
  return { error: null };
}

/** Adresse d'abonnement agenda du compte, ou null tant qu'elle n'est pas créée. */
export async function getCalendarFeedUrl(): Promise<{ url: string | null }> {
  const user = await requireUser();
  const mine = await me(user.id);
  return { url: mine?.ical ? calendarFeedUrl(await appOrigin(), mine.ical) : null };
}

/** Crée l'adresse, ou la remplace : l'ancienne cesse aussitôt de marcher. */
export async function renewCalendarFeedUrl(): Promise<{ error: string | null; url?: string }> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const token = newCalendarToken();
  await db.update(profiles).set({ ical_token: token, updated_at: new Date().toISOString() }).where(eq(profiles.id, user.id));
  return { error: null, url: calendarFeedUrl(await appOrigin(), token) };
}
