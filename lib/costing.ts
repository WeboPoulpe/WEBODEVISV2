// Coût de revient et marges — calculs purs, partagés par la fiche prestation, la marge d'un devis
// et le tableau de bord.
//
// Coût matière d'une prestation : Σ quantité par personne × prix d'achat de l'ingrédient.
// Les unités sont traitées prudemment : seules les conversions simples (g ↔ kg, ml ↔ cl ↔ dl ↔ L) sont faites ;
// une unité qu'on ne sait pas rapprocher de celle du prix rend l'ingrédient « prix non comparable », et il est
// laissé hors du total plutôt que de fausser le coût.

import { lineTotalHT } from '@/lib/quoteTotals';

const cents = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Unités ────────────────────────────────────────────────────────────────────
/** Unités de masse et de volume, ramenées au gramme et au millilitre. */
const MEASURES: Record<string, { kind: 'masse' | 'volume'; base: number }> = {
  g: { kind: 'masse', base: 1 },
  kg: { kind: 'masse', base: 1000 },
  ml: { kind: 'volume', base: 1 },
  cl: { kind: 'volume', base: 10 },
  dl: { kind: 'volume', base: 100 },
  l: { kind: 'volume', base: 1000 },
};

const ALIASES: Record<string, string> = {
  gr: 'g', gramme: 'g', grammes: 'g',
  kilo: 'kg', kilos: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  litre: 'l', litres: 'l', lt: 'l',
  millilitre: 'ml', millilitres: 'ml',
  centilitre: 'cl', centilitres: 'cl',
  decilitre: 'dl', decilitres: 'dl',
  u: 'unite', unites: 'unite', piece: 'unite', pieces: 'unite', pce: 'unite', pc: 'unite',
};

/** Unité ramenée à une forme stable : minuscules, sans accent ni point, synonymes regroupés (« Kilo » → kg). */
export function normalizeUnit(unit: string | null | undefined): string {
  const u = (unit ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.$/, '');
  return ALIASES[u] ?? u;
}

/**
 * Facteur pour passer d'une quantité exprimée en `from` à la même quantité exprimée en `to`
 * (150 g → kg : 0,001). null si les deux unités ne se comparent pas. Sans unité de recette, celle du prix s'applique.
 */
export function unitFactor(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (!a || !b || a === b) return 1;
  const ma = MEASURES[a];
  const mb = MEASURES[b];
  if (ma && mb && ma.kind === mb.kind) return ma.base / mb.base;
  return null;
}

// ── Coût matière d'une prestation ─────────────────────────────────────────────
export interface RecipeLine {
  name: string;
  /** Quantité par personne, dans l'unité de la recette. */
  qtyPerPerson: number | string | null;
  /** Unité de la recette (vide : celle de l'ingrédient). */
  unit: string | null;
  /** Unité dans laquelle le prix d'achat est donné. */
  ingredientUnit: string | null;
  /** Prix d'achat par unité de l'ingrédient (volume_unit_price). */
  unitPrice: number | string | null;
}

export type RecipeLineStatus = 'ok' | 'sans_prix' | 'non_comparable';

export interface RecipeCostLine {
  name: string;
  qty: number;
  unit: string;
  /** Prix d'achat et son unité, pour le détail affiché. */
  unitPrice: number;
  ingredientUnit: string;
  /** Coût par personne ; null si l'ingrédient est laissé hors du total. */
  cost: number | null;
  status: RecipeLineStatus;
}

export interface RecipeCost {
  /** Coût matière par personne (ingrédients chiffrés seulement), au centime. */
  total: number;
  lines: RecipeCostLine[];
  /** Ingrédients sans prix d'achat. */
  missingPrice: string[];
  /** Ingrédients dont l'unité de la recette ne se rapproche pas de celle du prix. */
  incomparable: string[];
  /** Tous les ingrédients sont chiffrés. */
  complete: boolean;
}

