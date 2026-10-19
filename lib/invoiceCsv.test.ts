import { describe, expect, it } from 'vitest';
import { invoicesCsv } from './invoiceCsv';

describe('export CSV des factures', () => {
  it('séparateur point-virgule, décimales à virgule, BOM pour Excel', () => {
    const csv = invoicesCsv([
      { number: 'F-2026-0001', kind: 'acompte', status: 'emise', issue_date: '2026-10-19', due_date: '2026-11-18', buyer: { name: 'Dupont; fils' }, total_ht: 800, total_vat: 158.5, total_ttc: 958.5, paid: 0 },
      { number: null, kind: 'facture', status: 'brouillon', issue_date: null, due_date: null, buyer: { name: 'Jean "Jo"' }, total_ht: 10, total_vat: 2, total_ttc: 12, paid: 0 },
    ], (i) => i.status);
    expect(csv.startsWith('﻿N°;Type;Date;Échéance;Client;HT;TVA;TTC;Payé;Statut\r\n')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[1]).toBe('F-2026-0001;Facture d’acompte;19/10/2026;18/11/2026;"Dupont; fils";800,00;158,50;958,50;0,00;emise');
    expect(lines[2]).toBe('Brouillon;Facture;;;"Jean ""Jo""";10,00;2,00;12,00;0,00;brouillon');
  });
});
