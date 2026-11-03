import { describe, expect, it } from 'vitest';
import { computeBreaks, type FlowUnit } from './flowBreaks';

const block = (top: number, bottom: number): FlowUnit => ({ top, bottom, kind: 'block' });
const line = (top: number, bottom: number, lineHeight: number): FlowUnit => ({ top, bottom, kind: 'line', lineHeight });
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
