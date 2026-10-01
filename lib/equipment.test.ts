import { describe, expect, it } from 'vitest';
import { formatPerGuest, perGuestFromRatio, quantityFor, ratioFromPerGuest } from './equipment';

describe('quantité par couvert dite en ratio', () => {
  it('retrouve le ratio le plus simple', () => {
    expect(ratioFromPerGuest(0.125)).toEqual({ count: 1, per: 8 });
    expect(ratioFromPerGuest(0.1)).toEqual({ count: 1, per: 10 });
    expect(ratioFromPerGuest(1.5)).toEqual({ count: 3, per: 2 });
    expect(ratioFromPerGuest(2)).toEqual({ count: 2, per: 1 });
    expect(ratioFromPerGuest(0.2)).toEqual({ count: 1, per: 5 });
    expect(ratioFromPerGuest(perGuestFromRatio(1, 12))).toEqual({ count: 1, per: 12 });
  });
  it('s’écrit comme on le dit', () => {
    expect(formatPerGuest(0.125, 'pièce')).toBe('1 pièce pour 8 couverts');
    expect(formatPerGuest(1, 'pièce')).toBe('1 pièce par couvert');
    expect(formatPerGuest(1.5, 'pièce')).toBe('3 pièces pour 2 couverts');
    expect(formatPerGuest(0.1, 'jeu')).toBe('1 jeu pour 10 couverts');
  });
  it('arrondit à l’unité supérieure pour un nombre de couverts', () => {
    expect(quantityFor(perGuestFromRatio(1, 8), 100)).toBe(13);
    expect(quantityFor(perGuestFromRatio(1, 8), 80)).toBe(10);
    expect(quantityFor(0.1, 100)).toBe(10);
  });
});
