import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { app_settings } from '@/db/schema';

// Réglages de la plateforme. Un réglage absent de la table prend sa valeur par défaut.
export interface AppSettings {
  /** Tout le monde peut créer un compte depuis /register. Fermé : seuls les administrateurs créent des comptes. */
  signup_open: boolean;
}

const DEFAULTS: AppSettings = { signup_open: true };

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await db.select({ key: app_settings.key, value: app_settings.value }).from(app_settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { signup_open: typeof stored.signup_open === 'boolean' ? stored.signup_open : DEFAULTS.signup_open };
}

export async function setAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await db.insert(app_settings).values({ key, value })
    .onConflictDoUpdate({ target: app_settings.key, set: { value, updated_at: new Date().toISOString() } });
}

export async function isSignupOpen(): Promise<boolean> {
  const [row] = await db.select({ value: app_settings.value }).from(app_settings).where(eq(app_settings.key, 'signup_open')).limit(1);
  return typeof row?.value === 'boolean' ? row.value : DEFAULTS.signup_open;
}
