import { describe, expect, it } from 'vitest';
import { ALLERGENS, allergenSheet, ingredientAllergens, prestationAllergens, sortAllergens, suggestAllergens } from './allergens';

describe('les 14 allergènes', () => {
  it('sont tous là, une seule fois', () => {
    expect(ALLERGENS).toHaveLength(14);
    expect(new Set(ALLERGENS.map((a) => a.key)).size).toBe(14);
  });

  it('se rangent dans l’ordre réglementaire, sans doublon ni clé inconnue', () => {
    expect(sortAllergens(['lait', 'gluten', 'lait', 'inconnu'])).toEqual(['gluten', 'lait']);
  });
});

describe('suggestions d’après le nom', () => {
  const cases: [string, string[]][] = [
    ['Beurre doux', ['lait']],
    ['Crème fraîche épaisse', ['lait']],
    ['Farine de blé T55', ['gluten']],
    ['Farine de riz', []],
    ['Lait de coco', []],
    ['Lait entier', ['lait']],
    ['Œufs frais', ['oeufs']],
    ['Noix de Saint-Jacques', ['mollusques']],
    ['Noix de coco râpée', []],
    ['Cerneaux de noix', ['fruits_coque']],
    ['Beurre de cacahuète', ['arachides']],
    ['Saumon fumé', ['poissons']],
    ['Crevettes roses', ['crustaces']],
    ['Moutarde à l’ancienne', ['moutarde']],
    ['Vin blanc sec', ['sulfites']],
    ['Graines de sésame', ['sesame']],
    ['Sauce soja', ['soja']],
    ['Pâte feuilletée pur beurre', ['gluten', 'lait']],
    ['Tomates cerises', []],
    ['Barbecue', []],
    ['Vinaigre balsamique', []],
  ];
  it.each(cases)('%s', (name, expected) => {
    expect(suggestAllergens(name)).toEqual(expected);
  });
});

describe('allergènes d’un ingrédient et d’une prestation', () => {
  it('préfère les cases cochées, même vides, aux suggestions', () => {
    expect(ingredientAllergens({ name: 'Beurre', allergens: null })).toEqual({ keys: ['lait'], suggested: true });
    expect(ingredientAllergens({ name: 'Beurre', allergens: [] })).toEqual({ keys: [], suggested: false });
  });

  it('réunit la recette et les ajouts, avec leur origine', () => {
    const r = prestationAllergens({
      name: 'Tarte aux noix',
      allergens_extra: ['oeufs'],
      allergens_checked: true,
      ingredients: [{ name: 'Farine de blé', allergens: null }, { name: 'Beurre', allergens: ['lait'] }, { name: 'Noix', allergens: ['fruits_coque'] }],
    });
    expect(r.keys).toEqual(['gluten', 'oeufs', 'lait', 'fruits_coque']);
    expect(r.sources.oeufs).toEqual(['ajouté à la main']);
    expect(r.sources.gluten).toEqual(['Farine de blé']);
    expect(r).toMatchObject({ checked: true, hasSuggestions: true });
  });
});

describe('fiche allergènes d’un devis', () => {
  it('rapproche les lignes du catalogue, sans doublon, et met de côté le reste', () => {
    const { rows, unmatched } = allergenSheet(
      [{ name: 'Tarte aux noix' }, { name: 'tarte aux NOIX' }, { name: 'Location de vaisselle' }, { name: 'Retiré', removed: true }, { name: '', isPageBreak: true }],
      [{ name: 'Tarte aux noix', allergens_checked: true, ingredients: [{ name: 'Noix', allergens: ['fruits_coque'] }] }],
    );
    expect(rows).toEqual([{ dish: 'Tarte aux noix', keys: ['fruits_coque'], checked: true, hasSuggestions: false }]);
    expect(unmatched).toEqual(['Location de vaisselle']);
  });
});
