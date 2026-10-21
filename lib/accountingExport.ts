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
// valeurs courantes du plan comptable général, que l'entreprise remplace par les siens dans Paramètres > Comptabilité.

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

/** Taux de TVA proposés, avec un compte chacun ; « autre » pour tout autre taux. */
export const ACCOUNT_RATES = ['20', '10', '5.5', '2.1', '0', 'autre'] as const;
export type AccountRate = typeof ACCOUNT_RATES[number];
/** Taux qui ont un compte de TVA collectée (à 0 %, il n'y a pas de TVA). */
export const VAT_ACCOUNT_RATES = ['20', '10', '5.5', '2.1', 'autre'] as const;
export type VatAccountRate = typeof VAT_ACCOUNT_RATES[number];

export interface Journal { code: string; label: string }

/** Comptes et journaux du FEC, réglables dans Paramètres > Comptabilité (profiles.accounting_settings). */
export interface AccountingAccounts {
  salesJournal: Journal;
  bankJournal: Journal;
  /** Paiements en espèces : journal et compte de caisse. */
  cashJournal: Journal;
  customers: string;
  bank: string;
  cash: string;
  /** Prestations de services, par taux de TVA. */
  sales: Record<AccountRate, string>;
  /** TVA collectée, par taux. */
  vat: Record<VatAccountRate, string>;
  /** Un compte auxiliaire par client (C + nom) sur les lignes du compte clients. */
  auxPerCustomer: boolean;
}

/**
 * Comptes standards du plan comptable général, utilisés tant que l'entreprise n'a rien réglé.
 * Ventes et TVA collectée : un compte par taux, pour préparer la déclaration de TVA.
 */
export const ACCOUNTING_ACCOUNTS: AccountingAccounts = {
  salesJournal: { code: 'VE', label: 'Journal des ventes' },
  bankJournal: { code: 'BQ', label: 'Journal de banque' },
  cashJournal: { code: 'CA', label: 'Journal de caisse' },
  customers: '411000',
  bank: '512000',
  cash: '530000',
  sales: { '20': '706200', '10': '706100', '5.5': '706055', '2.1': '706021', '0': '706000', autre: '706900' },
  vat: { '20': '4457120', '10': '4457110', '5.5': '4457105', '2.1': '4457102', autre: '4457100' },
  auxPerCustomer: true,
};

/** Clé du taux dans les tableaux de comptes : 5.5 → « 5.5 », un taux non prévu → « autre ». */
export function accountRate(rate: number): AccountRate {
  const key = String(cents(rate));
  return (ACCOUNT_RATES as readonly string[]).includes(key) ? key as AccountRate : 'autre';
}

/** Compte de TVA collectée d'un taux (un taux à 0 % n'en a pas : il tombe sur « autre »). */
const vatRate = (rate: number): VatAccountRate => {
  const key = accountRate(rate);
  return key === '0' ? 'autre' : key;
};

/** Numéro de compte : chiffres seulement, de 3 à 12. */
const ACCOUNT_RE = /^\d{3,12}$/;
const JOURNAL_RE = /^[A-Z0-9]{1,6}$/;
/** Classe attendue du plan comptable, par compte (premier chiffre). */
const CLASS = { customers: '4', bank: '5', cash: '5', sales: '7', vat: '4' } as const;

const str = (v: unknown) => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim();
const accountOk = (s: string, cls: string) => ACCOUNT_RE.test(s) && s.startsWith(cls);
const account = (v: unknown, fallback: string, cls: string) => {
  const s = str(v).replace(/\s/g, '');
  return accountOk(s, cls) ? s : fallback;
};
const journal = (v: unknown, fallback: Journal): Journal => {
  const j = (v && typeof v === 'object' ? v : {}) as Partial<Journal>;
  const code = str(j.code).toUpperCase();
  const label = str(j.label).slice(0, 60);
  return { code: JOURNAL_RE.test(code) ? code : fallback.code, label: label || fallback.label };
};

/** Comptes enregistrés, complétés champ par champ par les comptes standards (valeur absente ou illisible). */
export function accountsFrom(stored: unknown): AccountingAccounts {
  const d = ACCOUNTING_ACCOUNTS;
  if (!stored || typeof stored !== 'object') return d;
  const s = stored as Record<string, unknown>;
  const sales = (s.sales && typeof s.sales === 'object' ? s.sales : {}) as Record<string, unknown>;
  const vat = (s.vat && typeof s.vat === 'object' ? s.vat : {}) as Record<string, unknown>;
  return {
    salesJournal: journal(s.salesJournal, d.salesJournal),
    bankJournal: journal(s.bankJournal, d.bankJournal),
    cashJournal: journal(s.cashJournal, d.cashJournal),
    customers: account(s.customers, d.customers, CLASS.customers),
    bank: account(s.bank, d.bank, CLASS.bank),
    cash: account(s.cash, d.cash, CLASS.cash),
    sales: Object.fromEntries(ACCOUNT_RATES.map((r) => [r, account(sales[r], d.sales[r], CLASS.sales)])) as Record<AccountRate, string>,
    vat: Object.fromEntries(VAT_ACCOUNT_RATES.map((r) => [r, account(vat[r], d.vat[r], CLASS.vat)])) as Record<VatAccountRate, string>,
    auxPerCustomer: typeof s.auxPerCustomer === 'boolean' ? s.auxPerCustomer : d.auxPerCustomer,
  };
}

