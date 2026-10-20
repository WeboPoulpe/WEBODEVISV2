import { describe, expect, it } from 'vitest';
import {
  cleanRunSheet, combinePlans, directionsUrl, formatQuantity, frTime, mergeTotals, normalizeTime, productionPlan, sortRunSheet, toBaseUnit,
  type ProductionRecipe,
} from './production';

describe('unités', () => {
  it('ramène poids et volumes à une unité de base', () => {
    expect(toBaseUnit(1.2, 'kg')).toEqual({ quantity: 1200, unit: 'g' });
    expect(toBaseUnit(25, 'cl')).toEqual({ quantity: 250, unit: 'ml' });
    expect(toBaseUnit(2, 'Litres')).toEqual({ quantity: 2000, unit: 'ml' });
    expect(toBaseUnit(3, 'Pièce')).toEqual({ quantity: 3, unit: 'Pièce' });
    expect(toBaseUnit(3, null)).toEqual({ quantity: 3, unit: '' });
  });

  it('affiche des quantités lisibles', () => {
    expect(formatQuantity(1500, 'g')).toBe('1,5 kg');
    expect(formatQuantity(0.25, 'kg')).toBe('250 g');
    expect(formatQuantity(0.25, 'L')).toBe('25 cl');
    expect(formatQuantity(1250, 'ml')).toBe('1,25 L');
    expect(formatQuantity(5, 'ml')).toBe('5 ml');
    expect(formatQuantity(27.5, 'pièces')).toBe('28 pièces');
    expect(formatQuantity(28.0000001, 'Unité')).toBe('28 Unité');
    expect(formatQuantity(2.345, 'botte de radis')).toBe('2,35 botte de radis');
    expect(formatQuantity(3, null)).toBe('3');
  });
});

const recipes: ProductionRecipe[] = [
  {
    id: 'p1', name: 'Tarte maison', allergens_extra: ['oeufs'], allergens_checked: true,
    ingredients: [
      { ingredient_id: 'farine', name: 'Farine de blé', qty_per_person: 0.05, unit: 'kg', allergens: null },
      { ingredient_id: 'beurre', name: 'Beurre', qty_per_person: 20, unit: 'g', allergens: ['lait'] },
    ],
  },
  {
    id: 'p2', name: 'Velouté', ingredients: [
      { ingredient_id: 'beurre', name: 'Beurre', qty_per_person: 0.01, unit: 'kg', allergens: ['lait'] },
      { ingredient_id: 'creme', name: 'Crème', qty_per_person: 5, unit: 'cl', allergens: null },
      { ingredient_id: 'oeuf', name: 'Œuf', qty_per_person: 0.5, unit: 'pièce', allergens: ['oeufs'] },
    ],
  },
  { id: 'p3', name: 'Pain', ingredients: [] },
];

describe('fiche de production', () => {
  it('calcule les quantités par plat et le récapitulatif consolidé', () => {
    const plan = productionPlan([
      { name: 'Tarte  MAISON', quantity: 30 },
      { name: 'Velouté', quantity: 0 },
      { name: 'tarte maison', quantity: 10 },
      { name: 'Location de verres', quantity: 40 },
      { name: 'Pain' },
      { name: 'Retiré', removed: true },
      { name: '', isPageBreak: true },
    ], recipes, 40);

    expect(plan.dishes.map((d) => [d.name, d.toProduce])).toEqual([['Tarte  MAISON', 40], ['Velouté', 40], ['Pain', 40]]);
    const tarte = plan.dishes[0];
    expect(tarte.ingredients).toEqual([
      { ingredient_id: 'beurre', name: 'Beurre', quantity: 800, unit: 'g' },
      { ingredient_id: 'farine', name: 'Farine de blé', quantity: 2000, unit: 'g' },
    ]);
    expect(tarte.allergens).toEqual(['gluten', 'oeufs', 'lait']);

    expect(plan.totals.map((t) => [t.name, formatQuantity(t.quantity, t.unit)])).toEqual([
      ['Beurre', '1,2 kg'],
      ['Crème', '2 L'],
      ['Farine de blé', '2 kg'],
      ['Œuf', '20 pièce'],
    ]);
    expect(plan.unmatched).toEqual(['Location de verres']);
    expect(plan.withoutRecipe).toEqual(['Pain']);
  });

  it('ne produit rien sans couverts', () => {
    const plan = productionPlan([{ name: 'Velouté' }], recipes, 0);
    expect(plan.dishes[0].ingredients).toEqual([]);
    expect(plan.totals).toEqual([]);
  });

  it('additionne plusieurs événements sans mélanger les unités', () => {
    const merged = mergeTotals([
      [{ ingredient_id: 'a', name: 'Sel', quantity: 500, unit: 'g' }],
      [{ ingredient_id: 'a', name: 'Sel', quantity: 700, unit: 'g' }, { ingredient_id: 'a', name: 'Sel', quantity: 2, unit: 'boîte' }],
    ]);
    expect(merged).toEqual([
      { ingredient_id: 'a', name: 'Sel', quantity: 1200, unit: 'g' },
      { ingredient_id: 'a', name: 'Sel', quantity: 2, unit: 'boîte' },
    ]);
  });
});

describe('feuille de route', () => {
  it('lit les heures saisies de plusieurs façons', () => {
    expect(normalizeTime('9h30')).toBe('09:30');
    expect(normalizeTime('18:05')).toBe('18:05');
    expect(normalizeTime('25:00')).toBe('');
    expect(frTime('08:30:00')).toBe('8 h 30');
  });

  it('nettoie et trie le déroulé', () => {
    expect(cleanRunSheet([
      { time: '19:00', label: 'Cocktail', note: '' },
      { time: '', label: 'Rangement', note: 'fin de soirée' },
      { time: '8h', label: 'Heure illisible', note: '' },
      { time: '17:30', label: 'Arrivée équipe', note: 'Badge' },
      { time: '18:00', label: '', note: '' },
      'texte',
      null,
    ])).toEqual([
      { time: '17:30', label: 'Arrivée équipe', note: 'Badge' },
      { time: '19:00', label: 'Cocktail', note: '' },
      { time: '', label: 'Rangement', note: 'fin de soirée' },
      { time: '', label: 'Heure illisible', note: '' },
    ]);
    expect(cleanRunSheet(null)).toEqual([]);
    expect(sortRunSheet([{ time: '10:00' }, { time: '09:00' }, { time: '10:00', x: 1 } as { time: string }])).toEqual([
      { time: '09:00' }, { time: '10:00' }, { time: '10:00', x: 1 },
    ]);
  });

  it('prépare un lien d’itinéraire', () => {
    expect(directionsUrl(' Salle des fêtes, Troyes ')).toBe('https://www.google.com/maps/dir/?api=1&destination=Salle%20des%20f%C3%AAtes%2C%20Troyes');
  });
});

describe('production du jour', () => {
  it('additionne les plats et les ingrédients de plusieurs événements', () => {
    const a = productionPlan([{ name: 'Tarte maison', quantity: 40 }], recipes, 40);
    const b = productionPlan([{ name: 'tarte maison' }, { name: 'Velouté' }], recipes, 10);
    const day = combinePlans([a, b]);
    expect(day.dishes).toEqual([
      { name: 'Tarte maison', toProduce: 50, events: 2 },
      { name: 'Velouté', toProduce: 10, events: 1 },
    ]);
    expect(day.totals.find((t) => t.name === 'Beurre')).toMatchObject({ quantity: 1100, unit: 'g' });
    expect(combinePlans([])).toEqual({ dishes: [], totals: [] });
  });
});
