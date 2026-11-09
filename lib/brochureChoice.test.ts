import { describe, expect, it } from 'vitest';
import { chosenToServices, estimate, parseChosen } from './brochureChoice';

describe('prestations choisies dans une brochure', () => {
  const line = { prestationId: 'p', name: 'Menu', unitPrice: 50, childUnitPrice: 20, perGuest: true, category: 'dîner', description: '<p>x</p>', gastroCardHtml: null };
  it('lit les lignes, ignore ce qui est illisible', () => {
    expect(parseChosen([line, { name: 'sans id' }, null, 'x'])).toEqual([line]);
    expect(parseChosen('x')).toEqual([]);
  });
  it('devient des lignes de devis : au couvert × invités, sinon 1', () => {
    const [a, b] = chosenToServices([line, { ...line, name: 'Forfait', perGuest: false, childUnitPrice: null }], 80);
    expect(a).toMatchObject({ name: 'Menu', quantity: 80, unitPrice: 50, childUnitPrice: 20, category: 'dîner' });
    expect(b).toMatchObject({ name: 'Forfait', quantity: 1 });
    expect(b).not.toHaveProperty('childUnitPrice');
    expect(chosenToServices([line], null)[0].quantity).toBe(1);
  });
  it('estimation : prix affichés, au couvert × invités', () => {
    expect(estimate([{ amount: 50, perGuest: true }, { amount: 300, perGuest: false }, { amount: null }], 10)).toBe(800);
    expect(estimate([{ amount: null }], 10)).toBeNull();
  });
});
