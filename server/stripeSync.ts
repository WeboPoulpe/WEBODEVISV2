import 'server-only';
import { eq, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/db';
import { company_subscriptions, stripe_events, users } from '@/db/schema';
import { planOfPrice, stripe } from '@/lib/stripe';
import { parisYmd } from '@/lib/subscription';
import { appOrigin, sendMail } from '@/lib/mail';
import { subscriptionPaymentFailedEmail } from '@/lib/mail/templates';
import { invalidateAccess } from './subscription';

// Recopie de l'état d'un abonnement Stripe dans company_subscriptions. On ne se fie jamais au contenu d'un événement :
// on relit l'abonnement chez Stripe, si bien que l'ordre d'arrivée des événements ne compte pas.

const idOf = (v: string | { id: string } | null | undefined): string | null => (v == null ? null : typeof v === 'string' ? v : v.id);

async function companyExists(id: string): Promise<boolean> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  return !!u;
}

async function companyOf(subscription: Stripe.Subscription, customerId: string | null): Promise<string | null> {
  const fromMetadata = subscription.metadata?.company_id;
  if (fromMetadata && /^[0-9a-f-]{36}$/i.test(fromMetadata) && (await companyExists(fromMetadata))) return fromMetadata;
  if (!customerId) return null;
  const [row] = await db.select({ id: company_subscriptions.company_id }).from(company_subscriptions)
    .where(eq(company_subscriptions.stripe_customer_id, customerId)).limit(1);
  return row?.id ?? null;
}

/** Fin de la période payée : portée par la ligne d'abonnement depuis 2025, par l'abonnement avant. */
function periodEndOf(sub: Stripe.Subscription): number | null {
  return sub.items?.data?.[0]?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
}

const isLive = (sub: Stripe.Subscription) => sub.status === 'active' || sub.status === 'past_due';

/**
 * L'abonnement qui fait foi pour un client : un abonnement actif (ou en relance) d'abord, celui dont la période va le
 * plus loin s'il y en a plusieurs ; sinon le plus récent. Un doublon résilié ne passe donc jamais devant un abonnement payé.
 */
function bestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription {
  const live = subs.filter(isLive);
  if (live.length) return live.reduce((a, b) => ((periodEndOf(b) ?? 0) > (periodEndOf(a) ?? 0) ? b : a));
  return subs.reduce((a, b) => ((b.created ?? 0) > (a.created ?? 0) ? b : a));
}

/**
 * Relit chez Stripe les abonnements du client de `subscriptionId` (qui n'est que le déclencheur) et applique le
 * meilleur à l'entreprise. Une ligne déjà mise à jour par un événement plus récent que `eventCreated` (secondes
 * Stripe) n'est pas touchée. Renvoie null si l'entreprise est introuvable.
 */
export async function applyStripeSubscription(subscriptionId: string, eventCreated?: number): Promise<{ companyId: string; status: string } | null> {
  const trigger = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = idOf(trigger.customer);
  const companyId = await companyOf(trigger, customerId);
  if (!companyId) {
    console.warn(`[stripe] abonnement ${trigger.id} : entreprise introuvable, ignoré`);
    return null;
  }
  const others = customerId ? (await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 10 })).data : [];
  const sub = bestSubscription([trigger, ...others.filter((o) => o.id !== trigger.id)]);

  const item = sub.items?.data?.[0];
  const periodEnd = periodEndOf(sub);
  const values = {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan: planOfPrice(item?.price?.id),
    status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    anchor_day: sub.billing_cycle_anchor ? parisYmd(new Date(sub.billing_cycle_anchor * 1000)).day : null,
    ever_subscribed: isLive(sub),
    last_event_at: eventCreated ? new Date(eventCreated * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const t = company_subscriptions;
  await db.insert(t).values({ company_id: companyId, ...values }).onConflictDoUpdate({
    target: t.company_id,
    set: {
      stripe_customer_id: sql`coalesce(excluded.stripe_customer_id, ${t.stripe_customer_id})`,
      stripe_subscription_id: sql`excluded.stripe_subscription_id`,
      // Un prix inconnu (variable mal réglée) ne fait pas perdre la formule connue.
      plan: sql`coalesce(excluded.plan, ${t.plan})`,
      status: sql`excluded.status`,
      current_period_end: sql`excluded.current_period_end`,
      cancel_at_period_end: sql`excluded.cancel_at_period_end`,
      anchor_day: sql`coalesce(excluded.anchor_day, ${t.anchor_day})`,
      // « Déjà abonné » ne repasse jamais à faux.
      ever_subscribed: sql`${t.ever_subscribed} or excluded.ever_subscribed`,
      last_event_at: sql`greatest(${t.last_event_at}, excluded.last_event_at)`,
      updated_at: sql`excluded.updated_at`,
    },
    // Sans horodatage (facture, passage en caisse, retour de paiement), l'état relu est le plus frais : on l'applique.
    setWhere: eventCreated
      ? sql`${t.last_event_at} is null or ${t.last_event_at} <= excluded.last_event_at`
      : undefined,
  });
  invalidateAccess(companyId);
  return { companyId, status: sub.status };
}

/** Abonnement d'une facture : champ `parent` des versions récentes, ou ancien champ `subscription`. */
function subscriptionOfInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  return idOf(invoice.parent?.subscription_details?.subscription) ?? idOf(legacy);
}

async function mailPaymentFailed(companyId: string): Promise<void> {
  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, companyId)).limit(1);
  if (!owner?.email) return;
  const mail = subscriptionPaymentFailedEmail({ settingsUrl: `${await appOrigin()}/parametres/abonnement` });
  await sendMail({ to: owner.email, ...mail });
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription') return;
      const companyId = session.client_reference_id;
      const customerId = idOf(session.customer);
      if (companyId && customerId && /^[0-9a-f-]{36}$/i.test(companyId) && (await companyExists(companyId))) {
        await db.insert(company_subscriptions).values({ company_id: companyId, stripe_customer_id: customerId })
          .onConflictDoUpdate({
            target: company_subscriptions.company_id,
            set: { stripe_customer_id: customerId, updated_at: new Date().toISOString() },
          });
      }
      const subscriptionId = idOf(session.subscription);
      if (subscriptionId) await applyStripeSubscription(subscriptionId);
      return;
    }
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.payment_action_required': {
      const subscriptionId = subscriptionOfInvoice(event.data.object);
      if (!subscriptionId) return;
      const applied = await applyStripeSubscription(subscriptionId);
      // Seul un abonnement en relance (past_due) garde l'accès : un premier paiement raté (incomplete) n'a rien à « garder ».
      if (applied && applied.status === 'past_due' && event.type === 'invoice.payment_failed') await mailPaymentFailed(applied.companyId);
      return;
    }
    default:
      if (event.type.startsWith('customer.subscription.')) {
        await applyStripeSubscription((event.data.object as Stripe.Subscription).id, event.created);
      }
      // checkout.session.async_payment_*, charge.refunded : enregistrés seulement (recharges WeboCoins, plus tard).
  }
}

/**
 * Traite un événement du webhook une seule fois. Le traitement relit Stripe, il peut donc être rejoué sans risque :
 * l'événement n'est marqué comme traité qu'après un succès. Une erreur, un délai dépassé ou un arrêt en cours de route
 * ne laissent aucune marque, et Stripe le renvoie.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const [seen] = await db.select({ id: stripe_events.id }).from(stripe_events).where(eq(stripe_events.id, event.id)).limit(1);
  if (seen) return;
  await dispatch(event);
  await db.insert(stripe_events).values({ id: event.id, type: event.type }).onConflictDoNothing();
}
