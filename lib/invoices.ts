// ═══════════════════════════════════════════════════════════════════════════
// Factures : calculs purs (lignes, totaux, acompte, solde, avoir)
// ═══════════════════════════════════════════════════════════════════════════
// Une facture émise est un instantané figé : ses lignes et ses totaux sont recopiés à l'émission et ne
// dépendent plus du devis. Règle française : la TVA est calculée par taux, sur le total HT de ce taux,
// arrondie au centime.

import { lineTotalHT, lineVatRate, resolveGuestSplit, type VatLine } from './quoteTotals';
import { quoteLines } from './quoteFormulas';

export type InvoiceKind = 'acompte' | 'solde' | 'facture' | 'avoir';
export type InvoiceStatus = 'brouillon' | 'emise' | 'payee_partiellement' | 'payee' | 'annulee';

export const INVOICE_KIND_LABELS: Record<InvoiceKind, string> = {
  acompte: 'Facture d’acompte',
  solde: 'Facture de solde',
  facture: 'Facture',
  avoir: 'Avoir',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  brouillon: 'Brouillon',
  emise: 'À encaisser',
  payee_partiellement: 'Payée en partie',
  payee: 'Payée',
  annulee: 'Annulée par avoir',
};

export const PAYMENT_METHODS = { virement: 'Virement', cheque: 'Chèque', especes: 'Espèces', carte: 'Carte', autre: 'Autre' } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export interface InvoiceLine {
  label: string;
  description?: string | null;
  quantity: number;
  /** Prix unitaire HT (négatif pour une déduction ou un avoir). */
  unitPrice: number;
  vatRate: number;
}

export interface RateTotal { rate: number; base: number; vat: number }
export interface InvoiceTotals { ht: number; vat: number; ttc: number; byRate: RateTotal[] }

export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const lineHT = (l: Pick<InvoiceLine, 'quantity' | 'unitPrice'>) => cents(l.quantity * l.unitPrice);

/** Totaux ventilés par taux, du plus élevé au plus bas. */
export function invoiceTotals(lines: readonly InvoiceLine[]): InvoiceTotals {
  const bases = new Map<number, number>();
  for (const l of lines) bases.set(l.vatRate, cents((bases.get(l.vatRate) ?? 0) + lineHT(l)));
  const byRate = [...bases.entries()]
    .filter(([, base]) => base !== 0)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base, vat: cents(base * rate / 100) }));
  const ht = cents(byRate.reduce((s, r) => s + r.base, 0));
  const vat = cents(byRate.reduce((s, r) => s + r.vat, 0));
  return { ht, vat, ttc: cents(ht + vat), byRate };
}

interface QuoteForInvoice {
  services: unknown;
  vat_rate: number | string | null;
  guest_count?: number | null;
  guest_count_adults?: number | null;
  guest_count_children?: number | null;
  /** Formules du devis : seules la formule retenue et les lignes communes sont facturées. */
  formulas?: unknown;
  chosen_formula_id?: string | null;
}

type QuoteServiceLine = VatLine & { name?: string; description?: string | null };

const defaultRate = (v: number | string | null) => {
  const n = v == null || v === '' ? 20 : Number(v);
  return Number.isFinite(n) ? n : 20;
};

/** Lignes facturables d'un devis : sans les lignes retirées, offertes, en option ni les sauts de page, ni celles des formules non retenues. */
export function linesFromQuote(quote: QuoteForInvoice): InvoiceLine[] {
  const rate = defaultRate(quote.vat_rate);
  const { adults, children } = resolveGuestSplit(quote.guest_count, quote.guest_count_adults, quote.guest_count_children);
  const services = quoteLines<QuoteServiceLine>(quote);
  const out: InvoiceLine[] = [];
  for (const s of services) {
    if (!s || s.removed || s.isFree || s.isOption || s.isPageBreak) continue;
    const vatRate = lineVatRate(s, rate);
    const label = (s.name ?? '').trim() || 'Prestation';
    // Tarif au couvert avec prix enfant : une ligne adultes et une ligne enfants, comme le total du devis.
    if (s.childUnitPrice != null && children > 0) {
      if (adults > 0) out.push({ label: `${label} (adultes)`, quantity: adults, unitPrice: s.unitPrice ?? 0, vatRate });
      out.push({ label: `${label} (enfants)`, quantity: children, unitPrice: s.childUnitPrice, vatRate });
      continue;
    }
    const total = lineTotalHT(s, adults, children);
    if (total === 0) continue;
    out.push({ label, quantity: s.quantity ?? 0, unitPrice: s.unitPrice ?? 0, vatRate });
  }
  return out;
}

/**
 * Acompte : un pourcentage du devis, une ligne par taux de TVA (au prorata de la base de chaque taux).
 * Un montant TTC fixe est converti en pourcentage du TTC du devis.
 */
export function depositLines(quoteLines: readonly InvoiceLine[], opts: { percent?: number; amountTTC?: number; quoteNumber?: string | null }): InvoiceLine[] {
  const totals = invoiceTotals(quoteLines);
  if (totals.ttc <= 0) return [];
  const percent = opts.amountTTC != null ? (opts.amountTTC / totals.ttc) * 100 : (opts.percent ?? 30);
  const ref = opts.quoteNumber ? ` sur le devis n° ${opts.quoteNumber}` : ' sur le devis';
  const pct = `${cents(percent).toLocaleString('fr-FR')} %`;
  return totals.byRate.map((r) => ({
    label: `Acompte de ${pct}${ref}${totals.byRate.length > 1 ? ` (TVA ${r.rate.toLocaleString('fr-FR')} %)` : ''}`,
    quantity: 1,
    unitPrice: cents(r.base * percent / 100),
    vatRate: r.rate,
  }));
}

export interface PreviousDeposit { number: string; byRate: RateTotal[] }

/** Solde : toutes les lignes du devis, puis la déduction de chaque acompte déjà facturé, taux par taux. */
export function balanceLines(quoteLines: readonly InvoiceLine[], deposits: readonly PreviousDeposit[]): InvoiceLine[] {
  const deductions = deposits.flatMap((d) => d.byRate.map((r) => ({
    label: `Acompte déjà facturé, facture n° ${d.number}${d.byRate.length > 1 ? ` (TVA ${r.rate.toLocaleString('fr-FR')} %)` : ''}`,
    quantity: 1,
    unitPrice: -r.base,
    vatRate: r.rate,
  })));
  return [...quoteLines, ...deductions];
}

/** Avoir : les lignes de la facture annulée, en négatif. */
export function creditLines(lines: readonly InvoiceLine[], invoiceNumber: string): InvoiceLine[] {
  return lines.map((l) => ({ ...l, description: `Annulation de la facture n° ${invoiceNumber}`, unitPrice: -l.unitPrice }));
}

/** Statut d'une facture émise selon ce qui a été encaissé. */
export function paymentStatus(ttc: number, paid: number): Extract<InvoiceStatus, 'emise' | 'payee_partiellement' | 'payee'> {
  if (paid <= 0) return 'emise';
  return cents(paid) >= cents(ttc) ? 'payee' : 'payee_partiellement';
}

/** Date + n jours, au format AAAA-MM-JJ. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
