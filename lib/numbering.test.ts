import { describe, expect, it } from 'vitest';
import { cleanPrefix, formatDocumentNumber, numberFormat } from './numbering';

describe('format des numéros', () => {
  it('prend les valeurs par défaut', () => {
    expect(formatDocumentNumber(numberFormat(null, 'quote'), 7, 2026)).toBe('D-2026-0007');
    expect(formatDocumentNumber(numberFormat({}, 'invoice'), 12, 2026)).toBe('F-2026-0012');
    expect(formatDocumentNumber(numberFormat(undefined, 'credit'), 1, 2026)).toBe('AV-2026-0001');
  });

  it('suit les réglages du traiteur', () => {
    const f = numberFormat({ invoice: { prefix: 'FAC-', withYear: false, digits: 6 } }, 'invoice');
    expect(formatDocumentNumber(f, 42)).toBe('FAC-000042');
  });

  it('borne le nombre de chiffres comme la base', () => {
    expect(numberFormat({ quote: { digits: 0 } }, 'quote').digits).toBe(1);
    expect(numberFormat({ quote: { digits: 20 } }, 'quote').digits).toBe(8);
  });

  it('garde un préfixe vide', () => {
    expect(formatDocumentNumber(numberFormat({ quote: { prefix: '' } }, 'quote'), 3, 2026)).toBe('2026-0003');
  });

  it('nettoie le préfixe saisi', () => {
    expect(cleanPrefix('Fac <script> é-')).toBe('Facscript-');
  });
});
