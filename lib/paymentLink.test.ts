import { describe, expect, it } from 'vitest';
import { cleanPaymentUrl } from './paymentLink';

describe('lien de paiement du traiteur', () => {
  it('garde un lien https et complète un lien sans https', () => {
    expect(cleanPaymentUrl(' https://pay.sumup.com/b2c/ABC ')).toBe('https://pay.sumup.com/b2c/ABC');
    expect(cleanPaymentUrl('paypal.me/traiteur')).toBe('https://paypal.me/traiteur');
  });

  it('refuse ce qui n’est pas un lien https vers un vrai site', () => {
    for (const bad of ['', '   ', 'javascript:alert(1)', 'http://pay.sumup.com/x', 'data:text/html,x', 'https://localhost/x',
      'https://user:pass@pay.sumup.com', 'mon lien de paiement', 'mailto:a@b.fr', `https://a.fr/${'x'.repeat(600)}`]) {
      expect(cleanPaymentUrl(bad), bad).toBeNull();
    }
    expect(cleanPaymentUrl(null)).toBeNull();
  });
});
