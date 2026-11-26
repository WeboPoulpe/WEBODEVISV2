import { describe, expect, it } from 'vitest';
import { evalAmount } from './calcExpression';

describe('evalAmount', () => {
  it('additionne les montants d’un libellé en ignorant les mots', () => {
    expect(evalAmount('CAM 200 +  50 + COM 250 + PERSO  850 + HA  900 + NV 450')).toBe(2700);
  });
  it('respecte les priorités et les parenthèses', () => {
    expect(evalAmount('3 x 15 + 10')).toBe(55);
    expect(evalAmount('(200 + 50) × 2')).toBe(500);
    expect(evalAmount('100 ÷ 3')).toBe(33.33);
    expect(evalAmount('1250 − 250')).toBe(1000);
  });
  it('lit les virgules décimales et les euros', () => {
    expect(evalAmount('12,50 € + 7,5 €')).toBe(20);
  });
  it('ignore une opération en cours de saisie', () => {
    expect(evalAmount('200 + 50 +')).toBe(250);
  });
  it('refuse ce qui est ambigu ou vide', () => {
    expect(evalAmount('Transport')).toBeNull();
    expect(evalAmount('2 cartons 15')).toBeNull();
    expect(evalAmount('(200 + 50')).toBeNull();
    expect(evalAmount('10 / 0')).toBeNull();
  });
});
