import 'server-only';
import Stripe from 'stripe';

// Client Stripe du serveur. La version d'API est fixée : c'est celle que décrivent les types du paquet installé.
// Une montée de version du paquet se fait en relisant les changements de forme (échéance, abonnement d'une facture).

export type Plan = 'mensuel' | 'annuel';

let client: Stripe | null = null;

/** Client créé au premier appel : sans clé, seule l'action qui en a besoin échoue. */
export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante');
  client = new Stripe(key, { apiVersion: '2026-10-28.endive' });
  return client;
}

/** Clé de test : l'écran de paiement le signale, et l'obligation d'abonnement ne s'allume pas en production. */
export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_');
}

export function priceFor(plan: Plan): string {
  const id = plan === 'annuel' ? process.env.STRIPE_PRICE_ANNUEL : process.env.STRIPE_PRICE_MENSUEL;
  if (!id) throw new Error(`Prix Stripe de la formule ${plan} manquant`);
  return id;
}

export function planOfPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_MENSUEL) return 'mensuel';
  if (priceId === process.env.STRIPE_PRICE_ANNUEL) return 'annuel';
  return null;
}
