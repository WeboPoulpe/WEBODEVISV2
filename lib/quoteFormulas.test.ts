import { describe, expect, it } from 'vitest';
import { chosenFormula, documentForFormula, effectiveLines, formulaPending, parseFormulas, quoteLines } from './quoteFormulas';
import { formulaTotals, perGuest, quoteFormulaRange, quoteTotalTTC } from './quoteTotals';
import { linesFromQuote } from './invoices';
import { generateQuoteHtml, type QuoteHtmlData } from './generateQuoteHtml';

const FORMULAS = [{ id: 'prestige', name: 'Formule Prestige' }, { id: 'tradition', name: 'Formule Tradition', description: 'Le classique' }];
const LINES = [
  { id: 'c', name: 'Service', quantity: 1, unitPrice: 500 },
  { id: 'p', name: 'Menu Prestige', quantity: 50, unitPrice: 60, formula: 'prestige' },
  { id: 't', name: 'Menu Tradition', quantity: 50, unitPrice: 40, formula: 'tradition' },
  { id: 'o', name: 'Champagne', quantity: 50, unitPrice: 10, formula: 'prestige', isOption: true },
];
const quote = (extra: object = {}) => ({ total_amount: null, vat_rate: 10, guest_count: 50, services: LINES, formulas: FORMULAS, ...extra });

describe('formules : lecture', () => {
  it('nettoie les formules (identifiants valables et uniques, noms remplis)', () => {
    expect(parseFormulas(null)).toEqual([]);
    expect(parseFormulas([{ id: 'a', name: '  Prestige  ' }, { id: 'a', name: 'doublon' }, { id: 'b"><x', name: 'x' }, { id: 'c', name: '' }, 'x'])).toEqual([
      { id: 'a', name: 'Prestige' }, { id: 'c', name: 'Formule 2' },
    ]);
  });

  it('ne retient qu’une formule existante', () => {
    expect(chosenFormula(FORMULAS, 'tradition')?.name).toBe('Formule Tradition');
    expect(chosenFormula(FORMULAS, 'inconnue')).toBeNull();
    expect(formulaPending({ formulas: FORMULAS, chosen_formula_id: null })).toBe(true);
    expect(formulaPending({ formulas: FORMULAS, chosen_formula_id: 'prestige' })).toBe(false);
    expect(formulaPending({ formulas: null, chosen_formula_id: null })).toBe(false);
  });
});

describe('formules : lignes qui comptent', () => {
  it('sans formule, toutes les lignes (devis existants inchangés)', () => {
    expect(effectiveLines(LINES, [], null)).toEqual(LINES);
    // Un identifiant de formule sans formule déclarée : ligne commune.
    expect(quoteLines({ services: LINES })).toHaveLength(4);
  });

  it('formule retenue : les lignes communes et les siennes', () => {
    expect(effectiveLines(LINES, FORMULAS, 'tradition').map((l) => l.id)).toEqual(['c', 't']);
    expect(effectiveLines(LINES, FORMULAS, 'prestige').map((l) => l.id)).toEqual(['c', 'p', 'o']);
  });

  it('rien de retenu : la première formule sert de référence', () => {
    expect(effectiveLines(LINES, FORMULAS, null).map((l) => l.id)).toEqual(['c', 'p', 'o']);
    expect(effectiveLines(LINES, FORMULAS, 'inconnue').map((l) => l.id)).toEqual(['c', 'p', 'o']);
  });
});

describe('formules : totaux', () => {
  it('total de chaque formule, lignes communes comprises, hors options', () => {
    const totals = formulaTotals(LINES, FORMULAS, 10, 50, 0);
    expect(totals.map((t) => [t.formula.id, t.totals.ht, t.totals.ttc])).toEqual([['prestige', 3500, 3850], ['tradition', 2500, 2750]]);
  });

  it('le total du devis suit la formule retenue', () => {
    expect(quoteTotalTTC(quote())).toBe(3850);
    expect(quoteTotalTTC(quote({ chosen_formula_id: 'tradition' }))).toBe(2750);
    // Sans formule déclarée (ou avant la migration) : toutes les lignes, comme avant.
    expect(quoteTotalTTC({ ...quote(), formulas: undefined })).toBe(6050);
  });

  it('seule la formule retenue est facturée', () => {
    expect(linesFromQuote(quote({ chosen_formula_id: 'tradition' })).map((l) => l.label)).toEqual(['Service', 'Menu Tradition']);
    expect(linesFromQuote({ ...quote(), formulas: null }).map((l) => l.label)).toEqual(['Service', 'Menu Prestige', 'Menu Tradition']);
  });
});

