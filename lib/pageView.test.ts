import { describe, expect, it } from 'vitest';
import { pageViewCss, pathSelector } from '@/components/devis/weboword/pageView';
import { quoteEditorCss, quoteOutputCss } from '@/lib/quoteOutput';

const settings = { font: 'Georgia', fontSize: 12, lineHeight: '1.4', showDesc: true };

describe('vue en pages de l’éditeur', () => {
  it('cible un élément par son chemin sous la zone de texte', () => {
    expect(pathSelector('#weboword-sheet', [2, 0, 4])).toBe('#weboword-sheet > :nth-child(3) > :nth-child(1) > :nth-child(5)');
    expect(pathSelector('[data-weboword-legal]', [])).toBe('[data-weboword-legal]');
  });

  it('écarte l’élément qui commence la page, ou les cellules d’une ligne de tableau, à l’écran seulement', () => {
    const css = pageViewCss([
      { selector: '#weboword-sheet > :nth-child(2)', kind: 'margin', px: 312.456 },
      { selector: '#weboword-sheet > :nth-child(4)', kind: 'cells', px: 140 },
    ]);
    expect(css.startsWith('@media screen {')).toBe(true);
    expect(css).toContain('#weboword-sheet > :nth-child(2) { margin-top: 312.46px !important; }');
    expect(css).toContain('#weboword-sheet > :nth-child(4) > td, #weboword-sheet > :nth-child(4) > th { padding-top: 140px !important; }');
  });

  it('ne pose rien sans coupure, et jamais de marge négative', () => {
    expect(pageViewCss([])).toBe('');
    expect(pageViewCss([{ selector: '#x', kind: 'margin', px: -20 }])).toContain('margin-top: 0px');
  });
});

describe('feuille de l’éditeur et papier', () => {
  it('l’éditeur reprend les règles du papier, règles d’impression comprises', () => {
    const css = quoteEditorCss(settings, '.webo-paper', '#weboword-sheet');
    expect(css).not.toContain('@page');
    expect(css).not.toContain('@media print');
    expect(css).toContain('#weboword-sheet.quote-doc { padding: 20mm;');
    expect(css).toContain('margin-top: -14mm !important');
    // Remise à zéro de l'application annulée dans la feuille : valeurs du navigateur, comme à l'impression.
    expect(css).toContain('.webo-paper :is(blockquote, dl, dd, figure, p, pre, hr) { margin: revert; }');
    // Le repère « Saut de page » n'occupe pas de hauteur.
    expect(css).toMatch(/\.screen-sep \{ display: block !important; position: relative !important; height: 0 !important;/);
  });

  it('le papier ne coupe pas un bloc de texte et ne répète pas l’en-tête des tableaux', () => {
    const css = quoteOutputCss(settings);
    expect(css).toContain('.quote-doc thead { display: table-row-group; }');
    expect(css.replace(/\n/g, ' ')).toMatch(/\.quote-doc p, \.quote-doc li, .*\{\s*page-break-inside: avoid; break-inside: avoid;/);
  });
});
