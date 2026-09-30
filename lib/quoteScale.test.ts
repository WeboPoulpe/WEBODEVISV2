import { describe, expect, it } from 'vitest';
import { guessGuestCount, scaleToGuests } from './quoteScale';

describe('guessGuestCount', () => {
  it('retient la quantité la plus fréquente au-dessus de 1', () => {
    expect(guessGuestCount([{ quantity: 80 }, { quantity: 80 }, { quantity: 1 }, { quantity: 12 }])).toBe(80);
  });
  it('accepte une seule ligne chiffrée', () => {
    expect(guessGuestCount([{ quantity: 50 }, { quantity: 1 }])).toBe(50);
  });
  it('ne devine rien quand les quantités sont toutes différentes', () => {
    expect(guessGuestCount([{ quantity: 50 }, { quantity: 12 }, { quantity: 1 }])).toBeNull();
  });
  it('ignore les sauts de page et les quantités non entières', () => {
    expect(guessGuestCount([{ quantity: 0, isPageBreak: true }, { quantity: 2.5 }, { quantity: 1 }])).toBeNull();
  });
});

describe('scaleToGuests', () => {
  const lines = [
    { name: 'Menu', quantity: 80 },
    { name: 'Vin', quantity: 80 },
    { name: 'Forfait livraison', quantity: 1 },
    { name: 'Serveurs', quantity: 4 },
  ];
  it('adapte les lignes au nombre de couverts connu', () => {
    expect(scaleToGuests(lines, 120, 80).map((l) => l.quantity)).toEqual([120, 120, 1, 4]);
  });
  it('devine le nombre d’origine quand il manque', () => {
    expect(scaleToGuests(lines, 45).map((l) => l.quantity)).toEqual([45, 45, 1, 4]);
  });
  it('ne change rien si le nombre est le même ou inconnu', () => {
    expect(scaleToGuests(lines, 80, 80)).toBe(lines);
    expect(scaleToGuests([{ quantity: 3 }, { quantity: 7 }, { quantity: 1 }], 60)).toEqual([{ quantity: 3 }, { quantity: 7 }, { quantity: 1 }]);
  });
});
