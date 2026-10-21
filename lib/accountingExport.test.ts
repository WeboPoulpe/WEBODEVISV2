import { describe, expect, it } from 'vitest';
import {
  ACCOUNTING_ACCOUNTS, accountsError, accountsFrom, customerAuxAccount, isDefaultAccounts, documentsCsv, fecEntries, fecFileName, fecText, isBalanced, paymentsCsv,
  periodDates, sirenOf, type AccountingAccounts, type ExportDocument, type ExportPayment,
} from './accountingExport';
import { invoiceTotals } from './invoices';

const doc = (over: Partial<ExportDocument> & Pick<ExportDocument, 'number' | 'vat_breakdown'>): ExportDocument => {
  const ht = over.vat_breakdown.reduce((s, r) => s + r.base, 0);
  const vat = over.vat_breakdown.reduce((s, r) => s + r.vat, 0);
  return {
    kind: 'facture', status: 'emise', issue_date: '2026-10-05', due_date: '2026-11-04', buyer_name: 'Élodie Dupont',
    total_ht: ht, total_vat: vat, total_ttc: Math.round((ht + vat) * 100) / 100, paid: 0, credited_number: null, quote_number: 'D-2026-0012',
    ...over,
  };
};

// Facture multi-taux : repas à 10 %, location de vaisselle à 20 %.
const multi = doc({ number: 'F-2026-0001', vat_breakdown: invoiceTotals([
  { label: 'Repas', quantity: 40, unitPrice: 32.5, vatRate: 10 },
  { label: 'Vaisselle', quantity: 40, unitPrice: 3.33, vatRate: 20 },
]).byRate, paid: 500 });
const credit = doc({
  number: 'AV-2026-0001', kind: 'avoir', issue_date: '2026-10-20', due_date: null, credited_number: 'F-2026-0001',
  vat_breakdown: [{ rate: 20, base: -133.2, vat: -26.64 }, { rate: 10, base: -1300, vat: -130 }],
});
const payment: ExportPayment = { paid_on: '2026-10-10', amount: 500, method: 'virement', note: 'Réf; 42', invoice_number: 'F-2026-0001', buyer_name: 'Élodie Dupont' };

