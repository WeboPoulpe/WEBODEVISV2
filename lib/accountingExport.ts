// ═══════════════════════════════════════════════════════════════════════════
// Export comptable : factures, avoirs et paiements en CSV (Excel) ou au format FEC
// ═══════════════════════════════════════════════════════════════════════════
// Fonctions pures, sans accès à la base (la lecture est dans server/accountingExport.ts).
//
// CSV pour Excel (version française) : séparateur « ; », décimales à virgule, dates JJ/MM/AAAA, marque BOM UTF-8
// en tête pour que les accents s'affichent correctement.
//
// FEC (fichier des écritures comptables, art. A47 A-1 du livre des procédures fiscales) : texte tabulé,
// 18 colonnes, dates AAAAMMJJ, montants à virgule. Une écriture par facture ou avoir dans le journal des ventes,
// une écriture par paiement dans le journal de banque. Les comptes sont ceux de ACCOUNTING_ACCOUNTS : des
// valeurs courantes du plan comptable général, que le comptable peut renommer à l'import.

import { cents, INVOICE_KIND_LABELS, INVOICE_STATUS_LABELS, PAYMENT_METHODS, type InvoiceKind, type InvoiceStatus, type PaymentMethod, type RateTotal } from './invoices';
import { frDate } from './invoiceMentions';

/** Facture ou avoir émis, tel qu'il part chez le comptable. Les montants d'un avoir sont négatifs. */
export interface ExportDocument {
  number: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  buyer_name: string;
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  vat_breakdown: RateTotal[];
  /** Total encaissé à ce jour sur la facture. */
  paid: number;
  credited_number: string | null;
  quote_number: string | null;
}

export interface ExportPayment {
  paid_on: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  invoice_number: string;
  buyer_name: string;
}

// ── Période ──────────────────────────────────────────────────────────────────

export type PeriodPreset = 'mois' | 'mois_precedent' | 'trimestre' | 'trimestre_precedent' | 'annee' | 'annee_precedente';

