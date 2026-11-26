import { describe, expect, it } from 'vitest';
import { descendants, flattenSet, wouldCycle, type KitLink } from './materialKits';
import { mergeIncoming } from './templateApply';

const items = [
  { set_id: 'cafe', name: 'Percolateur', qty: 1 },
  { set_id: 'cafe', name: 'Tasse', qty: 50 },
  { set_id: 'vaisselle', name: 'Tasse', qty: 20 },
  { set_id: 'vaisselle', name: 'Assiette', qty: 60 },
  { set_id: 'brunch', name: 'Nappe', qty: 8 },
];
const links: KitLink[] = [
  { parent_id: 'brunch', child_id: 'cafe', sort_order: 0 },
  { parent_id: 'brunch', child_id: 'vaisselle', sort_order: 1 },
  { parent_id: 'mariage', child_id: 'brunch', sort_order: 0 },
];

describe('flattenSet', () => {
  it('donne les articles du modèle puis ceux de ses kits', () => {
    expect(flattenSet('brunch', items, links).map((i) => i.name)).toEqual(['Nappe', 'Percolateur', 'Tasse', 'Tasse', 'Assiette']);
  });

  it('descend sur plusieurs niveaux', () => {
    expect(flattenSet('mariage', items, links)).toHaveLength(5);
  });

  it('un kit seul ne donne que ses articles', () => {
    expect(flattenSet('cafe', items, links).map((i) => i.name)).toEqual(['Percolateur', 'Tasse']);
  });

  it('les doublons s’additionnent une fois fusionnés', () => {
    const lines = flattenSet('brunch', items, links).map((i) => ({ name: i.name, qty: i.qty, unit: 'pièce', data: null }));
    expect(mergeIncoming(lines).find((l) => l.name === 'Tasse')?.qty).toBe(70);
  });

  it('ne tourne pas en rond sur une boucle', () => {
    const loop: KitLink[] = [...links, { parent_id: 'cafe', child_id: 'brunch' }];
    expect(flattenSet('brunch', items, loop).map((i) => i.name)).toEqual(['Nappe', 'Percolateur', 'Tasse', 'Tasse', 'Assiette']);
  });
});

describe('wouldCycle', () => {
  it('refuse un modèle dans lui-même', () => expect(wouldCycle('cafe', 'cafe', links)).toBe(true));
  it('refuse d’inclure un parent, même indirect', () => {
    expect(wouldCycle('cafe', 'brunch', links)).toBe(true);
    expect(wouldCycle('cafe', 'mariage', links)).toBe(true);
  });
  it('accepte un kit partagé par plusieurs modèles', () => expect(wouldCycle('mariage', 'cafe', links)).toBe(false));
  it('descendants liste tous les niveaux', () => expect([...descendants('mariage', links)].sort()).toEqual(['brunch', 'cafe', 'vaisselle']));
});
