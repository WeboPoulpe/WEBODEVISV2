import { describe, expect, it } from 'vitest';
import { generateQuoteHtml } from '@/lib/generateQuoteHtml';
import { isDarkQuote, lightQuoteHtml } from '@/lib/quoteLight';

const doc = (template: 'prestige' | 'epicure' | 'standard') => generateQuoteHtml({
  companyName: 'Traiteur', clientName: 'Client', eventType: 'Mariage', eventDate: '2027-06-12', guestCount: 50,
  services: [{ id: '1', name: 'Buffet', quantity: 50, unitPrice: 40 }], vatRate: 8.5, hidePrice: false, language: 'fr',
} as Parameters<typeof generateQuoteHtml>[0], { template });

describe('version claire d’un devis noir', () => {
  it('reconnaît les documents sur fond noir', () => {
    expect(isDarkQuote(doc('prestige'))).toBe(true);
    expect(isDarkQuote(doc('epicure'))).toBe(true);
    expect(isDarkQuote(doc('standard'))).toBe(false);
  });

  it('passe le document sur papier blanc, texte foncé', () => {
    const light = lightQuoteHtml(doc('epicure'));
    expect(isDarkQuote(light)).toBe(false);
    expect(light).not.toMatch(/#0a0a0a|#f5f0eb|#141414/i);
    expect(light).toContain('#1a1a1a');
  });

  it('laisse tel quel un document clair', () => {
    const html = doc('standard');
    expect(lightQuoteHtml(html)).toBe(html);
  });
});
