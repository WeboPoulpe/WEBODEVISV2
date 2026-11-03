import { describe, expect, it } from 'vitest';
import { computeBreaks, type FlowUnit } from './flowBreaks';

const block = (top: number, bottom: number): FlowUnit => ({ top, bottom, kind: 'block' });
/** Paragraphe de lignes régulières (hauteur `lh`), de `top` à `bottom`. */
const line = (top: number, bottom: number, lh: number): FlowUnit => ({
  top, bottom, kind: 'line', lines: Array.from({ length: Math.round((bottom - top) / lh) }, (_, k) => ({ top: top + k * lh, bottom: top + (k + 1) * lh })),
});
const heading = (top: number, bottom: number): FlowUnit => ({ top, bottom, kind: 'heading' });

describe('suite de page : coupures', () => {
  it('tout tient (même pile) : une seule page', () => {
    expect(computeBreaks([block(0, 50), block(60, 100)], 100, 100)).toEqual([0]);
    expect(computeBreaks([], 100, 0)).toEqual([0]);
  });

  it('coupure entre deux blocs, jamais au milieu d’une photo', () => {
    // Photo de 60 à 140 : elle passe entière sur la page 2.
    expect(computeBreaks([block(0, 50), block(60, 140), block(145, 155)], 100, 155)).toEqual([0, 60]);
  });

  it('un paragraphe à cheval est coupé sur une frontière de ligne', () => {
    // Lignes de 20 à partir de 45 : frontières 65, 85, 105… la page (100) s'arrête à 85.
    expect(computeBreaks([block(0, 30), line(45, 205, 20)], 100, 205)).toEqual([0, 85, 185]);
  });

  it('lignes de hauteurs différentes : la coupure tombe entre deux lignes réelles', () => {
    // Petite ligne 0–12, grande ligne 12–40, petites lignes 40–52, 52–64… jusqu'à 136.
    const lines = [{ top: 0, bottom: 12 }, { top: 12, bottom: 40 }, ...Array.from({ length: 8 }, (_, k) => ({ top: 40 + k * 12, bottom: 52 + k * 12 }))];
    const b = computeBreaks([{ top: 0, bottom: 136, kind: 'line', lines }], 70, 136);
    expect(b[1]).toBe(64);
    expect(lines.some((l) => l.top < b[1] && l.bottom > b[1])).toBe(false);
  });

  it('un titre ne reste pas seul en bas de page', () => {
    // Titre 70–85 suivi d'un bloc 90–160 qui ne tient pas : le titre part avec lui.
    expect(computeBreaks([block(0, 60), heading(70, 85), block(90, 160)], 100, 160)).toEqual([0, 70]);
  });

  it('une chose plus haute qu’une page : coupée à la hauteur de page, sans boucle', () => {
    expect(computeBreaks([block(0, 250)], 100, 250)).toEqual([0, 100, 200]);
  });

  it('pages successives', () => {
    const units = Array.from({ length: 10 }, (_, i) => block(i * 30, i * 30 + 25));
    expect(computeBreaks(units, 100, 295)).toEqual([0, 90, 180, 270]);
  });
});
