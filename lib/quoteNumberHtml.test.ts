import { describe, expect, it } from 'vitest';
import { withQuoteNumber } from './quoteNumberHtml';

const HEADER = '<div><p style="color:rgba(255,255,255,0.65);margin:6px 0 0;font-size:11px;">Date : 19/10/2026</p></div>';

describe('numéro du devis dans le document', () => {
  it('l’ajoute sous la date de l’en-tête', () => {
    const out = withQuoteNumber(HEADER, 'D-2026-0007');
    expect(out).toContain('Date : 19/10/2026</p><p data-webo-number="1" style="color:rgba(255,255,255,0.65);margin:2px 0 0;font-size:11px;">N° D-2026-0007</p>');
  });

  it('remplace le numéro déjà posé au lieu d’en ajouter un second', () => {
    const once = withQuoteNumber(HEADER, 'D-2026-0007');
    const twice = withQuoteNumber(once, 'D-2026-0008');
    expect(twice.match(/data-webo-number/g)).toHaveLength(1);
    expect(twice).toContain('N° D-2026-0008');
  });

  it('ne touche à rien sans numéro ou sans ligne de date', () => {
    expect(withQuoteNumber(HEADER, null)).toBe(HEADER);
    expect(withQuoteNumber('<p>Bonjour</p>', 'D-1')).toBe('<p>Bonjour</p>');
  });

  it('échappe le numéro', () => {
    expect(withQuoteNumber(HEADER, '<b>x</b>')).toContain('N° &lt;b&gt;x&lt;/b&gt;');
  });

  it('parle anglais pour un devis en anglais', () => {
    expect(withQuoteNumber(HEADER, 'D-1', 'en')).toContain('No. D-1');
  });
});