export const PERIOD_LABELS: Record<PeriodPreset | 'libre', string> = {
  mois: 'Mois en cours',
  mois_precedent: 'Mois précédent',
  trimestre: 'Trimestre en cours',
  trimestre_precedent: 'Trimestre précédent',
  annee: 'Année en cours',
  annee_precedente: 'Année précédente',
  libre: 'Dates libres',
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** Dernier jour du mois m (1 à 12). */
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Premier et dernier jour de la période, d'après la date du jour (AAAA-MM-JJ). */
export function periodDates(preset: PeriodPreset, today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const month = (yy: number, mm: number) => ({ from: iso(yy, mm, 1), to: iso(yy, mm, lastDay(yy, mm)) });
  const quarter = (yy: number, q: number) => ({ from: iso(yy, q * 3 + 1, 1), to: iso(yy, q * 3 + 3, lastDay(yy, q * 3 + 3)) });
  const q = Math.floor((m - 1) / 3);
  switch (preset) {
    case 'mois': return month(y, m);
    case 'mois_precedent': return m === 1 ? month(y - 1, 12) : month(y, m - 1);
    case 'trimestre': return quarter(y, q);
    case 'trimestre_precedent': return q === 0 ? quarter(y - 1, 3) : quarter(y, q - 1);
    case 'annee': return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    case 'annee_precedente': return { from: iso(y - 1, 1, 1), to: iso(y - 1, 12, 31) };
  }
}

export const isIsoDate = (s: string | null | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

// ── CSV ──────────────────────────────────────────────────────────────────────

const amount = (n: number) => cents(n).toFixed(2).replace('.', ',');
const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = (rows: string[][]) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
/** 5.5 → « 5,5 » */
const rateLabel = (rate: number) => rate.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Libellé du statut : un avoir émis n'est pas « à encaisser », il est simplement « Émis ». */
export function documentStatusLabel(kind: InvoiceKind, status: InvoiceStatus): string {
  if (kind === 'avoir' && status !== 'brouillon') return 'Émis';
  return INVOICE_STATUS_LABELS[status] ?? status;
}

/** Reste à payer : rien sur un avoir ni sur une facture annulée par avoir. */
export function remainingOf(d: Pick<ExportDocument, 'kind' | 'status' | 'total_ttc' | 'paid'>): number {
  if (d.kind === 'avoir' || d.status === 'annulee') return 0;
  return Math.max(0, cents(d.total_ttc - d.paid));
}

/** Factures et avoirs, une ligne par document, avec une colonne HT et une colonne TVA par taux rencontré. */
export function documentsCsv(docs: readonly ExportDocument[]): string {
  const rates = [...new Set(docs.flatMap((d) => d.vat_breakdown.map((r) => r.rate)))].sort((a, b) => b - a);
  const head = [
    'Date', 'N°', 'Type', 'Client', 'Total HT',
    ...rates.flatMap((r) => [`HT ${rateLabel(r)} %`, `TVA ${rateLabel(r)} %`]),
    'Total TVA', 'Total TTC', 'Statut', 'Réglé', 'Reste à payer', 'Échéance', 'Facture d’origine', 'N° de devis',
  ];
  const rows = docs.map((d) => {
    const byRate = (rate: number) => d.vat_breakdown.find((r) => r.rate === rate);
    const isCredit = d.kind === 'avoir';
    return [
      frDate(d.issue_date),
      d.number,
      INVOICE_KIND_LABELS[d.kind],
      d.buyer_name,
      amount(d.total_ht),
      ...rates.flatMap((r) => {
        const t = byRate(r);
        return t ? [amount(t.base), amount(t.vat)] : ['', ''];
      }),
      amount(d.total_vat),
      amount(d.total_ttc),
      documentStatusLabel(d.kind, d.status),
      isCredit ? '' : amount(d.paid),
      isCredit ? '' : amount(remainingOf(d)),
      isCredit ? '' : frDate(d.due_date),
      d.credited_number ?? '',
      d.quote_number ?? '',
    ];
  });
  return csv([head, ...rows]);
}

/** Paiements reçus, un par ligne. */
export function paymentsCsv(payments: readonly ExportPayment[]): string {
  const head = ['Date', 'Montant', 'Moyen de paiement', 'Facture', 'Client', 'Note'];
  const rows = payments.map((p) => [
    frDate(p.paid_on),
    amount(p.amount),
    PAYMENT_METHODS[p.method] ?? p.method,
    p.invoice_number,
    p.buyer_name,
    p.note ?? '',
  ]);
  return csv([head, ...rows]);
}

// ── FEC ──────────────────────────────────────────────────────────────────────

/**
 * Comptes utilisés dans le FEC. Valeurs par défaut du plan comptable général : le comptable peut les faire
 * correspondre aux siens à l'import (ils deviendront réglables dans Paramètres plus tard).
 * Ventes et TVA collectée : un compte par taux, pour préparer la déclaration de TVA.
 */
export const ACCOUNTING_ACCOUNTS = {
  salesJournal: { code: 'VE', label: 'Journal des ventes' },
  bankJournal: { code: 'BQ', label: 'Journal de banque' },
  customers: { num: '411000', label: 'Clients' },
  bank: { num: '512000', label: 'Banque' },
  /** Prestations de services, par taux de TVA. */
  sales: { 20: '706200', 10: '706100', 5.5: '706055', 2.1: '706021', 0: '706000' } as Record<number, string>,
  salesOther: '706900',
  /** TVA collectée, par taux. */
  vat: { 20: '4457120', 10: '4457110', 5.5: '4457105', 2.1: '4457102' } as Record<number, string>,
  vatOther: '4457100',
} as const;

export type AccountingAccounts = typeof ACCOUNTING_ACCOUNTS;

export const FEC_COLUMNS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
] as const;

export interface FecLine {
  account: string;
  accountLabel: string;
  auxNum?: string;
  auxLabel?: string;
  debit: number;
  credit: number;
}

export interface FecEntry {
  /** Code du journal : ventes (VE) ou banque (BQ) par défaut. */
  journal: string;
  journalLabel: string;
  /** Numéro d'écriture, continu dans chaque journal (VE000001, VE000002…). */
  num: string;
  date: string;
  pieceRef: string;
  label: string;
  lines: FecLine[];
}

/** Compte auxiliaire du client, tiré de son nom : « Mme Élodie Dupont » → « CMMEELODIEDUPONT ». */
export function customerAuxAccount(name: string): string {
  const code = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return `C${code || 'CLIENT'}`;
}

/** Une ligne au débit si le montant est positif, au crédit sinon (et l'inverse quand side vaut « credit »). */
function line(base: Omit<FecLine, 'debit' | 'credit'>, value: number, side: 'debit' | 'credit'): FecLine | null {
  const v = cents(value);
  if (v === 0) return null;
  const debit = (side === 'debit') === v > 0;
  return { ...base, debit: debit ? Math.abs(v) : 0, credit: debit ? 0 : Math.abs(v) };
}

const pct = (rate: number) => `${rateLabel(rate)} %`;

/**
 * Écritures du FEC. Vente : client au débit (TTC), prestations au crédit (HT par taux), TVA collectée au crédit
 * (par taux). Un avoir a des montants négatifs : les sens s'inversent d'eux-mêmes. Paiement : banque au débit,
 * client au crédit. Écritures dans l'ordre des dates, numérotées sans trou dans chaque journal.
 */
export function fecEntries(docs: readonly ExportDocument[], payments: readonly ExportPayment[], accounts: AccountingAccounts = ACCOUNTING_ACCOUNTS): FecEntry[] {
  const customer = (name: string) => ({ account: accounts.customers.num, accountLabel: accounts.customers.label, auxNum: customerAuxAccount(name), auxLabel: name });
  // rank : à date égale, les ventes passent avant les règlements.
  const draft: (Omit<FecEntry, 'num'> & { rank: number })[] = [];

  for (const d of docs) {
    const sales = d.vat_breakdown.map((r) => line({ account: accounts.sales[r.rate] ?? accounts.salesOther, accountLabel: `Prestations de services TVA ${pct(r.rate)}` }, r.base, 'credit'));
    const vat = d.vat_breakdown.map((r) => line({ account: accounts.vat[r.rate] ?? accounts.vatOther, accountLabel: `TVA collectée ${pct(r.rate)}` }, r.vat, 'credit'));
    // Le TTC du client est la somme exacte des lignes de vente et de TVA : l'écriture est équilibrée au centime.
    const ttc = cents(d.vat_breakdown.reduce((s, r) => s + cents(r.base) + cents(r.vat), 0));
    const lines = [line(customer(d.buyer_name), ttc, 'debit'), ...sales, ...vat].filter((l): l is FecLine => !!l);
    if (lines.length === 0) continue;
    draft.push({
      journal: accounts.salesJournal.code, journalLabel: accounts.salesJournal.label, rank: 0, date: d.issue_date, pieceRef: d.number,
      label: `${INVOICE_KIND_LABELS[d.kind]} ${d.number} ${d.buyer_name}`, lines,
    });
  }

  for (const p of payments) {
    const lines = [
      line({ account: accounts.bank.num, accountLabel: accounts.bank.label }, p.amount, 'debit'),
      line(customer(p.buyer_name), p.amount, 'credit'),
    ].filter((l): l is FecLine => !!l);
    if (lines.length === 0) continue;
    draft.push({
      journal: accounts.bankJournal.code, journalLabel: accounts.bankJournal.label, rank: 1, date: p.paid_on, pieceRef: p.invoice_number,
      label: `Règlement ${p.invoice_number} ${p.buyer_name} (${PAYMENT_METHODS[p.method] ?? p.method})`, lines,
    });
  }

  draft.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || a.pieceRef.localeCompare(b.pieceRef));
  const counters: Record<string, number> = {};
  return draft.map(({ rank: _rank, ...e }) => {
    counters[e.journal] = (counters[e.journal] ?? 0) + 1;
    return { ...e, num: `${e.journal}${String(counters[e.journal]).padStart(6, '0')}` };
  });
}

