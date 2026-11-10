'use server';

// Actions d'abonnement du titulaire : s'abonner, passer en annuel, annuler, reprendre, portail de facturation.
// Elles n'utilisent pas requireWriter : elles doivent marcher justement quand l'abonnement n'est pas actif.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { company_subscriptions, profiles } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { appOrigin } from '@/lib/mail';
import { priceFor, stripe, type Plan } from '@/lib/stripe';
import { requireUser } from './session';
import { applyStripeSubscription } from './stripeSync';
import { getSubscription, invalidateAccess, type SubscriptionRow } from './subscription';

export interface BillingResult { error: string | null; url?: string }

const NOT_OWNER = 'Seul le titulaire du compte peut gérer l’abonnement.';
const ACTING_AS_ADMIN = 'Vous êtes dans le compte d’un client : seul son titulaire peut gérer l’abonnement.';
const NO_SUBSCRIPTION = 'Aucun abonnement à modifier.';

type LiveSubscription = SubscriptionRow & { stripe_subscription_id: string };

const isLive = (s: SubscriptionRow | null) => s?.status === 'active' || s?.status === 'past_due';
const failure = (e: unknown, message: string): BillingResult => {
  console.error(`[abonnement] ${message}`, e);
  return { error: `${message} Réessayez dans un instant.` };
};

/** Le titulaire connecté (ni démo, ni collaborateur, ni administrateur entré chez un client) et son entreprise. */
async function owner(): Promise<{ companyId: string; email: string | null } | { error: string }> {
  const user = await requireUser();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  if (user.actingAsAdmin) return { error: ACTING_AS_ADMIN };
  const [profile] = await db.select({ parent: profiles.parent_user_id }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (profile?.parent) return { error: NOT_OWNER };
  return { companyId: user.id, email: user.email ?? null };
}

/** Client Stripe de l'entreprise, créé au premier besoin et retenu tout de suite pour que le deuxième appel le retrouve. */
async function customerOf(companyId: string, email: string | null, existing: string | null): Promise<string> {
  if (existing) return existing;
  const [profile] = await db.select({ name: profiles.company_name }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
  // Clé d'idempotence : un double clic ne crée pas deux clients.
  const customer = await stripe().customers.create(
    { email: email ?? undefined, name: profile?.name || undefined, metadata: { company_id: companyId } },
    { idempotencyKey: `customer-${companyId}` },
  );
  await db.insert(company_subscriptions).values({ company_id: companyId, stripe_customer_id: customer.id })
    .onConflictDoUpdate({ target: company_subscriptions.company_id, set: { stripe_customer_id: customer.id, updated_at: new Date().toISOString() } });
  invalidateAccess(companyId);
  return customer.id;
}

export async function startCheckout(plan: Plan): Promise<BillingResult> {
  const who = await owner();
  if ('error' in who) return { error: who.error };
  if (plan !== 'mensuel' && plan !== 'annuel') return { error: 'Formule inconnue.' };
  try {
    const sub = await getSubscription(who.companyId);
    if (isLive(sub)) return { error: null, url: '/parametres/abonnement' };
    // Un abonnement non terminé existe déjà : pas de nouvelle session (sinon doublon).
    if (sub?.stripe_subscription_id && sub.status === 'incomplete') {
      // Premier paiement à finir : page de paiement hébergée de sa dernière facture, à défaut une nouvelle session.
      const open = await stripe().subscriptions.retrieve(sub.stripe_subscription_id, { expand: ['latest_invoice'] });
      const invoice = open.latest_invoice;
      const hosted = invoice && typeof invoice !== 'string' ? invoice.hosted_invoice_url : null;
      if (hosted) return { error: null, url: hosted };
    } else if (sub?.stripe_customer_id && (sub.status === 'unpaid' || sub.status === 'paused')) {
      return openBillingPortal();
    }
    const customer = await customerOf(who.companyId, who.email, sub?.stripe_customer_id ?? null);
    const origin = await appOrigin();
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: who.companyId,
      line_items: [{ price: priceFor(plan), quantity: 1 }],
      subscription_data: { metadata: { company_id: who.companyId } },
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      success_url: `${origin}/?abonnement=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/abonnement`,
    });
    if (!session.url) return failure(new Error('session sans adresse'), 'Le paiement n’a pas pu être ouvert.');
    return { error: null, url: session.url };
  } catch (e) {
    return failure(e, 'Le paiement n’a pas pu être ouvert.');
  }
}

/** Au retour du paiement : relit la session chez Stripe pour ouvrir l'accès sans attendre le webhook. */
export async function syncCheckoutSession(sessionId: string): Promise<BillingResult> {
  const who = await owner();
  if ('error' in who) return { error: who.error };
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== who.companyId) return { error: 'Cette session de paiement ne concerne pas votre compte.' };
    if (session.status !== 'complete' && session.payment_status !== 'paid') return { error: null };
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (subscriptionId) await applyStripeSubscription(subscriptionId);
    return { error: null };
  } catch (e) {
    return failure(e, 'Le paiement n’a pas pu être vérifié.');
  }
}

/** Abonnement en cours (actif ou en relance) de l'entreprise, s'il y en a un. */
async function current(companyId: string): Promise<LiveSubscription | null> {
  const sub = await getSubscription(companyId);
  return sub?.stripe_subscription_id && isLive(sub) ? (sub as LiveSubscription) : null;
}

export async function switchToAnnual(): Promise<BillingResult> {
  const who = await owner();
  if ('error' in who) return { error: who.error };
  try {
    const sub = await current(who.companyId);
    if (!sub) return { error: NO_SUBSCRIPTION };
    if (sub.plan === 'annuel') return { error: 'Vous êtes déjà sur la formule annuelle.' };
    const stripeSub = await stripe().subscriptions.retrieve(sub.stripe_subscription_id);
    const item = stripeSub.items.data[0];
    if (!item) return { error: NO_SUBSCRIPTION };
    await stripe().subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: item.id, price: priceFor('annuel') }],
      proration_behavior: 'create_prorations',
    });
    await applyStripeSubscription(sub.stripe_subscription_id);
    return { error: null };
  } catch (e) {
    return failure(e, 'Le changement de formule a échoué.');
  }
}

async function setCancelAtPeriodEnd(value: boolean): Promise<BillingResult> {
  const who = await owner();
  if ('error' in who) return { error: who.error };
  try {
    const sub = await current(who.companyId);
    if (!sub) return { error: NO_SUBSCRIPTION };
    await stripe().subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: value });
    await applyStripeSubscription(sub.stripe_subscription_id);
    return { error: null };
  } catch (e) {
    return failure(e, value ? 'L’annulation a échoué.' : 'La reprise de l’abonnement a échoué.');
  }
}

export async function cancelSubscription(): Promise<BillingResult> {
  return setCancelAtPeriodEnd(true);
}

export async function resumeSubscription(): Promise<BillingResult> {
  return setCancelAtPeriodEnd(false);
}

export async function openBillingPortal(): Promise<BillingResult> {
  const who = await owner();
  if ('error' in who) return { error: who.error };
  try {
    const sub = await getSubscription(who.companyId);
    if (!sub?.stripe_customer_id) return { error: 'Aucun abonnement : rien à gérer pour le moment.' };
    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${await appOrigin()}/parametres/abonnement`,
    });
    return { error: null, url: session.url };
  } catch (e) {
    return failure(e, 'Le portail de facturation n’a pas pu être ouvert.');
  }
}
