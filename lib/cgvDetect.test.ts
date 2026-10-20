import { describe, expect, it } from 'vitest';
import { documentHasCgv, hasCgvTitle } from './cgvDetect';

describe('hasCgvTitle', () => {
  it('repère le titre tapé à la main, quelle que soit la casse ou les accents', () => {
    expect(hasCgvTitle('<p>Texte</p><h2 style="color:#e65100">Conditions Générales de Vente</h2><p>1. Objet…</p>')).toBe(true);
    expect(hasCgvTitle('<p><strong>CONDITIONS GENERALES DE VENTE</strong></p>')).toBe(true);
    expect(hasCgvTitle('<p>conditions g&eacute;n&eacute;rales de vente :</p>')).toBe(true);
    expect(hasCgvTitle('<div><span>Conditions</span> <b>Générales</b> de&nbsp;Vente (CGV)</div>')).toBe(true);
    expect(hasCgvTitle('<h3>5. Conditions générales de vente</h3>')).toBe(true);
  });

  it('ne compte pas une simple mention dans une phrase', () => {
    expect(hasCgvTitle('<p>Ce devis est valable 30 jours. Toute commande implique l\'acceptation de nos conditions générales de vente.</p>')).toBe(false);
    expect(hasCgvTitle('')).toBe(false);
    expect(hasCgvTitle(null)).toBe(false);
  });
});

describe('documentHasCgv', () => {
  it('reconnaît le bloc ajouté, le texte des CGV ou le titre', () => {
    expect(documentHasCgv('<div data-webo-cgv="1">…</div>', null)).toBe(true);
    expect(documentHasCgv('<p>Article 1 : acompte de 30 %</p>', 'Article 1 : acompte de 30 %')).toBe(true);
    expect(documentHasCgv('<h2>Conditions Générales de Vente</h2>', 'autre texte')).toBe(true);
    expect(documentHasCgv('<p>Rien ici</p>', 'Article 1')).toBe(false);
  });
});
