import { describe, expect, it } from 'vitest';
import { planApply, planSummary, type CurrentLine, type IncomingLine } from './templateApply';

const cur = (id: string, name: string, qty: number, locked = false, unit: string | null = 'pièce'): CurrentLine => ({ id, name, qty, unit, locked });
const inc = (name: string, qty: number, unit: string | null = 'pièce'): IncomingLine<null> => ({ name, qty, unit, data: null });

describe('appliquer un modèle : ajouter', () => {
  it('cumule un article déjà présent, sans doublon, sans tenir compte des accents', () => {
    const plan = planApply('add', [cur('a', 'Étuve chauffante', 1), cur('b', 'Glacière', 2)], [inc('etuve chauffante', 1), inc('Chafing dish', 4)]);
    expect(plan.update.map((u) => [u.line.id, u.qty])).toEqual([['a', 2]]);
    expect(plan.add.map((a) => [a.name, a.qty])).toEqual([['Chafing dish', 4]]);
    expect(plan.remove).toEqual([]);
    expect(planSummary(plan)).toBe('1 article ajouté, 1 mis à jour');
  });

  it('ne touche pas une ligne déjà commandée : le surplus devient un complément', () => {
    const plan = planApply('add', [cur('a', 'Flûte à champagne', 75, true)], [inc('Flûte à champagne', 50)]);
    expect(plan.update).toEqual([]);
    expect(plan.add).toEqual([{ name: 'Flûte à champagne', qty: 50, unit: 'pièce', data: null, complementOf: 'Flûte à champagne' }]);
  });

  it('n’additionne pas deux unités différentes, et fusionne les doublons du modèle', () => {
    const plan = planApply('add', [cur('a', 'Sacs poubelle', 2, false, 'rouleau')], [inc('Sacs poubelle', 1, 'carton'), inc('Glacière', 1), inc('glaciere', 1), inc('Vide', 0)]);
    expect(plan.update).toEqual([]);
    expect(plan.add.map((a) => [a.name, a.qty, a.unit])).toEqual([['Sacs poubelle', 1, 'carton'], ['Glacière', 2, 'pièce']]);
  });
});

describe('appliquer un modèle : remplacer', () => {
  it('retire tout et ajoute le modèle', () => {
    const plan = planApply('replace', [cur('a', 'Glacière', 2), cur('b', 'Chafing dish', 4)], [inc('Chafing dish', 6)]);
    expect(plan.remove.map((r) => r.id)).toEqual(['a', 'b']);
    expect(plan.add.map((a) => [a.name, a.qty])).toEqual([['Chafing dish', 6]]);
    expect(planSummary(plan)).toBe('1 article ajouté, 2 retirés');
  });

  it('garde par défaut les lignes commandées, qui comptent dans la quantité du modèle', () => {
    const current = [cur('a', 'Flûte à champagne', 60, true), cur('b', 'Mange-debout', 5, true), cur('c', 'Glacière', 2)];
    const plan = planApply('replace', current, [inc('Flûte à champagne', 100), inc('Mange-debout', 3), inc('Assiette plate 27 cm', 50)]);
    expect(plan.keep.map((k) => k.id)).toEqual(['a', 'b']);
    expect(plan.remove.map((r) => r.id)).toEqual(['c']);
    expect(plan.add.map((a) => [a.name, a.qty, a.complementOf ?? null])).toEqual([['Flûte à champagne', 40, 'Flûte à champagne'], ['Assiette plate 27 cm', 50, null]]);
    expect(planSummary(plan)).toBe('2 articles ajoutés, 1 retiré, 2 gardés');
  });

  it('retire aussi les lignes commandées quand on le demande', () => {
    const plan = planApply('replace', [cur('a', 'Flûte à champagne', 60, true)], [inc('Flûte à champagne', 100)], false);
    expect(plan.keep).toEqual([]);
    expect(plan.remove.map((r) => r.id)).toEqual(['a']);
    expect(plan.add.map((a) => a.qty)).toEqual([100]);
  });
});
