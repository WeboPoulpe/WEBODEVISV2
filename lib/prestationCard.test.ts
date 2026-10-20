import { describe, expect, it } from 'vitest';
import { generateQuoteHtml } from './generateQuoteHtml';
import { carteShell, cardFromDescription, EDIT_ATTR, isBlankHtml } from './prestationCard';

const OPTS = { template: 'classique' as const, font: 'Georgia' };

/** Le bloc .gastro-menu d'un devis d'une seule prestation. */
const menuOf = (html: string) => html.match(/<div class="gastro-menu"[\s\S]*?<\/div>\s*(?=<!-- ── Pied de carte)/)![0].trim();

describe('bloc de la carte, édité sur place', () => {
  it('description : le bloc du devis, avec la description remplacée par la zone modifiable', () => {
    const shell = carteShell({ name: 'Plateau du chef', isOption: false, kind: 'description', lang: 'fr' }, OPTS);
    const real = menuOf(generateQuoteHtml({
      companyName: '', clientName: '', vatRate: 20,
      services: [{ name: 'Plateau du chef', description: '<p>Huîtres</p>', quantity: 1, unitPrice: 0 }],
    }, OPTS));
    expect(shell).toContain(`${EDIT_ATTR}="1"></div>`);
    // En remettant la description dans la zone, on retrouve exactement le bloc du devis.
    expect(shell.replace(` ${EDIT_ATTR}="1"></div>`, '><p>Huîtres</p></div>')).toBe(real);
    expect(shell).toContain('Plateau du chef');
  });

  it('fiche : le conteneur du plat devient la zone modifiable, en français comme en anglais', () => {
    for (const lang of ['fr', 'en'] as const) {
      const shell = carteShell({ name: 'Plateau', isOption: false, kind: 'card', lang }, OPTS);
      const real = menuOf(generateQuoteHtml({
        companyName: '', clientName: '', vatRate: 20, language: lang,
        services: [{ name: 'Plateau', quantity: 1, unitPrice: 0, gastroCardHtml: lang === 'fr' ? '<h3>X</h3>' : null, gastroCardHtmlEn: lang === 'en' ? '<h3>X</h3>' : null }],
      }, OPTS));
      expect(shell.replace(` ${EDIT_ATTR}="1"></div>`, '><h3>X</h3></div>')).toBe(real);
      expect(shell).not.toContain('Plateau');
    }
  });

  it('fiche anglaise tirée de la description : même bloc, nom en titre lu par le tableau du devis anglais', () => {
    const card = cardFromDescription({ name: 'Plateau du chef', description: '<p>Huîtres</p>' }, OPTS);
    expect(card.startsWith('<div style="text-align:center;"><h3 style="font-size:15px;')).toBe(true);
    expect(card).toContain('Plateau du chef</h3>');
    expect(card).toContain('<p>Huîtres</p>');
    const en = generateQuoteHtml({
      companyName: '', clientName: '', vatRate: 20, language: 'en',
      services: [{ name: 'Plateau du chef', quantity: 1, unitPrice: 0, gastroCardHtmlEn: card.replace('Plateau du chef', 'Chef’s platter') }],
    }, OPTS);
    expect(en).toContain('Chef’s platter</strong>');
  });

  it('texte vide', () => {
    expect(isBlankHtml('<p><br></p>')).toBe(true);
    expect(isBlankHtml('<p>&nbsp;</p>')).toBe(true);
    expect(isBlankHtml('<p>a</p>')).toBe(false);
    expect(isBlankHtml('<img src="x">')).toBe(false);
  });
});
