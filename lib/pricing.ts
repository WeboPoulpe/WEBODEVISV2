// Tarifs de WeboDevis, en euros HT. Seule source des montants : site public, écran Abonnement et paiement Stripe.
// Les abonnements eux-mêmes sont des prix Stripe (STRIPE_PRICE_MENSUEL / STRIPE_PRICE_ANNUEL) : un changement de
// MONTHLY_HT ou YEARLY_HT se fait ici ET dans Stripe. La mise en service, elle, est envoyée par le code au paiement.

export const MONTHLY_HT = 100;
export const YEARLY_HT = 1100;
/** Premier mois du mensuel, mise en service comprise. */
export const FIRST_MONTH_HT = 1250;
/** Mise en service seule, payée une fois au premier abonnement : premier mois (1 250 €) moins un mois d'abonnement. */
export const SETUP_HT = FIRST_MONTH_HT - MONTHLY_HT;
export const VAT_RATE = 0.2;

/** « 1 250 € » : espace insécable des milliers, comme partout sur le site. */
export function euros(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\s/g, ' ')} €`;
}

export const ttc = (ht: number) => Math.round(ht * (1 + VAT_RATE) * 100) / 100;

/** Ce que comprend la mise en service. */
export const SETUP_INCLUDES = [
  'Une formation à la prise en main',
  'Deux modèles de devis de mariage',
  'Deux modèles de devis traiteur, cocktail ou à emporter',
  'La création des prestations qui vont avec',
  'L’import de vos clients',
];

/** En plus, pour l'abonnement annuel. */
export const YEARLY_BONUS = ['Un mois offert', 'Une heure de formation offerte', 'Un SAV prioritaire'];