export function recipeCost(lines: readonly RecipeLine[]): RecipeCost {
  const out: RecipeCostLine[] = [];
  const missingPrice: string[] = [];
  const incomparable: string[] = [];
  let total = 0;
  for (const l of lines) {
    const qty = num(l.qtyPerPerson);
    const price = num(l.unitPrice);
    const ingredientUnit = (l.ingredientUnit ?? '').trim();
    const unit = (l.unit ?? '').trim() || ingredientUnit;
    const base = { name: l.name, qty, unit, unitPrice: price, ingredientUnit };
    if (price <= 0) {
      missingPrice.push(l.name);
      out.push({ ...base, cost: null, status: 'sans_prix' });
      continue;
    }
    const factor = unitFactor(unit, ingredientUnit);
    if (factor == null) {
      incomparable.push(l.name);
      out.push({ ...base, cost: null, status: 'non_comparable' });
      continue;
    }
    const cost = qty * factor * price;
    total += cost;
    out.push({ ...base, cost: cents(cost), status: 'ok' });
  }
  return { total: cents(total), lines: out, missingPrice, incomparable, complete: missingPrice.length === 0 && incomparable.length === 0 };
}

// ── Marge ─────────────────────────────────────────────────────────────────────
export interface Margin {
  /** Prix HT − coût. */
  amount: number;
  /** Taux de marge, en % du prix HT (null sans prix). */
  rate: number | null;
  /** Coefficient : prix HT ÷ coût (null sans coût). */
  coefficient: number | null;
}

export function margin(priceHT: number, cost: number): Margin {
  const amount = cents(priceHT - cost);
  return {
    amount,
    rate: priceHT > 0 ? Math.round((amount / priceHT) * 1000) / 10 : null,
    coefficient: cost > 0 ? Math.round((priceHT / cost) * 100) / 100 : null,
  };
}

// ── Marge d'un devis ──────────────────────────────────────────────────────────
/** Clé de rapprochement d'une ligne de devis avec une prestation du catalogue : son nom. */
export const catalogKey = (name: string | null | undefined) => (name ?? '').trim().toLowerCase();

/** Ligne de devis telle que le calcul de marge la lit. */
export interface CostedQuoteLine {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  childUnitPrice?: number | null;
  isFree?: boolean;
  isOption?: boolean;
  removed?: boolean;
  isPageBreak?: boolean;
  /** Coût unitaire porté par la ligne elle-même, s'il existe. */
  costPrice?: number | string | null;
  cost_price?: number | string | null;
}

export interface StaffRow {
  hours_worked: number | string | null;
  /** Taux de la mission. */
  hourly_rate: number | string | null;
  /** Taux habituel de l'extra, quand la mission n'en a pas. */
  extra_rate?: number | string | null;
  /** Statut de la mission : une mission refusée ne coûte rien. */
  status?: string | null;
}

/** Coût du personnel : Σ heures faites × taux de la mission (sinon taux habituel de l'extra), missions refusées exclues. */
export function staffCost(rows: readonly StaffRow[]): number {
  let total = 0;
  for (const r of rows) {
    if (r.status === 'refuse') continue;
    const hours = num(r.hours_worked);
    const rate = num(r.hourly_rate) || num(r.extra_rate);
    if (hours > 0 && rate > 0) total += hours * rate;
  }
  return cents(total);
}

/** Total des frais annexes du devis (colonne extra_costs). */
export function extraCostsTotal(extraCosts: unknown): number {
  if (!Array.isArray(extraCosts)) return 0;
  return cents(extraCosts.reduce((s: number, e) => s + num((e as { amount?: unknown } | null)?.amount), 0));
}

export interface QuoteCostLine {
  name: string;
  quantity: number;
  unitPrice: number;
  isFree: boolean;
  isOption: boolean;
  sale: number;
  /** Coût unitaire retenu (null : inconnu). */
  unitCost: number | null;
  cost: number;
  /** D'où vient le coût : la prestation du catalogue, la ligne elle-même, ou rien. */
  source: 'catalogue' | 'ligne' | null;
}

export interface QuoteCost {
  lines: QuoteCostLine[];
  revenueHT: number;
  materialCost: number;
  extraCost: number;
  staffCost: number;
  totalCost: number;
  margin: Margin;
  /** Au moins un coût est connu (matière, frais annexes ou personnel). */
  hasCost: boolean;
}

