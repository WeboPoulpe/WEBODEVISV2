import { describe, expect, it } from 'vitest';
import { frDate, invoiceMentions, sellerIdentityLine } from './invoiceMentions';

const seller = { name: 'Traiteur Test', siret: '12345678900012', vatNumber: 'FR12345678900', legalForm: 'SARL', shareCapital: '5 000', rcs: 'Troyes 123 456 789', iban: 'FR76 1234', bic: 'AGRIFRPP' };

describe('mentions légales des factures', () => {
  it('ligne d’identité du vendeur', () => {
    expect(sellerIdentityLine(seller)).toBe('SARL · Capital de 5 000 € · RCS Troyes 123 456 789 · SIRET 12345678900012 · N° TVA FR12345678900');
    expect(sellerIdentityLine({ name: 'Micro', siret: '1', vatExempt: true, vatNumber: 'FR1' })).toBe('SIRET 1 · TVA non applicable, art. 293 B du CGI');
  });

  it('facture à un professionnel : échéance, IBAN, pénalités', () => {
    const m = invoiceMentions({ kind: 'acompte', status: 'emise', seller, buyer: { name: 'ACME', isCompany: true }, due_date: '2026-11-18' });
    expect(m[0]).toBe('Paiement à régler avant le 18/11/2026.');
    expect(m).toContain('Règlement par virement : IBAN FR76 1234 · BIC AGRIFRPP.');
    expect(m).toContain('Pas d’escompte pour paiement anticipé.');
    expect(m.some((s) => s.includes('L441-10'))).toBe(true);
    expect(m.at(-1)).toBe('Catégorie de l’opération : prestation de services.');
  });

  it('particulier : pas de pénalités ; avoir : pas de conditions de paiement', () => {
    const p = invoiceMentions({ kind: 'facture', status: 'emise', seller: { name: 'X' }, buyer: { name: 'Jean' }, due_date: null });
    expect(p).toEqual(['Paiement à réception.', 'Pas d’escompte pour paiement anticipé.', 'Catégorie de l’opération : prestation de services.']);
    expect(invoiceMentions({ kind: 'avoir', status: 'emise', seller, buyer: { name: 'ACME', isCompany: true }, due_date: null }))
      .toEqual(['Catégorie de l’opération : prestation de services.']);
  });

  it('dates au format français', () => {
    expect(frDate('2026-01-05')).toBe('05/01/2026');
    expect(frDate(null)).toBe('');
  });
});
