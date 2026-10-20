import { describe, expect, it } from 'vitest';
import { pageViewCss, pathSelector } from '@/components/devis/weboword/pageView';

describe('vue en pages de l’éditeur', () => {
  it('cible un élément par son chemin sous la zone de texte', () => {
    expect(pathSelector('#weboword-sheet', [2, 0, 4])).toBe('#weboword-sheet > :nth-child(3) > :nth-child(1) > :nth-child(5)');
  });

  it('écarte l’élément qui commence la page, ou les cellules d’une ligne de tableau, à l’écran seulement', () => {
    const css = pageViewCss('#weboword-sheet', [
      { path: [1], kind: 'margin', px: 312.46 },
      { path: [3, 0, 2], kind: 'cells', px: 140 },
    ]);
    expect(css.startsWith('@media screen {')).toBe(true);
    expect(css).toContain('#weboword-sheet > :nth-child(2) { margin-top: 312.5px !important; }');
    expect(css).toContain('#weboword-sheet > :nth-child(4) > :nth-child(1) > :nth-child(3) > td, #weboword-sheet > :nth-child(4) > :nth-child(1) > :nth-child(3) > th { padding-top: 140px !important; }');
  });

  it('ne pose rien sans coupure, et jamais de marge négative', () => {
    expect(pageViewCss('#weboword-sheet', [])).toBe('');
    expect(pageViewCss('#x', [{ path: [0], kind: 'margin', px: -20 }])).toContain('margin-top: 0px');
  });
});
