import 'server-only';
import { unstable_cache } from 'next/cache';
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

/** Étiquette de cache des réglages lus par le site public ; invalidée à chaque changement. */
export const SETTINGS_TAG = 'app-settings';

/**
 * Même réponse qu'isSignupOpen, gardée en cache : les pages du site la lisent à chaque affichage
 * sans interroger la base. Le cache est vidé quand le réglage change.
 */
export const isSignupOpenCached = unstable_cache(
  // Base injoignable (construction sans variables d'environnement, coupure) : le site s'affiche quand même, avec le réglage par défaut.
  async () => isSignupOpen().catch(() => DEFAULTS.signup_open),
  ['signup-open'],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);

export async function isSignupOpen(): Promise<boolean> {
  const [row] = await db.select({ value: app_settings.value }).from(app_settings).where(eq(app_settings.key, 'signup_open')).limit(1);
  return typeof row?.value === 'boolean' ? row.value : DEFAULTS.signup_open;
}

// ── WeboCoins ────────────────────────────────────────────────────────────────

/** Réglages des WeboCoins, modifiables depuis l'admin (clés `webo_*` de app_settings). */
export interface WeboSettings {
  /** Pièces offertes chaque mois à une entreprise (sauf réglage propre au compte). */
  monthlyCoins: number;
  /** Prix d'une fiche traduite par Webo, en pièces. */
  translationPrice: number;
  /** Multiplicateur du coût réel pour les actions facturées au coût (assistant). */
  actionCoefficient: number;
  /** Fiches traduites par Webo au plus, par entreprise et par mois. */
  translationCap: number;
  /** Taux dollar → euro des comptes de l'admin. */
  usdEur: number;
  /** Seuil sous lequel le solde est signalé au traiteur. */
  lowBalance: number;
}

export const WEBO_DEFAULTS: WeboSettings = { monthlyCoins: 200, translationPrice: 1, actionCoefficient: 3, translationCap: 500, usdEur: 0.92, lowBalance: 20 };

const WEBO_KEYS: Record<keyof WeboSettings, string> = {
  monthlyCoins: 'webo_monthly_coins', translationPrice: 'webo_translation_price', actionCoefficient: 'webo_action_coefficient',
  translationCap: 'webo_translation_cap', usdEur: 'webo_usd_eur', lowBalance: 'webo_low_balance',
};

/** Valeur ramenée dans ses bornes (entiers positifs ; coefficient 1–20 ; taux 0,5–2) ; null si illisible. */
function clampWebo(key: keyof WeboSettings, raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (key === 'usdEur') return Math.min(2, Math.max(0.5, n));
  if (key === 'actionCoefficient') return Math.min(20, Math.max(1, n));
  return Math.max(0, Math.round(n));
}

export async function getWeboSettings(): Promise<WeboSettings> {
  const rows = await db.select({ key: app_settings.key, value: app_settings.value }).from(app_settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const out = { ...WEBO_DEFAULTS };
  for (const k of Object.keys(WEBO_KEYS) as (keyof WeboSettings)[]) {
    const v = clampWebo(k, stored[WEBO_KEYS[k]]);
    if (stored[WEBO_KEYS[k]] !== undefined && v !== null) out[k] = v;
  }
  return out;
}

export async function setWeboSettings(patch: Partial<WeboSettings>): Promise<void> {
  for (const k of Object.keys(patch) as (keyof WeboSettings)[]) {
    if (!(k in WEBO_KEYS)) continue;
    const v = clampWebo(k, patch[k]);
    if (v === null) continue;
    await db.insert(app_settings).values({ key: WEBO_KEYS[k], value: v })
      .onConflictDoUpdate({ target: app_settings.key, set: { value: v, updated_at: new Date().toISOString() } });
  }
}
