// Tarifs de WeboDevis, en euros HT. Seule source des montants : site public, écran Abonnement et paiement Stripe.
// L'abonnement lui-même est un prix Stripe (STRIPE_PRICE_MENSUEL) : un changement de MONTHLY_HT se fait ici ET dans
// Stripe. La mise en service, elle, est envoyée par le code au paiement. L'abonnement annuel n'est plus vendu : seuls
// les comptes qui l'ont déjà le gardent (STRIPE_PRICE_ANNUEL sert encore à les reconnaître).

export const MONTHLY_HT = 100;
/** Ancienne formule annuelle : pour afficher le montant des abonnements qui l'ont encore. */
const LEGACY_YEARLY_HT = 1100;
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

/** Première année : le premier mois avec la mise en service, puis onze mois d'abonnement. */
export const FIRST_YEAR_HT = FIRST_MONTH_HT + 11 * MONTHLY_HT;
/** Les années suivantes. */
export const NEXT_YEAR_HT = 12 * MONTHLY_HT;

/** Ce que comprend la mise en service. */
export const SETUP_INCLUDES = [
  '3 séances de formation de 2 h',
  'Vos infos d’entreprise et votre première facture, préparées avec vous',
  '6 modèles de devis : mariage, entreprise, à emporter',
  'Vos prestations essentielles, déjà créées',
];

/** Ce que comprend l'abonnement, chaque mois. */
export const MONTHLY_INCLUDES = [
  'Tout le logiciel, sur PC et smartphone',
  'Webo, l’assistant, avec 200 WeboCoins par mois',
  'SAV et mises à jour',
  'Vos données exportables à tout moment',
];

/** En option, sur devis. */
export const EXTRAS = [
  'La reprise de vos clients et de vos devis déjà signés',
  'La création de vos brochures par notre équipe',
];

/** Le prix, dit de la même façon partout. */
export const PRICE_LINE = `${euros(FIRST_MONTH_HT)} HT le premier mois, mise en service comprise, puis ${euros(MONTHLY_HT)} HT par mois, sans engagement`;

/** La mise en service en quelques mots : ligne de la facture Stripe et écran Abonnement. */
export const SETUP_SUMMARY = 'Formation, modèles de devis et prestations essentielles';

/** Montant d'un abonnement en cours, pour la page Abonnement : « 100 € HT / mois (120 € TTC) ». */
export function planAmount(plan: 'mensuel' | 'annuel'): string {
  return plan === 'annuel'
    ? `${euros(LEGACY_YEARLY_HT)} HT / an (${euros(ttc(LEGACY_YEARLY_HT))} TTC)`
    : `${euros(MONTHLY_HT)} HT / mois (${euros(ttc(MONTHLY_HT))} TTC)`;
}

/** Ce que l'on paie en s'abonnant. La mise en service ne se paie qu'au premier abonnement. */
export function subscribeSummary(setupDue: boolean): string {
  return setupDue
    ? `Premier mois : ${euros(FIRST_MONTH_HT)} HT, mise en service comprise (${SETUP_SUMMARY.toLowerCase()}). Ensuite ${euros(MONTHLY_HT)} HT par mois, sans engagement.`
    : `${euros(MONTHLY_HT)} HT par mois, sans engagement.`;
}
