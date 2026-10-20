import { describe, expect, it } from 'vitest';
import { defaultRecipeUnit, margin, normalizeUnit, quoteCost, recipeCost, recipeUnits, staffCost, sumMargins, toPurchaseUnit, unitFactor } from './costing';

describe('unités', () => {
  it('regroupe les écritures d’une même unité', () => {
    expect(normalizeUnit(' Kilo ')).toBe('kg');
    expect(normalizeUnit('Unité')).toBe('unite');
    expect(normalizeUnit('pièce')).toBe('unite');
    expect(normalizeUnit('L')).toBe('l');
  });

  it('convertit seulement g ↔ kg et ml ↔ cl ↔ L', () => {
    expect(unitFactor('g', 'kg')).toBe(0.001);
    expect(unitFactor('kg', 'g')).toBe(1000);
    expect(unitFactor('cl', 'L')).toBe(0.01);
    expect(unitFactor('ml', 'cl')).toBe(0.1);
    expect(unitFactor('Unité', 'pièce')).toBe(1);
    expect(unitFactor(null, 'kg')).toBe(1);
    expect(unitFactor('g', 'L')).toBeNull();
    expect(unitFactor('tranche', 'kg')).toBeNull();
    expect(unitFactor('Botte', 'Unité')).toBeNull();
  });
});

describe('coût matière d’une prestation', () => {
  it('additionne les ingrédients, en convertissant les unités simples', () => {
    const r = recipeCost([
      { name: 'Saumon', qtyPerPerson: 150, unit: 'g', ingredientUnit: 'kg', unitPrice: 24 },
      { name: 'Crème', qtyPerPerson: '5', unit: 'cl', ingredientUnit: 'L', unitPrice: '4' },
      { name: 'Citron', qtyPerPerson: 0.25, unit: null, ingredientUnit: 'Unité', unitPrice: 0.4 },
    ]);
    expect(r.total).toBe(3.9); // 3,60 + 0,20 + 0,10
    expect(r.complete).toBe(true);
    expect(r.lines.map((l) => l.cost)).toEqual([3.6, 0.2, 0.1]);
  });

  it('laisse hors du total les ingrédients sans prix et ceux d’unité non comparable', () => {
    const r = recipeCost([
      { name: 'Saumon', qtyPerPerson: 100, unit: 'g', ingredientUnit: 'kg', unitPrice: 20 },
      { name: 'Aneth', qtyPerPerson: 1, unit: 'Botte', ingredientUnit: 'Botte', unitPrice: 0 },
      { name: 'Pain', qtyPerPerson: 2, unit: 'tranche', ingredientUnit: 'kg', unitPrice: 5 },
    ]);
    expect(r.total).toBe(2);
    expect(r.missingPrice).toEqual(['Aneth']);
    expect(r.incomparable).toEqual(['Pain']);
    expect(r.complete).toBe(false);
    expect(r.lines.map((l) => l.status)).toEqual(['ok', 'sans_prix', 'non_comparable']);
  });

  it('recette vide : coût nul', () => {
    expect(recipeCost([])).toMatchObject({ total: 0, complete: true });
  });
});

describe('marge', () => {
  it('donne le montant, le taux et le coefficient', () => {
    expect(margin(20, 6)).toEqual({ amount: 14, rate: 70, coefficient: 3.33 });
  });
  it('sans coût ni prix', () => {
    expect(margin(20, 0)).toEqual({ amount: 20, rate: 100, coefficient: null });
    expect(margin(0, 5)).toEqual({ amount: -5, rate: null, coefficient: 0 });
  });
});

describe('marge d’un devis', () => {
  const catalog = new Map([['menu mariage', 12], ['champagne', 0]]);
  const services = [
    { name: 'Menu mariage', quantity: 50, unitPrice: 45 },
    { name: ' Champagne ', quantity: 20, unitPrice: 30, costPrice: 9 },
    { name: 'Café', quantity: 50, unitPrice: 2, isFree: true },
    { name: 'Vin', quantity: 10, unitPrice: 20, isOption: true },
    { name: 'Ancien', quantity: 1, unitPrice: 100, removed: true },
    { isPageBreak: true },
  ];

  it('coût du catalogue, sinon de la ligne ; frais annexes et personnel en plus', () => {
    const q = quoteCost({ services, catalog, extraCosts: [{ amount: 150 }, { amount: '50' }], staffCost: 300 });
    expect(q.revenueHT).toBe(2850);
    expect(q.materialCost).toBe(780); // 50 × 12 + 20 × 9
    expect(q.extraCost).toBe(200);
    expect(q.staffCost).toBe(300);
    expect(q.totalCost).toBe(1280);
    expect(q.margin.amount).toBe(1570);
    expect(q.lines.map((l) => l.source)).toEqual(['catalogue', 'ligne', null]);
  });

  it('les options comptent sur demande', () => {
    expect(quoteCost({ services, catalog, includeOptions: true }).revenueHT).toBe(3050);
  });

  it('un devis sans aucun coût est signalé', () => {
    expect(quoteCost({ services: [{ name: 'X', quantity: 1, unitPrice: 10 }], catalog: new Map() }).hasCost).toBe(false);
  });
});

describe('personnel et totaux', () => {
  it('heures × taux de la mission, sinon taux de l’extra', () => {
    expect(staffCost([
      { hours_worked: 8, hourly_rate: 15 },
      { hours_worked: '6.5', hourly_rate: null, extra_rate: '14' },
      { hours_worked: null, hourly_rate: 20 },
      { hours_worked: 5, hourly_rate: 20, status: 'refuse' },
    ])).toBe(211);
  });

  it('les devis sans coût sont comptés à part', () => {
    const t = sumMargins([
      { revenueHT: 1000, totalCost: 400, hasCost: true },
      { revenueHT: 500, totalCost: 0, hasCost: false },
    ]);
    expect(t).toEqual({ revenueHT: 1000, cost: 400, margin: 600, rate: 60, costed: 1, uncosted: 1 });
  });
});

describe('quantité par personne', () => {
  it('propose les unités qui se convertissent vers l’unité d’achat', () => {
    expect(recipeUnits('kg')).toEqual(['g', 'kg']);
    expect(recipeUnits('Litre')).toEqual(['ml', 'cl', 'dl', 'L']);
    expect(recipeUnits('Botte')).toEqual(['Botte']);
    expect(recipeUnits(null)).toContain('pièce');
    expect(defaultRecipeUnit('kg')).toBe('g');
    expect(defaultRecipeUnit('L')).toBe('cl');
    expect(defaultRecipeUnit('Botte')).toBe('Botte');
  });

  it('ramène la quantité à l’unité d’achat pour les courses', () => {
    expect(toPurchaseUnit(150, 'g', 'kg')).toEqual({ qty_per_person: 0.15, unit: 'kg' });
    expect(toPurchaseUnit(1, 'kg', 'kg')).toEqual({ qty_per_person: 1, unit: 'kg' });
    expect(toPurchaseUnit(2, null, 'Botte')).toEqual({ qty_per_person: 2, unit: 'Botte' });
    expect(toPurchaseUnit(3, 'tranche', 'kg')).toEqual({ qty_per_person: 3, unit: 'tranche' });
  });
});
