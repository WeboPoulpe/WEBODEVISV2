import 'server-only';
import { statusLabel, type Access } from '@/lib/subscription';
import { isTestMode, type Plan } from '@/lib/stripe';
import { getSubscription } from './subscription';
import { companyAccessOfUser } from './subscriptionGuard';
import { companyIdFor } from './weboWallet';

// Ce que les écrans d'abonnement ont besoin de savoir (layout de l'app, /abonnement, Paramètres → Abonnement, bandeau).

export type AppGate = 'enter' | 'pay' | 'wait-owner';

/**
 * Où va le compte en ouvrant l'app : une entreprise jamais abonnée envoie son titulaire payer, et ses collaborateurs
 * sur l'écran d'attente. Un administrateur entré dans le compte passe toujours (dépannage).
 * Renvoie aussi l'accès lu, pour que le layout n'ait pas à le relire (bandeau de lecture seule).
 */
export async function appEntry(userId: string, actingAsAdmin: boolean): Promise<{ gate: AppGate; access: Access }> {
  const access = await companyAccessOfUser(userId);
  if (actingAsAdmin || access !== 'unpaid') return { gate: 'enter', access };
  try {
    return { gate: (await companyIdFor(userId)) === userId ? 'pay' : 'wait-owner', access };
  } catch (e) {
    console.error('appEntry : entreprise introuvable, accès laissé', e);
    return { gate: 'enter', access };
  }
}

export async function appGate(userId: string, actingAsAdmin: boolean): Promise<AppGate> {
  return (await appEntry(userId, actingAsAdmin)).gate;
}

export interface SubscriptionView {
  access: Access;
  /** Titulaire du compte : lui seul voit les boutons de paiement. */
  isOwner: boolean;
  status: string;
  statusLabel: string;
  plan: Plan | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  comped: boolean;
  /** Abonnement Stripe en cours (actif ou en relance de paiement). */
  subscribed: boolean;
  testMode: boolean;
}

export async function subscriptionView(userId: string): Promise<SubscriptionView> {
  const companyId = await companyIdFor(userId);
  const [access, sub] = await Promise.all([
    companyAccessOfUser(userId),
    getSubscription(companyId).catch((e) => { console.error('subscriptionView : abonnement illisible', e); return null; }),
  ]);
  const status = sub?.status ?? 'none';
  const cancelAtPeriodEnd = sub?.cancel_at_period_end ?? false;
  return {
    access,
    isOwner: companyId === userId,
    status,
    statusLabel: statusLabel(status, cancelAtPeriodEnd),
    plan: sub?.plan ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: cancelAtPeriodEnd,
    comped: sub?.comped ?? false,
    subscribed: status === 'active' || status === 'past_due',
    testMode: isTestMode(),
  };
}
