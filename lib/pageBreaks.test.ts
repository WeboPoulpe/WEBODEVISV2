import { describe, expect, it } from 'vitest';
import { computePageBreaks, type PageBlock } from './pageBreaks';

const H = 1000;

describe('computePageBreaks', () => {
  it('un document court tient sur une page', () => {
    const r = computePageBreaks([{ top: 0, height: 300 }, { top: 320, height: 200 }], H);
    expect(r.pages).toBe(1);
    expect(r.ends).toEqual([]);
    expect(r.lastFill).toBeCloseTo(0.52);
  });

  it('un bloc qu’on ne coupe pas passe entier à la page suivante', () => {
    const blocks: PageBlock[] = [
      { top: 0, height: 900 },
      { top: 900, height: 200, unbreakable: true },
      { top: 1100, height: 100, unbreakable: true },
    ];
    const r = computePageBreaks(blocks, H);
    expect(r.pages).toBe(2);
    expect(r.ends).toHaveLength(1);
    expect(r.ends[0]).toMatchObject({ page: 1, blockIndex: 1, offsetInBlock: 0 });
    expect(r.ends[0].fill).toBeCloseTo(0.9);
    // Page 2 : le bloc repoussé (200) puis le suivant (100).
    expect(r.lastFill).toBeCloseTo(0.3);
  });

  it('un saut forcé commence une nouvelle page, même à moitié vide', () => {
    const r = computePageBreaks([
      { top: 0, height: 100 },
      { top: 120, height: 50, forceBreakBefore: true },
    ], H);
    expect(r.pages).toBe(2);
    expect(r.ends[0]).toMatchObject({ page: 1, blockIndex: 1 });
    expect(r.ends[0].fill).toBeCloseTo(0.1);
  });

  it('un saut forcé en tout début de document ne crée pas de page vide', () => {
    const r = computePageBreaks([{ top: 0, height: 100, forceBreakBefore: true }], H);
    expect(r.pages).toBe(1);
  });

  it('un paragraphe se coupe entre deux lignes', () => {
    // 30 lignes de 20 px à partir de 700 : 15 lignes tiennent sur la page 1.
    const r = computePageBreaks([{ top: 0, height: 690 }, { top: 700, height: 600, lineHeight: 20 }], H);
    expect(r.pages).toBe(2);
    expect(r.ends[0]).toMatchObject({ blockIndex: 1, offsetInBlock: 300 });
    expect(r.lastFill).toBeCloseTo(0.3);
  });

  it('garde au moins deux lignes de chaque côté de la coupure', () => {
    // Une seule ligne tiendrait en bas de page : le paragraphe part entier.
    const r = computePageBreaks([{ top: 0, height: 975 }, { top: 975, height: 100, lineHeight: 20 }], H);
    expect(r.ends[0]).toMatchObject({ blockIndex: 1, offsetInBlock: 0 });
    // Trois lignes sur quatre tiendraient : deux restent, deux passent.
    const r2 = computePageBreaks([{ top: 0, height: 930 }, { top: 930, height: 80, lineHeight: 20 }], H);
    expect(r2.ends[0]).toMatchObject({ blockIndex: 1, offsetInBlock: 40 });
  });

  it('un bloc plus haut qu’une page est coupé quand même', () => {
    const r = computePageBreaks([{ top: 0, height: 2500, unbreakable: true }], H);
    expect(r.pages).toBe(3);
    expect(r.ends.map((e) => e.offsetInBlock)).toEqual([1000, 2000]);
  });

  it('un bloc « à garder avec la suite » part avec le bloc suivant', () => {
    const r = computePageBreaks([
      { top: 0, height: 900 },
      { top: 900, height: 40, keepWithNext: true },
      { top: 950, height: 150, unbreakable: true },
    ], H);
    expect(r.ends[0]).toMatchObject({ page: 1, blockIndex: 1 });
    expect(r.ends[0].fill).toBeCloseTo(0.9);
  });

  it('répète l’en-tête de tableau en haut de la page suivante', () => {
    const rows: PageBlock[] = Array.from({ length: 12 }, (_, i) => ({ top: i * 100, height: 100, unbreakable: true, repeatHeader: 30 }));
    const r = computePageBreaks(rows, H);
    expect(r.pages).toBe(2);
    expect(r.ends[0].blockIndex).toBe(10);
    expect(r.lastFill).toBeCloseTo(0.23);
  });

  it('tient compte de la place prise en haut de la première page', () => {
    const r = computePageBreaks([{ top: 0, height: 900, unbreakable: true }], H, 200);
    expect(r.pages).toBe(2);
    expect(r.ends[0]).toMatchObject({ blockIndex: 0, offsetInBlock: 0 });
  });

  it('repère une page presque vide (fin de tableau isolée)', () => {
    const r = computePageBreaks([
      { top: 0, height: 990 },
      { top: 990, height: 80, unbreakable: true },
      { top: 1100, height: 400, forceBreakBefore: true },
    ], H);
    expect(r.pages).toBe(3);
    expect(r.ends[1].page).toBe(2);
    expect(r.ends[1].fill).toBeCloseTo(0.08);
  });

  it('une grande marge en bas de page ne crée pas de page fantôme', () => {
    const r = computePageBreaks([{ top: 0, height: 950 }, { top: 1200, height: 100 }], H);
    expect(r.pages).toBe(2);
    expect(r.lastFill).toBeCloseTo(0.1);
  });
});