/**
 * Marge d'un devis : CA HT − (coût des lignes + frais annexes + personnel).
 * Coût d'une ligne : prix de revient de la prestation du catalogue de même nom, sinon celui porté par la ligne.
 * Les lignes offertes coûtent quand même ; les options ne comptent que si `includeOptions`.
 */
export function quoteCost(input: {
  services: unknown;
  /** Prix de revient du catalogue, par clé de nom (catalogKey). */
  catalog: ReadonlyMap<string, number>;
  extraCosts?: unknown;
  staffCost?: number;
  adults?: number;
  children?: number;
  includeOptions?: boolean;
}): QuoteCost {
  const { catalog, adults = 0, children = 0, includeOptions = false } = input;
  const lines: QuoteCostLine[] = [];
  const raw = Array.isArray(input.services) ? (input.services as (CostedQuoteLine | null)[]) : [];
  for (const s of raw) {
    if (!s || s.removed || s.isPageBreak || !s.name) continue;
    if (s.isOption && !includeOptions) continue;
    const quantity = num(s.quantity);
    const sale = s.isFree ? 0 : lineTotalHT({ quantity, unitPrice: num(s.unitPrice), childUnitPrice: s.childUnitPrice }, adults, children);
    const fromCatalog = catalog.get(catalogKey(s.name));
    const own = num(s.costPrice ?? s.cost_price);
    const unitCost = fromCatalog && fromCatalog > 0 ? fromCatalog : own > 0 ? own : null;
    lines.push({
      name: s.name, quantity, unitPrice: num(s.unitPrice), isFree: !!s.isFree, isOption: !!s.isOption,
      sale, unitCost, cost: unitCost == null ? 0 : cents(quantity * unitCost),
      source: fromCatalog && fromCatalog > 0 ? 'catalogue' : own > 0 ? 'ligne' : null,
    });
  }
  const revenueHT = cents(lines.reduce((s, l) => s + l.sale, 0));
  const materialCost = cents(lines.reduce((s, l) => s + l.cost, 0));
  const extraCost = extraCostsTotal(input.extraCosts);
  const staff = cents(input.staffCost ?? 0);
  const totalCost = cents(materialCost + extraCost + staff);
  return {
    lines, revenueHT, materialCost, extraCost, staffCost: staff, totalCost,
    margin: margin(revenueHT, totalCost),
    hasCost: totalCost > 0,
  };
}

// ── Marge estimée sur une période (tableau de bord) ──────────────────────────
export interface MarginTotals {
  /** CA HT des devis dont un coût est connu. */
  revenueHT: number;
  cost: number;
  margin: number;
  /** Taux de marge sur ces devis, en % (null sans devis chiffré). */
  rate: number | null;
  /** Devis confirmés comptés dans la marge. */
  costed: number;
  /** Devis confirmés sans aucun coût renseigné, laissés hors de la marge. */
  uncosted: number;
}

/** Additionne la marge de plusieurs devis ; ceux sans coût sont comptés à part pour ne pas gonfler la marge. */
export function sumMargins(quotes: readonly Pick<QuoteCost, 'revenueHT' | 'totalCost' | 'hasCost'>[]): MarginTotals {
  let revenueHT = 0, cost = 0, costed = 0, uncosted = 0;
  for (const q of quotes) {
    if (!q.hasCost) { uncosted++; continue; }
    revenueHT += q.revenueHT;
    cost += q.totalCost;
    costed++;
  }
  const m = cents(revenueHT - cost);
  return {
    revenueHT: cents(revenueHT), cost: cents(cost), margin: m,
    rate: revenueHT > 0 ? Math.round((m / revenueHT) * 1000) / 10 : null,
    costed, uncosted,
  };
}

/** Marge estimée et panier moyen du tableau de bord (HT, devis confirmés, par date d'événement). */
export interface MarginSummary {
  month: MarginTotals;
  year: MarginTotals;
  /** CA HT moyen par devis confirmé (null sans devis). */
  basketMonth: number | null;
  basketYear: number | null;
  /** Le coût du personnel est compté (la base a les heures des extras). */
  staffCounted: boolean;
}