/** « 5.5 » → « TVA 5,5 % », « autre » → « autre taux ». */
export const accountRateLabel = (r: AccountRate) => (r === 'autre' ? 'autre taux' : `TVA ${r.replace('.', ',')} %`);

/** Vérifie des comptes saisis : le premier problème à afficher, ou null s'ils sont bons. */
export function accountsError(a: AccountingAccounts): string | null {
  const check = (v: string, cls: string, what: string) => {
    const s = (v ?? '').replace(/\s/g, '');
    if (!ACCOUNT_RE.test(s)) return `${what} : un numéro de 3 à 12 chiffres, sans lettre.`;
    if (!s.startsWith(cls)) return `${what} : dans le plan comptable, ce numéro commence par ${cls}.`;
    return null;
  };
  const code = (j: Journal) => (j.code ?? '').trim().toUpperCase();
  const errors: (string | null)[] = [
    check(a.customers, CLASS.customers, 'Compte clients'),
    ...ACCOUNT_RATES.map((r) => check(a.sales[r], CLASS.sales, `Prestations (${accountRateLabel(r)})`)),
    ...VAT_ACCOUNT_RATES.map((r) => check(a.vat[r], CLASS.vat, `TVA collectée (${accountRateLabel(r)})`)),
    check(a.bank, CLASS.bank, 'Compte de banque'),
    check(a.cash, CLASS.cash, 'Compte de caisse'),
  ];
  for (const j of [a.salesJournal, a.bankJournal, a.cashJournal]) {
    if (!JOURNAL_RE.test(code(j))) errors.push('Code de journal : 1 à 6 lettres ou chiffres, sans espace.');
    if (!str(j.label)) errors.push('Donnez un libellé à chaque journal.');
  }
  if (code(a.salesJournal) === code(a.bankJournal) || code(a.salesJournal) === code(a.cashJournal)) {
    errors.push('Le journal des ventes doit avoir son propre code.');
  }
  if (code(a.bankJournal) === code(a.cashJournal) && str(a.bankJournal.label) !== str(a.cashJournal.label)) {
    errors.push('Banque et caisse partagent le même code de journal : donnez-leur le même libellé.');
  }
  return errors.find((e) => e) ?? null;
}

/** Les comptes sont-ils les comptes standards ? */
export const isDefaultAccounts = (a: AccountingAccounts) => JSON.stringify(accountsFrom(a)) === JSON.stringify(ACCOUNTING_ACCOUNTS);

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
  /** Code du journal : ventes (VE), banque (BQ) ou caisse (CA) par défaut. */
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
 * (par taux). Un avoir a des montants négatifs : les sens s'inversent d'eux-mêmes. Paiement : banque (ou caisse
 * pour les espèces) au débit, client au crédit. Écritures dans l'ordre des dates, numérotées sans trou dans chaque journal.
 */
export function fecEntries(docs: readonly ExportDocument[], payments: readonly ExportPayment[], accounts: AccountingAccounts = ACCOUNTING_ACCOUNTS): FecEntry[] {
  const customer = (name: string): Omit<FecLine, 'debit' | 'credit'> => (accounts.auxPerCustomer
    ? { account: accounts.customers, accountLabel: 'Clients', auxNum: customerAuxAccount(name), auxLabel: name }
    : { account: accounts.customers, accountLabel: 'Clients' });
  // rank : à date égale, les ventes passent avant les règlements.
  const draft: (Omit<FecEntry, 'num'> & { rank: number })[] = [];

  for (const d of docs) {
    const sales = d.vat_breakdown.map((r) => line({ account: accounts.sales[accountRate(r.rate)], accountLabel: `Prestations de services TVA ${pct(r.rate)}` }, r.base, 'credit'));
    const vat = d.vat_breakdown.map((r) => line({ account: accounts.vat[vatRate(r.rate)], accountLabel: `TVA collectée ${pct(r.rate)}` }, r.vat, 'credit'));
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
    // Espèces : journal et compte de caisse ; les autres moyens passent par la banque.
    const cash = p.method === 'especes';
    const j = cash ? accounts.cashJournal : accounts.bankJournal;
    const lines = [
      line(cash ? { account: accounts.cash, accountLabel: 'Caisse' } : { account: accounts.bank, accountLabel: 'Banque' }, p.amount, 'debit'),
      line(customer(p.buyer_name), p.amount, 'credit'),
    ].filter((l): l is FecLine => !!l);
    if (lines.length === 0) continue;
    draft.push({
      journal: j.code, journalLabel: j.label, rank: 1, date: p.paid_on, pieceRef: p.invoice_number,
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
