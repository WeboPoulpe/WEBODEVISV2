import { describe, expect, it } from 'vitest';
import { MAX_FAVORITES, parseFavorites, toggleFavorite } from './favorites';

describe('favoris gardés dans le navigateur', () => {
  it('lit une liste propre, quoi qu’il y ait dans le stockage', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('pas du json')).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["a-troyes", 3, "<x>", "a-troyes", "b-paris"]')).toEqual(['a-troyes', 'b-paris']);
    expect(parseFavorites(JSON.stringify(Array.from({ length: 50 }, (_, i) => `f-${i}`)))).toHaveLength(MAX_FAVORITES);
  });

  it('ajoute en tête, retire, et garde 30 fiches au plus', () => {
    expect(toggleFavorite(['a'], 'b')).toEqual(['b', 'a']);
    expect(toggleFavorite(['b', 'a'], 'b')).toEqual(['a']);
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `f-${i}`);
    const next = toggleFavorite(full, 'nouveau');
    expect(next).toHaveLength(MAX_FAVORITES);
    expect(next[0]).toBe('nouveau');
  });
});
