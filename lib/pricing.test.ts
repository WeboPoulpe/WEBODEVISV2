import { describe, expect, it } from 'vitest';
import * as pricing from './pricing';

const { euros } = pricing;

describe('offre WeboDevis', () => {
  it('garde les montants', () => {
    expect([pricing.MONTHLY_HT, pricing.FIRST_MONTH_HT, pricing.SETUP_HT]).toEqual([100, 1250, 1150]);
    expect(pricing.FIRST_YEAR_HT).toBe(2350);
    expect(pricing.NEXT_YEAR_HT).toBe(1200);
  });

  it('décrit la mise en service de la nouvelle offre', () => {
    expect(pricing.SETUP_INCLUDES).toEqual([
      '3 séances de formation de 2 h',
      'Vos infos d’entreprise et votre première facture, préparées avec vous',
      '6 modèles de devis : mariage, entreprise, à emporter',
      'Vos prestations essentielles, déjà créées',
    ]);
    expect(pricing.MONTHLY_INCLUDES).toHaveLength(4);
    expect(pricing.EXTRAS).toHaveLength(2);
  });

  it('ne promet plus l’import des clients ni l’annuel', () => {
    const all = JSON.stringify([pricing.SETUP_INCLUDES, pricing.MONTHLY_INCLUDES, pricing.PRICE_LINE, pricing.SETUP_SUMMARY, pricing.subscribeSummary(true)]);
    expect(all).not.toMatch(/import|annuel|offert|1.150/i);
    expect(pricing).not.toHaveProperty('YEARLY_HT');
    expect(pricing).not.toHaveProperty('YEARLY_BONUS');
  });

  it('dit le prix d’une seule façon', () => {
    expect(pricing.PRICE_LINE).toBe(`${euros(1250)} HT le premier mois, mise en service comprise, puis ${euros(100)} HT par mois, sans engagement`);
  });

  it('affiche le montant d’un abonnement existant, annuel compris', () => {
    expect(pricing.planAmount('mensuel')).toBe(`${euros(100)} HT / mois (${euros(120)} TTC)`);
    expect(pricing.planAmount('annuel')).toBe(`${euros(1100)} HT / an (${euros(1320)} TTC)`);
  });

  it('n’annonce la mise en service qu’au premier abonnement', () => {
    expect(pricing.subscribeSummary(true)).toContain(`${euros(1250)} HT`);
    expect(pricing.subscribeSummary(false)).not.toMatch(/1.250/);
    expect(pricing.subscribeSummary(false)).toContain(`${euros(100)} HT`);
    // Sans mise en service due, on ne dit pas pour autant qu'elle est payée : un premier paiement resté
    // inachevé rouvre la facture d'origine, mise en service comprise.
    expect(pricing.subscribeSummary(false)).not.toMatch(/déjà|repay/i);
  });
});
