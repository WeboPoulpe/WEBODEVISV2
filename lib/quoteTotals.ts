// ═══════════════════════════════════════════════════════════════════════════
// Calcul du total d'une ligne de devis — source de vérité unique
// ═══════════════════════════════════════════════════════════════════════════
// Gère le tarif « au couvert » avec prix enfant distinct :
//   si la ligne porte un childUnitPrice ET que l'événement compte des enfants,
//   le total = adultes × prix + enfants × prix_enfant.
// Sinon : quantité × prix unitaire (comportement standard).
// Centralisé ici pour que l'éditeur, le PDF (generateQuoteHtml), la sauvegarde
// WeboWord et la liste des devis calculent tous la MÊME chose.

import { effectiveLines, quoteLines, type QuoteFormula } from './quoteFormulas';

export interface PricedLine {
  quantity?: number;
  unitPrice?: number;
  /** Prix enfant « au couvert ». Si renseigné et enfants > 0 → tarif adultes/enfants. */
  childUnitPrice?: number | null;
}

/** Répartit le nombre de convives en adultes/enfants de façon robuste. */
export function resolveGuestSplit(
  guestCount?: number | null,
  adults?: number | null,
  children?: number | null,
): { adults: number; children: number } {
  const c = Math.max(0, children ?? 0);
  const a = adults != null ? Math.max(0, adults) : Math.max(0, (guestCount ?? 0) - c);
  return { adults: a, children: c };
}

/** Total HT d'une seule ligne, en tenant compte du prix enfant « au couvert ». */
export function lineTotalHT(line: PricedLine, adults = 0, children = 0): number {
  const unit = line.unitPrice ?? 0;
  if (line.childUnitPrice != null && children > 0) {
    return adults * unit + children * line.childUnitPrice;
  }
  return (line.quantity ?? 0) * unit;
}

/** Ligne de devis telle que vue par le calcul de TVA. */
export interface VatLine extends PricedLine {
  /** Taux de TVA propre à la ligne. Absent → taux par défaut du devis. */
  vatRate?: number | null;
  removed?: boolean;
  isFree?: boolean;
  isOption?: boolean;
  isPageBreak?: boolean;
}

export interface VatBreakdown {
  ht: number;
  vat: number;
  ttc: number;
  /** Une entrée par taux présent, du plus élevé au plus bas (bases nulles exclues). */
  byRate: { rate: number; base: number; vat: number }[];
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Taux effectif d'une ligne : le sien s'il est valable, sinon celui du devis. */
export function lineVatRate(line: { vatRate?: number | null }, defaultRate: number): number {
  const r = line.vatRate;
  return r != null && Number.isFinite(Number(r)) ? Number(r) : defaultRate;
}

/**
 * Totaux d'un devis ventilés par taux de TVA — source de vérité unique.
 * Lignes retirées, offertes et sauts de page exclus ; lignes en option exclues sauf
 * `includeOptions` (« total avec options »). Règle française : la TVA de chaque taux
 * est calculée sur le total HT de ce taux, puis arrondie au centime.
 */
export function quoteVatBreakdown(
  lines: readonly (VatLine | null | undefined)[] | null | undefined,
  defaultRate: number,
  adults = 0,
  children = 0,
  { includeOptions = false }: { includeOptions?: boolean } = {},
): VatBreakdown {
  const bases = new Map<number, number>();
  for (const l of lines ?? []) {
    if (!l || l.removed || l.isFree || l.isPageBreak) continue;
    if (l.isOption && !includeOptions) continue;
    const rate = lineVatRate(l, defaultRate);
    bases.set(rate, (bases.get(rate) ?? 0) + lineTotalHT(l, adults, children));
  }
  const byRate = [...bases.entries()]
    .filter(([, base]) => base !== 0)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base, vat: cents(base * rate / 100) }));
  const ht = byRate.reduce((s, r) => s + r.base, 0);
  const vat = cents(byRate.reduce((s, r) => s + r.vat, 0));
  return { ht, vat, ttc: ht + vat, byRate };
}

/** Lignes « TVA x % » à afficher : une par taux présent, au moins une (taux du devis, 0 €) si le devis est vide. */
export function vatRowsForDisplay(totals: VatBreakdown, defaultRate: number): VatBreakdown['byRate'] {
  return totals.byRate.length > 0 ? totals.byRate : [{ rate: defaultRate, base: 0, vat: 0 }];
}

/** Taux du devis (colonne vat_rate), 20 % si absent ou illisible. */
export function quoteDefaultRate(vatRate: number | string | null | undefined): number {
  const n = vatRate == null || vatRate === '' ? 20 : Number(vatRate);
  return Number.isFinite(n) ? n : 20;
}

/** Totaux de chaque formule : lignes communes + lignes de la formule (hors options, comme le total du devis). */
export function formulaTotals(
  lines: readonly (VatLine | null | undefined)[],
  formulas: readonly QuoteFormula[],
  defaultRate: number,
  adults = 0,
  children = 0,
): { formula: QuoteFormula; totals: VatBreakdown }[] {
  return formulas.map((formula) => ({
    formula,
    totals: quoteVatBreakdown(effectiveLines(lines, formulas, formula.id), defaultRate, adults, children),
  }));
}

/**
 * Total TTC d'un devis, hors options : calculé depuis ses lignes (sans les lignes offertes, en option
 * ou retirées) au taux de chaque ligne (sinon celui du devis), sinon le montant enregistré.
 * Devis à formules : celui de la formule retenue (à défaut, de la première). Le même que la liste des devis.
 */
export function quoteTotalTTC(quote: {
  total_amount: number | string | null;
  vat_rate?: number | string | null;
  guest_count?: number | null;
  guest_count_adults?: number | null;
  guest_count_children?: number | null;
  services: unknown;
  formulas?: unknown;
  chosen_formula_id?: string | null;
}): number | null {
  if (Array.isArray(quote.services) && quote.services.length > 0) {
    const { adults, children } = resolveGuestSplit(quote.guest_count, quote.guest_count_adults, quote.guest_count_children);
    const { ht, ttc } = quoteVatBreakdown(quoteLines<VatLine>(quote), quoteDefaultRate(quote.vat_rate), adults, children);
    if (ht > 0) return ttc;
  }
  return quote.total_amount == null ? null : Number(quote.total_amount);
}
