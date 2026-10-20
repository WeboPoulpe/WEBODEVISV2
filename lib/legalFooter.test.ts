import { describe, expect, it } from 'vitest';
import { buildLegalFooterHtml } from '@/components/devis/weboword/printHelpers';

describe('mentions légales en pied de devis', () => {
  it('reprend l’entreprise et sa ligne d’identité, comme les factures', () => {
    const html = buildLegalFooterHtml({
      company_name: 'Traiteur <Verdier>', company_address: '12 rue des Lilas, 10000 Troyes',
      legal_form: 'SARL', share_capital: '10 000', rcs: 'Troyes 123 456 789', siret: '12345678900012', vat_number: 'FR32123456789',
    });
    expect(html).toContain('Traiteur &lt;Verdier&gt; · 12 rue des Lilas, 10000 Troyes');
    expect(html).toContain('SARL · Capital de 10 000 € · RCS Troyes 123 456 789 · SIRET 12345678900012 · N° TVA FR32123456789');
  });

  it('écrit la franchise de TVA à la place du numéro', () => {
    const html = buildLegalFooterHtml({ company_name: 'Chef', siret: '11122233300011', vat_exempt: true, vat_number: 'FR00' });
    expect(html).toContain('TVA non applicable, art. 293 B du CGI');
    expect(html).not.toContain('FR00');
  });

  it('ne met rien quand rien n’est renseigné', () => {
    expect(buildLegalFooterHtml({})).toBe('');
    expect(buildLegalFooterHtml(null)).toBe('');
  });
});
