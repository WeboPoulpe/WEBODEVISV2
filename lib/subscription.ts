// ═══════════════════════════════════════════════════════════════════════════
// Abonnement : règle d'accès et calendrier des pièces (sans base)
// ═══════════════════════════════════════════════════════════════════════════
// Voir docs/superpowers/specs/2026-11-10-abonnement-stripe-design.md. Dans le doute, on laisse l'accès.

import { parisMidnight } from './webocoins';

export type Access = 'full' | 'readonly' | 'unpaid';

/** Message unique d'une écriture refusée faute d'abonnement (serveur), reconnu tel quel par le navigateur. */
export const SUBSCRIPTION_REQUIRED_MESSAGE =
  'Votre abonnement n’est pas actif : vos données restent consultables et exportables. Réactivez-le pour modifier.';

/** En-tête posé par le middleware au retour de Checkout (« /?abonnement=ok&session_id=… »), lu par le layout de l'app. */
export const CHECKOUT_SESSION_HEADER = 'x-abonnement-session';

/** Événement du navigateur qui ouvre la fenêtre « Abonnement inactif » (écoutée par AppShell). */
export const SUBSCRIPTION_REQUIRED_EVENT = 'abonnement:requis';

export function isSubscriptionRequired(message: string | null | undefined): boolean {
  return !!message && message.includes(SUBSCRIPTION_REQUIRED_MESSAGE);
}

/**
 * Un message d'erreur doit-il ouvrir la fenêtre « Abonnement inactif » plutôt qu'un bandeau ? Oui s'il porte le
 * message d'abonnement, ou si l'entreprise est en lecture seule et que c'est une erreur : en production, Next masque le
 * message des erreurs levées par une action serveur (requireWriter), la page ne reçoit qu'un texte générique.
 */
export function opensSubscriptionDialog(message: string | null | undefined, tone: string, readonly: boolean): boolean {
  return isSubscriptionRequired(message) || (readonly && tone === 'error');
}

/**
 * Si le message est celui d'un abonnement inactif, demande la fenêtre « Abonnement inactif ». Vrai si une fenêtre l'a
 * prise en charge (l'écouteur annule l'événement) : l'appelant n'affiche alors pas le message lui-même.
 */
export function signalSubscriptionRequired(message: string | null | undefined): boolean {
  if (!isSubscriptionRequired(message) || typeof window === 'undefined') return false;
  return !window.dispatchEvent(new Event(SUBSCRIPTION_REQUIRED_EVENT, { cancelable: true }));
}

export interface SubRow {
  status: string;
  comped: boolean;
  ever_subscribed: boolean;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  plan: 'mensuel' | 'annuel' | null;
  anchor_day: number | null;
}

export function accessFrom(row: SubRow | null, opts: { demo: boolean; enforced: boolean }): Access {
  if (!opts.enforced || opts.demo) return 'full';
  if (!row) return 'unpaid';
  if (row.comped) return 'full';
  if (row.status === 'active' || row.status === 'past_due') return 'full';
  return row.ever_subscribed ? 'readonly' : 'unpaid';
}

/** Jour civil à Paris. */
export function parisYmd(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: n('year'), month: n('month'), day: n('day') };
}

/** Jour d'ancrage ramené au dernier jour du mois (31 → 28 en février). */
function clampedDay(anchorDay: number, year: number, month: number): number {
  return Math.min(anchorDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
}

function anchorMidnight(anchorDay: number, year: number, month: number): Date {
  return parisMidnight(year, month, clampedDay(anchorDay, year, month));
}

/** Mois voisin (delta = -1 ou +1) d'un couple année/mois. */
function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** Début de la période mensuelle en cours : minuit à Paris, jour d'ancrage (borné au dernier jour du mois), au plus tard à `now`. */
export function periodStart(anchorDay: number, now: Date): Date {
  const { year, month } = parisYmd(now);
  const thisMonth = anchorMidnight(anchorDay, year, month);
  if (thisMonth.getTime() <= now.getTime()) return thisMonth;
  const prev = shiftMonth(year, month, -1);
  return anchorMidnight(anchorDay, prev.year, prev.month);
}

/** Début de la période suivante : le renouvellement des pièces. */
export function nextPeriodStart(anchorDay: number, now: Date): Date {
  const { year, month } = parisYmd(periodStart(anchorDay, now));
  const next = shiftMonth(year, month, 1);
  return anchorMidnight(anchorDay, next.year, next.month);
}

/** Clé de période : « s:2026-11-17 », préfixée pour ne jamais se confondre avec l'ancien month_key « 2026-11 ». */
export function periodKey(anchorDay: number, now: Date): string {
  const { year, month, day } = parisYmd(periodStart(anchorDay, now));
  return `s:${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function statusLabel(status: string, cancelAtPeriodEnd: boolean): string {
  if (status === 'active') return cancelAtPeriodEnd ? 'Se termine bientôt' : 'Actif';
  if (status === 'past_due') return 'Paiement en retard';
  if (status === 'canceled') return 'Terminé';
  return 'Inactif';
}
