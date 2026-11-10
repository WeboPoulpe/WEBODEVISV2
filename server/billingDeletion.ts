import 'server-only';
import { stripe } from '@/lib/stripe';
import { getSubscription } from './subscription';
import { applyStripeSubscription } from './stripeSync';

// Abonnement Stripe et suppression du compte. Ce module n'est pas une action serveur.
// Chaque fonction ne fait rien sans abonnement Stripe ou si celui-ci est déjà terminé.

/** L'abonnement Stripe à toucher, ou null s'il n'y en a pas ou s'il est terminé. */
async function liveSubscriptionId(companyId: string): Promise<{ id: string; cancelAtPeriodEnd: boolean } | null> {
  const sub = await getSubscription(companyId);
  if (!sub?.stripe_subscription_id) return null;
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return null;
  return { id: sub.stripe_subscription_id, cancelAtPeriodEnd: sub.cancel_at_period_end };
}

/** Demande de suppression : l'abonnement s'arrête à la fin de la période déjà payée (pas de remboursement). */
export async function scheduleCancelForDeletion(companyId: string): Promise<void> {
  const sub = await liveSubscriptionId(companyId);
  if (!sub || sub.cancelAtPeriodEnd) return;
  await stripe().subscriptions.update(sub.id, { cancel_at_period_end: true });
  await applyStripeSubscription(sub.id);
}

/**
 * Suppression annulée par l'admin : on retire la résiliation programmée. Règle simple : si l'abonnement est
 * programmé pour s'arrêter, on le remet à « continue ». Une résiliation demandée par le client lui-même avant la
 * suppression serait aussi retirée : il peut la refaire depuis son espace.
 */
export async function undoCancelForDeletion(companyId: string): Promise<void> {
  const sub = await liveSubscriptionId(companyId);
  if (!sub || !sub.cancelAtPeriodEnd) return;
  await stripe().subscriptions.update(sub.id, { cancel_at_period_end: false });
  await applyStripeSubscription(sub.id);
}

const ENDED = new Set(['canceled', 'incomplete_expired']);

/** Un abonnement déjà disparu ou déjà résilié chez Stripe compte comme résilié. */
function alreadyGone(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === 'resource_missing' || /already.*cancel|cancel.*already/i.test(err?.message ?? '');
}

/**
 * Avant la purge : résiliation immédiate de tous les abonnements encore vivants du client, relus chez Stripe (la
 * ligne locale peut être en retard : une purge interrompue après la résiliation doit pouvoir être rejouée, et un
 * client peut avoir plusieurs abonnements). Sans client Stripe connu, on se rabat sur l'abonnement enregistré.
 * Pas de relecture ensuite : la ligne est effacée avec le compte. Une vraie panne remonte : la purge ne doit pas avoir
 * lieu tant que Stripe peut encore facturer ce client.
 */
export async function cancelNowBeforePurge(companyId: string): Promise<void> {
  const sub = await getSubscription(companyId);
  if (!sub) return;
  let ids: string[] = [];
  if (sub.stripe_customer_id) {
    const { data } = await stripe().subscriptions.list({ customer: sub.stripe_customer_id, status: 'all', limit: 10 });
    ids = data.filter((s) => !ENDED.has(s.status)).map((s) => s.id);
  } else if (sub.stripe_subscription_id && !ENDED.has(sub.status)) {
    ids = [sub.stripe_subscription_id];
  }
  for (const id of ids) {
    try {
      await stripe().subscriptions.cancel(id);
    } catch (e) {
      if (!alreadyGone(e)) throw e;
    }
  }
}