describe('formules : document', () => {
  const data = (extra: Partial<QuoteHtmlData> = {}): QuoteHtmlData => ({
    companyName: 'Traiteur', clientName: 'Dupont', guestCount: 50, vatRate: 10,
    services: LINES.map((l) => ({ ...l, description: null })), ...extra,
  });
  const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

  it('un devis sans formule n’a aucun repère de formule', () => {
    const html = generateQuoteHtml(data());
    expect(html).not.toContain('data-webo-formula');
    expect(html).toContain(euros(6050));
  });

  it('avant le choix : chaque formule avec son total et la mention « à choisir »', () => {
    const html = generateQuoteHtml(data({ formulas: FORMULAS }));
    expect(html).toContain('Formule Prestige');
    expect(html).toContain('Formule Tradition');
    expect(html).toContain('à choisir');
    expect(html).toContain(euros(3850));
    expect(html).toContain(euros(2750));
    expect(html).not.toContain(euros(6050));
  });

  it('après le choix : la page du client ne garde que la formule retenue', () => {
    const html = generateQuoteHtml(data({ formulas: FORMULAS }));
    const shown = documentForFormula(html, FORMULAS, 'tradition');
    expect(shown).toContain('Menu Tradition');
    expect(shown).not.toContain('Menu Prestige');
    expect(shown).not.toContain('à choisir');
    expect(shown).toContain(euros(2750));
    expect(shown).not.toContain(euros(3850));
    expect(shown).toContain('Service');
    // Rien à retirer sans formule retenue.
    expect(documentForFormula(html, FORMULAS, null)).toBe(html);
  });

  it('généré après le choix : seule la formule retenue', () => {
    const html = generateQuoteHtml(data({ formulas: FORMULAS, chosenFormulaId: 'prestige' }));
    expect(html).toContain('Menu Prestige');
    expect(html).not.toContain('Menu Tradition');
    expect(html).not.toContain('à choisir');
    expect(html).toContain(euros(3850));
  });

  it('les noms de formule sont échappés', () => {
    const html = generateQuoteHtml(data({ formulas: [{ id: 'x', name: '<img src=x onerror=alert(1)>' }] }));
    expect(html).not.toContain('<img src=x');
  });
});

describe('formules : après coup', () => {
  const data = (formulas: typeof FORMULAS, lines: typeof LINES): QuoteHtmlData => ({
    companyName: 'T', clientName: 'C', vatRate: 10, guestCount: 50, services: lines, formulas,
  });

  it('formule supprimée depuis : ses plats restent (devenus communs), seul son titre part', () => {
    // Document généré avec les deux formules, puis Prestige supprimée sans resynchroniser le document.
    const html = generateQuoteHtml(data(FORMULAS, LINES));
    const tradition = [FORMULAS[1]];
    const shown = documentForFormula(html, tradition, 'tradition');
    expect(shown).toContain('Menu Prestige');
    expect(shown).not.toMatch(/webo-formula-title[^>]*data-webo-formula="prestige"/);
    expect(shown).toContain('Menu Tradition');
  });

  it('formule sans ligne propre : pas d’en-tête vide dans le tableau', () => {
    const html = generateQuoteHtml(data([...FORMULAS, { id: 'vide', name: 'Formule Vide' }], LINES));
    expect(html).not.toMatch(/<tr data-webo-formula="vide"/);
    expect(html).toContain('Formule Vide');
  });

  it('prix par personne de chaque formule dans le document', () => {
    const html = generateQuoteHtml(data(FORMULAS, LINES));
    // Prestige : (500 + 3000) × 1,1 = 3 850 € pour 50 convives.
    expect(html).toMatch(/soit 77,00\s€ TTC par personne/);
  });

  it('« de … à … » tant que rien n’est choisi, puis plus rien', () => {
    expect(quoteFormulaRange(quote())).toEqual({ min: 2750, max: 3850 });
    expect(quoteFormulaRange(quote({ chosen_formula_id: 'tradition' }))).toBeNull();
    expect(quoteFormulaRange(quote({ formulas: [FORMULAS[0]] }))).toBeNull();
    expect(perGuest(3850, 50)).toBe(77);
    expect(perGuest(3850, 0)).toBeNull();
  });

  it('formule retenue à 0 € : le total est 0, pas le montant enregistré d’une autre formule', () => {
    const free = LINES.map((l) => (l.formula === 'tradition' ? { ...l, unitPrice: 0 } : l.formula ? l : { ...l, unitPrice: 0 }));
    expect(quoteTotalTTC({ ...quote({ services: free, chosen_formula_id: 'tradition' }), total_amount: 3850 })).toBe(0);
  });
});
