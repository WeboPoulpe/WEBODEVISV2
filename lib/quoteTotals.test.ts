import { describe, expect, it } from 'vitest';
import { quoteTotalTTC, quoteVatBreakdown } from './quoteTotals';

describe('quoteVatBreakdown', () => {
  it('sans taux par ligne : même résultat qu’avec le seul taux du devis', () => {
    const lines = [{ quantity: 80, unitPrice: 45 }, { quantity: 1, unitPrice: 150 }];
    const r = quoteVatBreakdown(lines, 10);
    expect(r.ht).toBe(3750);
    expect(r.vat).toBe(375);
    expect(r.ttc).toBe(4125);
    expect(r.byRate).toEqual([{ rate: 10, base: 3750, vat: 375 }]);
    // Identique à l'ancien calcul (HT × (1 + taux)) du total des devis
    expect(quoteTotalTTC({ total_amount: null, vat_rate: 10, guest_count: 80, services: lines })).toBe(3750 * 1.1);
  });

  it('mélange 10 % et 20 % : une ventilation par taux, du plus élevé au plus bas', () => {
    const r = quoteVatBreakdown([
      { quantity: 100, unitPrice: 40 },               // repas → taux du devis (10 %)
      { quantity: 30, unitPrice: 25, vatRate: 20 },   // vin
      { quantity: 1, unitPrice: 500, vatRate: 20 },   // location de matériel
      { quantity: 10, unitPrice: 8, vatRate: 5.5 },   // vente à emporter
    ], 10);
    expect(r.byRate).toEqual([
      { rate: 20, base: 1250, vat: 250 },
      { rate: 10, base: 4000, vat: 400 },
      { rate: 5.5, base: 80, vat: 4.4 },
    ]);
    expect(r.ht).toBe(5330);
    expect(r.vat).toBe(654.4);
    expect(r.ttc).toBe(5984.4);
  });

  it('arrondit la TVA de chaque taux au centime', () => {
    const r = quoteVatBreakdown([{ quantity: 3, unitPrice: 3.33, vatRate: 5.5 }], 20);
    expect(r.byRate[0].vat).toBe(0.55); // 9,99 × 5,5 % = 0,54945
  });

  it('exclut les options, sauf pour le total avec options', () => {
    const lines = [{ quantity: 1, unitPrice: 100 }, { quantity: 1, unitPrice: 50, isOption: true, vatRate: 20 }];
    expect(quoteVatBreakdown(lines, 10).byRate).toEqual([{ rate: 10, base: 100, vat: 10 }]);
    const avec = quoteVatBreakdown(lines, 10, 0, 0, { includeOptions: true });
    expect(avec.ht).toBe(150);
    expect(avec.ttc).toBe(170);
  });

  it('exclut les lignes offertes, retirées et les sauts de page', () => {
    const r = quoteVatBreakdown([
      { quantity: 1, unitPrice: 100 },
      { quantity: 1, unitPrice: 999, isFree: true, vatRate: 20 },
      { quantity: 1, unitPrice: 999, removed: true },
      { quantity: 1, unitPrice: 999, isPageBreak: true },
      null,
    ], 10);
    expect(r.byRate).toEqual([{ rate: 10, base: 100, vat: 10 }]);
  });

  it('applique le prix enfant au couvert', () => {
    const r = quoteVatBreakdown([{ quantity: 60, unitPrice: 50, childUnitPrice: 20 }], 10, 50, 10);
    expect(r.ht).toBe(2700);
    expect(r.vat).toBe(270);
  });
});
