import { describe, expect, it } from 'vitest';
import { addDays, balanceLines, creditLines, depositLines, invoiceTotals, linesFromQuote, paymentStatus } from './invoices';
import { quoteTotalTTC } from './quoteTotals';

const quote = {
  vat_rate: 10,
  guest_count: 50,
  services: [
    { name: 'Menu mariage', quantity: 50, unitPrice: 45 },               // 2 250 HT à 10 %
    { name: 'Champagne', quantity: 20, unitPrice: 30, vatRate: 20 },     // 600 HT à 20 %
    { name: 'Mise en place', quantity: 1, unitPrice: 0, isFree: true },  // offert
    { name: 'Animation', quantity: 1, unitPrice: 300, isOption: true },  // option non retenue
    { name: '', isPageBreak: true, quantity: 0, unitPrice: 0 },
  ],
};

describe('lignes d’une facture', () => {
  it('reprend les lignes facturables du devis, au même total', () => {
    const lines = linesFromQuote(quote);
    expect(lines.map((l) => l.label)).toEqual(['Menu mariage', 'Champagne']);
    const t = invoiceTotals(lines);
    expect(t).toMatchObject({ ht: 2850, vat: 345, ttc: 3195 });
    expect(t.ttc).toBeCloseTo(quoteTotalTTC({ ...quote, total_amount: null })!, 2);
  });

  it('sépare adultes et enfants pour un prix enfant', () => {
    const lines = linesFromQuote({ vat_rate: 10, guest_count: 30, guest_count_children: 10, services: [{ name: 'Buffet', quantity: 30, unitPrice: 40, childUnitPrice: 15 }] });
    expect(lines).toEqual([
      { label: 'Buffet (adultes)', quantity: 20, unitPrice: 40, vatRate: 10 },
      { label: 'Buffet (enfants)', quantity: 10, unitPrice: 15, vatRate: 10 },
    ]);
  });
});

describe('acompte, solde, avoir', () => {
  const lines = linesFromQuote(quote);

  it('répartit l’acompte sur chaque taux', () => {
    const dep = depositLines(lines, { percent: 30, quoteNumber: 'D-2026-0007' });
    expect(dep).toHaveLength(2);
    expect(dep[0]).toMatchObject({ unitPrice: 180, vatRate: 20 });
    expect(dep[1]).toMatchObject({ unitPrice: 675, vatRate: 10 });
    expect(dep[0].label).toContain('Acompte de 30 % sur le devis n° D-2026-0007');
    expect(invoiceTotals(dep).ttc).toBeCloseTo(3195 * 0.3, 2);
  });

  it('convertit un montant TTC en pourcentage', () => {
    expect(invoiceTotals(depositLines(lines, { amountTTC: 1000 })).ttc).toBeCloseTo(1000, 1);
  });

  it('déduit les acomptes déjà facturés du solde', () => {
    const dep = invoiceTotals(depositLines(lines, { percent: 30 }));
    const bal = balanceLines(lines, [{ number: 'F-2026-0001', byRate: dep.byRate }]);
    const t = invoiceTotals(bal);
    expect(t.ttc).toBeCloseTo(3195 - dep.ttc, 2);
    expect(bal.at(-1)!.label).toContain('F-2026-0001');
  });

  it('un avoir annule exactement la facture', () => {
    const t = invoiceTotals(creditLines(lines, 'F-2026-0002'));
    expect(t).toMatchObject({ ht: -2850, vat: -345, ttc: -3195 });
  });
});

describe('encaissements et échéance', () => {
  it('suit les paiements', () => {
    expect(paymentStatus(100, 0)).toBe('emise');
    expect(paymentStatus(100, 40)).toBe('payee_partiellement');
    expect(paymentStatus(100, 100)).toBe('payee');
  });

  it('calcule l’échéance', () => {
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
  });
});