/** Débit = crédit, au centime. */
export function isBalanced(entry: FecEntry): boolean {
  const debit = cents(entry.lines.reduce((s, l) => s + l.debit, 0));
  const credit = cents(entry.lines.reduce((s, l) => s + l.credit, 0));
  return debit === credit;
}

/** « 2026-10-19 » → « 20261019 » */
export const fecDate = (isoDate: string) => isoDate.slice(0, 10).replace(/-/g, '');
/** Pas de tabulation ni de retour à la ligne dans un champ. */
const text = (v: string | null | undefined) => (v ?? '').replace(/[\t\r\n]+/g, ' ').trim();

/** Fichier FEC : ligne d'en-tête puis une ligne par ligne d'écriture, séparateur tabulation, fins de ligne CRLF. */
export function fecText(entries: readonly FecEntry[]): string {
  const rows: string[][] = [[...FEC_COLUMNS]];
  for (const e of entries) {
    for (const l of e.lines) {
      rows.push([
        e.journal,
        text(e.journalLabel),
        e.num,
        fecDate(e.date),
        l.account,
        text(l.accountLabel),
        text(l.auxNum),
        text(l.auxLabel),
        text(e.pieceRef),
        fecDate(e.date),
        text(e.label),
        amount(l.debit),
        amount(l.credit),
        '',
        '',
        fecDate(e.date),
        '',
        '',
      ]);
    }
  }
  return rows.map((r) => r.join('\t')).join('\r\n') + '\r\n';
}

/** SIREN : les 9 premiers chiffres du SIRET (ou le SIREN lui-même). Null s'il n'est pas renseigné. */
export function sirenOf(siret: string | null | undefined): string | null {
  const digits = (siret ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(0, 9) : null;
}

/** Nom imposé : SIREN + « FEC » + date de clôture (AAAAMMJJ). Sans SIREN, « SIREN » reste à remplacer. */
export function fecFileName(siren: string | null, closingDate: string): string {
  return `${siren ?? 'SIREN'}FEC${fecDate(closingDate)}.txt`;
}