describe('période', () => {
  it('mois, mois précédent (janvier → décembre), trimestres et années', () => {
    expect(periodDates('mois', '2026-02-14')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodDates('mois_precedent', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodDates('trimestre', '2026-08-01')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodDates('trimestre_precedent', '2026-02-01')).toEqual({ from: '2025-10-01', to: '2025-12-31' });
    expect(periodDates('annee_precedente', '2026-10-20')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(periodDates('mois', '2028-02-03').to).toBe('2028-02-29');
  });
});

describe('CSV pour Excel', () => {
  it('factures et avoirs : BOM, point-virgule, virgule décimale, une colonne par taux', () => {
    const csv = documentsCsv([multi, credit]);
    expect(csv.startsWith('﻿Date;N°;Type;Client;Total HT;HT 20 %;TVA 20 %;HT 10 %;TVA 10 %;Total TVA;Total TTC;Statut;Réglé;Reste à payer;Échéance;Facture d’origine;N° de devis\r\n')).toBe(true);
    const [, l1, l2] = csv.slice(1).trim().split('\r\n');
    expect(l1).toBe('05/10/2026;F-2026-0001;Facture;Élodie Dupont;1433,20;133,20;26,64;1300,00;130,00;156,64;1589,84;À encaisser;500,00;1089,84;04/11/2026;;D-2026-0012');
    expect(l2).toBe('20/10/2026;AV-2026-0001;Avoir;Élodie Dupont;-1433,20;-133,20;-26,64;-1300,00;-130,00;-156,64;-1589,84;Émis;;;;F-2026-0001;D-2026-0012');
  });

  it('taux absent d’un document : cases vides, et 5,5 % écrit à la française', () => {
    const csv = documentsCsv([multi, doc({ number: 'F-2026-0002', vat_breakdown: [{ rate: 5.5, base: 100, vat: 5.5 }] })]);
    expect(csv).toContain(';HT 5,5 %;TVA 5,5 %;');
    expect(csv.trim().split('\r\n')[2]).toContain(';100,00;;;;;100,00;5,50;');
  });

  it('paiements : moyen en clair, note protégée par des guillemets', () => {
    expect(paymentsCsv([payment]).slice(1)).toBe('Date;Montant;Moyen de paiement;Facture;Client;Note\r\n10/10/2026;500,00;Virement;F-2026-0001;Élodie Dupont;"Réf; 42"\r\n');
  });
});

describe('FEC', () => {
  const entries = fecEntries([credit, multi], [payment]);

  it('chaque écriture est équilibrée, y compris avec des arrondis par taux', () => {
    // 3 lignes à 0,333 € HT à 20 % : TVA arrondie par taux, TTC = somme exacte des lignes.
    const odd = doc({ number: 'F-2026-0003', vat_breakdown: invoiceTotals([
      { label: 'A', quantity: 3, unitPrice: 0.333, vatRate: 20 },
      { label: 'B', quantity: 7, unitPrice: 1.115, vatRate: 5.5 },
      { label: 'C', quantity: 1, unitPrice: 19.99, vatRate: 10 },
    ]).byRate });
    const all = fecEntries([multi, credit, odd], [payment, { ...payment, amount: 0.01, paid_on: '2026-10-11' }]);
    expect(all.length).toBe(5);
    for (const e of all) expect(isBalanced(e)).toBe(true);
  });

  it('vente : client au débit TTC, prestations et TVA au crédit par taux', () => {
    const sale = entries.find((e) => e.pieceRef === 'F-2026-0001' && e.journal === 'VE')!;
    expect(sale.lines).toEqual([
      { account: '411000', accountLabel: 'Clients', auxNum: 'CELODIEDUPONT', auxLabel: 'Élodie Dupont', debit: 1589.84, credit: 0 },
      { account: ACCOUNTING_ACCOUNTS.sales[20], accountLabel: 'Prestations de services TVA 20 %', debit: 0, credit: 133.2 },
      { account: ACCOUNTING_ACCOUNTS.sales[10], accountLabel: 'Prestations de services TVA 10 %', debit: 0, credit: 1300 },
      { account: ACCOUNTING_ACCOUNTS.vat[20], accountLabel: 'TVA collectée 20 %', debit: 0, credit: 26.64 },
      { account: ACCOUNTING_ACCOUNTS.vat[10], accountLabel: 'TVA collectée 10 %', debit: 0, credit: 130 },
    ]);
  });

  it('avoir : les sens s’inversent', () => {
    const av = entries.find((e) => e.pieceRef === 'AV-2026-0001')!;
    expect(av.lines[0]).toMatchObject({ account: '411000', debit: 0, credit: 1589.84 });
    expect(av.lines.slice(1).every((l) => l.debit > 0 && l.credit === 0)).toBe(true);
  });

  it('paiement : banque au débit, client au crédit, journal BQ', () => {
    const bq = entries.find((e) => e.journal === 'BQ')!;
    expect(bq.lines).toMatchObject([{ account: '512000', debit: 500, credit: 0 }, { account: '411000', auxNum: 'CELODIEDUPONT', debit: 0, credit: 500 }]);
  });

  it('ordre chronologique et numérotation continue par journal', () => {
    expect(entries.map((e) => `${e.num} ${e.date}`)).toEqual(['VE000001 2026-10-05', 'BQ000001 2026-10-10', 'VE000002 2026-10-20']);
  });

  it('facture sans TVA (franchise) : pas de ligne de TVA à zéro', () => {
    const [e] = fecEntries([doc({ number: 'F-1', vat_breakdown: [{ rate: 0, base: 250, vat: 0 }] })], []);
    expect(e.lines.map((l) => l.account)).toEqual(['411000', ACCOUNTING_ACCOUNTS.sales[0]]);
  });

  it('fichier : 18 colonnes tabulées, dates AAAAMMJJ, montants à virgule', () => {
    const rows = fecText(entries).replace(/\r\n$/, '').split('\r\n').map((r) => r.split('\t'));
    expect(rows[0]).toEqual(['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
      'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise']);
    expect(rows.every((r) => r.length === 18)).toBe(true);
    expect(rows[1]).toEqual(['VE', 'Journal des ventes', 'VE000001', '20261005', '411000', 'Clients', 'CELODIEDUPONT', 'Élodie Dupont',
      'F-2026-0001', '20261005', 'Facture F-2026-0001 Élodie Dupont', '1589,84', '0,00', '', '', '20261005', '', '']);
    expect(rows.length).toBe(1 + 5 + 2 + 5);
  });

  it('nom du fichier : SIREN + FEC + date de clôture', () => {
    expect(sirenOf('123 456 789 00012')).toBe('123456789');
    expect(sirenOf('12345')).toBeNull();
    expect(fecFileName('123456789', '2026-12-31')).toBe('123456789FEC20261231.txt');
    expect(fecFileName(null, '2026-12-31')).toBe('SIRENFEC20261231.txt');
  });

  it('compte client tiré du nom, sans accents ni espaces', () => {
    expect(customerAuxAccount('Mairie de Saint-Lyé')).toBe('CMAIRIEDESAINTLYE');
    expect(customerAuxAccount('  ')).toBe('CCLIENT');
  });
});

describe('comptes réglables', () => {
  const custom: AccountingAccounts = {
    ...ACCOUNTING_ACCOUNTS,
    customers: '41100000', bank: '51210000', cash: '53100000',
    sales: { ...ACCOUNTING_ACCOUNTS.sales, '20': '70610000', '10': '70620000', autre: '70690000' },
    vat: { ...ACCOUNTING_ACCOUNTS.vat, '20': '44571200', '10': '44571100' },
    salesJournal: { code: 'VT', label: 'Ventes' }, bankJournal: { code: 'BNP', label: 'Banque BNP' }, cashJournal: { code: 'CAI', label: 'Caisse' },
    auxPerCustomer: false,
  };

  it('l’export utilise les comptes et journaux de l’entreprise, toujours équilibré', () => {
    const odd = doc({ number: 'F-9', vat_breakdown: [{ rate: 8.5, base: 99.99, vat: 8.5 }] });
    const all = fecEntries([multi, credit, odd], [payment, { ...payment, method: 'especes', paid_on: '2026-10-12' }], custom);
    expect(all.every(isBalanced)).toBe(true);
    const sale = all.find((e) => e.pieceRef === 'F-2026-0001' && e.journal === 'VT')!;
    expect(sale.num).toBe('VT000001');
    expect(sale.lines.map((l) => l.account)).toEqual(['41100000', '70610000', '70620000', '44571200', '44571100']);
    // Sans compte auxiliaire : rien dans CompAuxNum / CompAuxLib.
    expect(sale.lines[0].auxNum).toBeUndefined();
    expect(all.find((e) => e.pieceRef === 'F-9')!.lines.map((l) => l.account)).toEqual(['41100000', '70690000', ACCOUNTING_ACCOUNTS.vat.autre]);
    const [bank, cash] = all.filter((e) => e.label.startsWith('Règlement'));
    expect(bank).toMatchObject({ journal: 'BNP', journalLabel: 'Banque BNP', num: 'BNP000001' });
    expect(bank.lines[0].account).toBe('51210000');
    expect(cash).toMatchObject({ journal: 'CAI', num: 'CAI000001' });
    expect(cash.lines[0]).toMatchObject({ account: '53100000', accountLabel: 'Caisse', debit: 500 });
    const row = fecText(all).split('\r\n')[1].split('\t');
    expect(row.slice(0, 8)).toEqual(['VT', 'Ventes', 'VT000001', '20261005', '41100000', 'Clients', '', '']);
  });

  it('paiement en espèces avec les comptes standards : caisse 530000, journal CA', () => {
    const [e] = fecEntries([], [{ ...payment, method: 'especes' }]);
    expect(e).toMatchObject({ journal: 'CA', num: 'CA000001' });
    expect(e.lines.map((l) => l.account)).toEqual(['530000', '411000']);
  });

  it('valeurs enregistrées illisibles ou absentes : comptes standards, champ par champ', () => {
    expect(accountsFrom(null)).toEqual(ACCOUNTING_ACCOUNTS);
    expect(accountsFrom({ customers: '411ABC', bank: '401000', sales: { '20': '706 1' }, salesJournal: { code: 'v t', label: '' }, auxPerCustomer: false }))
      .toEqual({ ...ACCOUNTING_ACCOUNTS, sales: { ...ACCOUNTING_ACCOUNTS.sales, '20': '7061' }, auxPerCustomer: false });
    expect(isDefaultAccounts(accountsFrom({}))).toBe(true);
    expect(isDefaultAccounts(custom)).toBe(false);
  });

  it('vérification de la saisie : chiffres, longueur, classe, journaux', () => {
    expect(accountsError(ACCOUNTING_ACCOUNTS)).toBeNull();
    expect(accountsError(custom)).toBeNull();
    expect(accountsError({ ...custom, customers: '41A' })).toMatch(/Compte clients : un numéro de 3 à 12 chiffres/);
    expect(accountsError({ ...custom, bank: '1234567890123' })).toMatch(/banque/);
    expect(accountsError({ ...custom, sales: { ...custom.sales, '10': '606000' } })).toMatch(/Prestations \(TVA 10 %\).*commence par 7/);
    expect(accountsError({ ...custom, bankJournal: { code: 'VT', label: 'x' } })).toMatch(/propre code/);
    expect(accountsError({ ...custom, cashJournal: { code: 'BNP', label: 'Autre' } })).toMatch(/même libellé/);
    expect(accountsError({ ...custom, cashJournal: { code: 'BNP', label: 'Banque BNP' } })).toBeNull();
    expect(accountsError({ ...custom, salesJournal: { code: 'VT', label: ' ' } })).toMatch(/libellé/);
  });
});
