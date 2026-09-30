import { describe, expect, it } from 'vitest';
import { computeIngredientNeeds, groupNeedsBySupplier, normalizeName, type PrestationRecipe } from './needs';

const recipes: PrestationRecipe[] = [
  { id: 'p-menu', name: 'Menu', ingredients: [
    { ingredient_id: 'boeuf', qty_per_person: 0.2, unit: 'kg', preferred_supplier_id: 'boucher', unit_price: 30 },
    { ingredient_id: 'sel', qty_per_person: 0.005, unit: 'kg', preferred_supplier_id: null, unit_price: 1 },
  ] },
  { id: 'p-enfant', name: 'Menu enfant', ingredients: [
    { ingredient_id: 'pates', qty_per_person: 0.1, unit: 'kg', preferred_supplier_id: 'epicier', unit_price: 2 },
  ] },
  { id: 'p-dessert', name: 'Dessert', ingredients: [
    { ingredient_id: 'sel', qty_per_person: 0.001, unit: 'kg', preferred_supplier_id: null, unit_price: 1 },
  ] },
];

describe('normalizeName', () => {
  it('ignore la casse, les espaces en trop et les accents', () => {
    expect(normalizeName('  Entrée   du  Chef ')).toBe('entree du chef');
  });
});

describe('computeIngredientNeeds', () => {
  it('multiplie la quantité par personne par le nombre de convives', () => {
    const { needs } = computeIngredientNeeds([{ name: 'Menu' }], recipes, 100);
    expect(needs).toEqual([
      { ingredient_id: 'boeuf', quantity: 20, unit: 'kg', supplier_id: 'boucher', unit_price: 30 },
      { ingredient_id: 'sel', quantity: 0.5, unit: 'kg', supplier_id: null, unit_price: 1 },
    ]);
  });

  it('fait correspondre les noms exactement : « Menu » ne prend pas « Menu enfant »', () => {
    const { needs, matched } = computeIngredientNeeds([{ name: 'Menu' }], recipes, 10);
    expect(matched).toEqual(['Menu']);
    expect(needs.map((n) => n.ingredient_id)).not.toContain('pates');
  });

  it('ignore la casse et les espaces dans le nom de la ligne du devis', () => {
    const { matched } = computeIngredientNeeds([{ name: '  menu ENFANT ' }], recipes, 10);
    expect(matched).toEqual(['Menu enfant']);
  });

  it('additionne un même ingrédient présent dans plusieurs prestations', () => {
    const { needs } = computeIngredientNeeds([{ name: 'Menu' }, { name: 'Dessert' }], recipes, 100);
    expect(needs.find((n) => n.ingredient_id === 'sel')?.quantity).toBe(0.6);
  });

  it('ne compte une prestation qu\'une fois même si elle apparaît sur plusieurs lignes', () => {
    const { needs } = computeIngredientNeeds([{ name: 'Menu' }, { name: 'Menu' }], recipes, 10);
    expect(needs.find((n) => n.ingredient_id === 'boeuf')?.quantity).toBe(2);
  });

  it('ignore les sauts de page et les lignes retirées', () => {
    const { needs } = computeIngredientNeeds(
      [{ name: 'Menu', isPageBreak: true }, { name: 'Dessert', removed: true }], recipes, 10);
    expect(needs).toEqual([]);
  });

  it('liste les lignes du devis sans prestation ou sans ingrédient', () => {
    const { unmatched, withoutIngredients } = computeIngredientNeeds(
      [{ name: 'Menu' }, { name: 'Location nappes' }, { name: 'Vide' }],
      [...recipes, { id: 'p-vide', name: 'Vide', ingredients: [] }], 10);
    expect(unmatched).toEqual(['Location nappes']);
    expect(withoutIngredients).toEqual(['Vide']);
  });

  it('arrondit au centième', () => {
    const { needs } = computeIngredientNeeds([{ name: 'Menu' }], recipes, 7);
    expect(needs.find((n) => n.ingredient_id === 'sel')?.quantity).toBe(0.04);
  });

  it('ne produit rien sans convive', () => {
    expect(computeIngredientNeeds([{ name: 'Menu' }], recipes, 0).needs).toEqual([]);
  });
});

describe('groupNeedsBySupplier', () => {
  it('regroupe par fournisseur, calcule le total et isole les lignes sans fournisseur', () => {
    const { needs } = computeIngredientNeeds([{ name: 'Menu' }, { name: 'Menu enfant' }], recipes, 100);
    const { orders, withoutSupplier } = groupNeedsBySupplier(needs);
    expect(orders).toEqual([
      { supplier_id: 'boucher', total: 600, items: [{ ingredient_id: 'boeuf', quantity: 20, unit_price: 30 }] },
      { supplier_id: 'epicier', total: 20, items: [{ ingredient_id: 'pates', quantity: 10, unit_price: 2 }] },
    ]);
    expect(withoutSupplier).toEqual(['sel']);
  });
});
