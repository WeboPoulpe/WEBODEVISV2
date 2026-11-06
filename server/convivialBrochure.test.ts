import { describe, expect, it } from 'vitest';
import { layoutError, parseLayout, sanitizeLayout, layoutFonts } from '@/lib/brochureLayout';
// @ts-expect-error module JavaScript sans types (script de données)
import { buildBrochure } from '../scripts/brochures/convivial-event.mjs';

// La brochure Convivial Event (scripts/seed-convivial-brochure.mjs) : une mise en page acceptée telle quelle par
// l'éditeur avancé, sans rien perdre à la lecture ni au nettoyage HTML.

describe('brochure Convivial Event', () => {
  const b = buildBrochure() as { name: string; layout: unknown };

  it('est une mise en page valide, lue sans perte', () => {
    const parsed = parseLayout(b.layout);
    expect(parsed).not.toBeNull();
    expect(layoutError(parsed!)).toBeNull();
    expect(parsed).toEqual(b.layout);
  });

  it('garde sa mise en forme au nettoyage HTML', () => {
    const parsed = parseLayout(b.layout)!;
    const texts = (l: typeof parsed) => l.pages.flatMap((p) => p.blocks.flatMap((x) => (x.type === 'text' ? [x.html] : [])));
    const clean = texts(sanitizeLayout(parsed));
    const before = texts(parsed);
    expect(clean.length).toBe(before.length);
    // Les styles en ligne restent : couleurs, polices, fonds.
    clean.forEach((html, i) => {
      expect(html.match(/style="/g)?.length).toBe(before[i].match(/style="/g)?.length);
    });
  });

  it('a la version française puis anglaise, contact et formulaire à la fin', () => {
    const parsed = parseLayout(b.layout)!;
    expect(parsed.pages.map((p) => p.kind)).toEqual([...Array(16).fill('blocks'), 'contact', 'form']);
    const html = (i: number) => parsed.pages[i].blocks.map((x) => (x.type === 'text' ? x.html : '')).join('');
    expect(html(0)).toContain('Saison 2026 – 2027');
    expect(html(8)).toContain('English version');
    expect(layoutFonts(parsed).sort()).toEqual(['Montserrat', 'Playfair Display']);
  });
});
