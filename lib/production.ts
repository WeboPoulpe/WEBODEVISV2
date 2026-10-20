// Fiche de production cuisine et feuille de route d'un événement. Fonctions pures : aucune lecture de base.
// Les quantités suivent la même règle que la liste de courses (lib/events/needs.ts) :
// quantité par personne × nombre de couverts, une prestation n'étant comptée qu'une fois.

import { normalizeName } from '@/lib/events/needs';
import { ALLERGEN_LABELS, prestationAllergens, type AllergenKey } from '@/lib/allergens';

// ── Unités ──────────────────────────────────────────────────────────────────

const plain = (unit: string | null | undefined) =>
  (unit ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\.$/, '');

// Poids ramenés au gramme, volumes au millilitre : on peut alors additionner 500 g et 1,2 kg.
const MASS: Record<string, number> = {
  mg: 0.001, g: 1, gr: 1, gramme: 1, grammes: 1, kg: 1000, kilo: 1000, kilos: 1000, kilogramme: 1000, kilogrammes: 1000,
};
const VOLUME: Record<string, number> = {
  ml: 1, millilitre: 1, millilitres: 1, cl: 10, centilitre: 10, centilitres: 10, dl: 100, decilitre: 100, decilitres: 100,
  l: 1000, litre: 1000, litres: 1000, lt: 1000,
};

// Ce qui se compte à la pièce ne se produit pas en fraction : 27,5 œufs deviennent 28.
const WHOLE = new Set([
  'unite', 'unites', 'u', 'piece', 'pieces', 'pce', 'pces', 'pc', 'pcs', 'oeuf', 'oeufs', 'bouteille', 'bouteilles', 'btl',
  'boite', 'boites', 'sachet', 'sachets', 'paquet', 'paquets', 'barquette', 'barquettes', 'botte', 'bottes', 'pot', 'pots',
  'tranche', 'tranches', 'portion', 'portions', 'feuille', 'feuilles', 'plaque', 'plaques', 'rouleau', 'rouleaux',
]);

/** Quantité ramenée à une unité de base (g, ml, ou l'unité telle quelle) pour pouvoir l'additionner. */
export function toBaseUnit(quantity: number, unit: string | null | undefined): { quantity: number; unit: string } {
  const key = plain(unit);
  if (key in MASS) return { quantity: quantity * MASS[key], unit: 'g' };
  if (key in VOLUME) return { quantity: quantity * VOLUME[key], unit: 'ml' };
  return { quantity, unit: (unit ?? '').trim() };
}

const fr = (n: number, digits = 2) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits });

/**
 * Quantité lisible en cuisine : 1 500 g → « 1,5 kg », 0,25 L → « 25 cl », 27,5 pièces → « 28 pièces ».
 * Sans unité, le nombre seul.
 */
export function formatQuantity(quantity: number, unit: string | null | undefined): string {
  const base = toBaseUnit(quantity, unit);
  const q = base.quantity;
  if (base.unit === 'g') {
    if (q >= 1000) return `${fr(q / 1000)} kg`;
    if (q > 0 && q < 1) return `${fr(q * 1000, 0)} mg`;
    return `${fr(q, q < 10 ? 1 : 0)} g`;
  }
  if (base.unit === 'ml') {
    if (q >= 1000) return `${fr(q / 1000)} L`;
    if (q >= 10) return `${fr(q / 10, 1)} cl`;
    return `${fr(q, 1)} ml`;
  }
  const whole = WHOLE.has(plain(base.unit));
  // La marge évite qu'une erreur d'arrondi (28,0000001) ajoute une unité.
  const n = whole ? Math.ceil(Math.round(q * 100) / 100 - 1e-9) : Math.round(q * 100) / 100;
  return base.unit ? `${fr(n)} ${base.unit}` : fr(n);
}

// ── Fiche de production ─────────────────────────────────────────────────────

export interface ProductionLine {
  name?: string | null;
  quantity?: number | string | null;
  isPageBreak?: boolean;
  removed?: boolean;
}

export interface ProductionRecipeIngredient {
  ingredient_id: string;
  name: string;
  qty_per_person: number;
  unit: string | null;
  allergens: string[] | null;
}

export interface ProductionRecipe {
  id: string;
  name: string;
  allergens_extra?: string[] | null;
  allergens_checked?: boolean | null;
  ingredients: ProductionRecipeIngredient[];
}

/** Quantité d'un ingrédient, dans son unité de base (g, ml ou l'unité saisie). */
export interface IngredientTotal {
  ingredient_id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ProductionDish {
  name: string;
  /** Quantité à produire : la quantité des lignes du devis, à défaut le nombre de couverts. */
  toProduce: number;
  ingredients: IngredientTotal[];
  allergens: AllergenKey[];
}

export interface ProductionPlan {
  dishes: ProductionDish[];
  /** Tous les ingrédients, additionnés d'un plat à l'autre. */
  totals: IngredientTotal[];
  /** Lignes sans prestation au catalogue (location, personnel, plats saisis à la main). */
  unmatched: string[];
  /** Plats reconnus mais sans recette renseignée. */
  withoutRecipe: string[];
}

const totalKey = (t: Pick<IngredientTotal, 'ingredient_id' | 'unit'>) => `${t.ingredient_id}|${plain(t.unit)}`;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr');

/** Additionne des quantités d'ingrédients : un même ingrédient dans la même famille d'unité ne fait qu'une ligne. */
export function mergeTotals(lists: IngredientTotal[][]): IngredientTotal[] {
  const merged = new Map<string, IngredientTotal>();
  for (const list of lists) {
    for (const t of list) {
      const k = totalKey(t);
      const existing = merged.get(k);
      if (existing) existing.quantity += t.quantity;
      else merged.set(k, { ...t });
    }
  }
  return [...merged.values()].sort(byName);
}

/**
 * Plats à produire pour un événement et leurs ingrédients. Chaque ligne du devis est rapprochée de la
 * prestation du même nom (sans accents ni casse) ; une prestation sur plusieurs lignes ne fait qu'un plat,
 * dont la quantité à produire additionne celle des lignes.
 */
export function productionPlan(lines: ProductionLine[], recipes: ProductionRecipe[], guestCount: number): ProductionPlan {
  const catalog = new Map<string, ProductionRecipe>();
  for (const r of recipes) {
    const k = normalizeName(r.name);
    const existing = catalog.get(k);
    // Deux prestations du même nom : celle qui a une recette l'emporte.
    if (!existing || (existing.ingredients.length === 0 && r.ingredients.length > 0)) catalog.set(k, r);
  }
  const guests = guestCount > 0 ? guestCount : 0;
  const dishes = new Map<string, ProductionDish & { lineQty: number }>();
  const unmatched: string[] = [];
  const withoutRecipe: string[] = [];

  for (const line of lines) {
    const name = (line.name ?? '').trim();
    if (line.isPageBreak || line.removed || !name) continue;
    const recipe = catalog.get(normalizeName(name));
    if (!recipe) { if (!unmatched.includes(name)) unmatched.push(name); continue; }
    const lineQty = Number(line.quantity);
    const existing = dishes.get(recipe.id);
    if (existing) { existing.lineQty += lineQty > 0 ? lineQty : 0; continue; }
    if (recipe.ingredients.length === 0) withoutRecipe.push(recipe.name);
    const ingredients = mergeTotals([recipe.ingredients
      .map((i) => ({ ingredient_id: i.ingredient_id, name: i.name, ...toBaseUnit(i.qty_per_person * guests, i.unit) }))
      .filter((i) => i.quantity > 0)]);
    dishes.set(recipe.id, {
      name,
      toProduce: 0,
      lineQty: lineQty > 0 ? lineQty : 0,
      ingredients,
      allergens: prestationAllergens({
        name: recipe.name,
        allergens_extra: recipe.allergens_extra,
        allergens_checked: recipe.allergens_checked,
        ingredients: recipe.ingredients.map((i) => ({ name: i.name, allergens: i.allergens })),
      }).keys,
    });
  }

  const list: ProductionDish[] = [...dishes.values()].map(({ lineQty, ...d }) => ({ ...d, toProduce: lineQty > 0 ? lineQty : guests }));
  return { dishes: list, totals: mergeTotals(list.map((d) => d.ingredients)), unmatched, withoutRecipe };
}

/** Libellés des allergènes d'un plat, pour la mention en petit. */
export const allergenLabels = (keys: AllergenKey[]) => keys.map((k) => ALLERGEN_LABELS[k]).join(', ');

// ── Feuille de route ────────────────────────────────────────────────────────

export interface RunSheetStep {
  time: string;
  label: string;
  note: string;
}

const TIME = /^([01]?\d|2[0-3])[:hH]([0-5]\d)$/;

/** Heure au format HH:MM (« 9h30 » → « 09:30 »), ou chaîne vide si elle n'est pas lisible. */
export function normalizeTime(value: string | null | undefined): string {
  const m = TIME.exec((value ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/**
 * Déroulé lu en base (format libre) : étapes valides uniquement, triées par heure.
 * Les étapes sans heure restent à la fin, dans leur ordre.
 */
export function cleanRunSheet(raw: unknown): RunSheetStep[] {
  if (!Array.isArray(raw)) return [];
  const steps = raw
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      time: normalizeTime(typeof s.time === 'string' ? s.time : ''),
      label: typeof s.label === 'string' ? s.label.trim() : '',
      note: typeof s.note === 'string' ? s.note.trim() : '',
    }))
    .filter((s) => s.label || s.note);
  return sortRunSheet(steps);
}

/** Tri par heure, stable ; sans heure en dernier. */
export function sortRunSheet<T extends { time: string }>(steps: T[]): T[] {
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      if (!a.s.time !== !b.s.time) return a.s.time ? -1 : 1;
      return a.s.time.localeCompare(b.s.time) || a.i - b.i;
    })
    .map(({ s }) => s);
}

/** Lien d'itinéraire vers le lieu (s'ouvre dans l'application de cartes du téléphone). */
export const directionsUrl = (place: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.trim())}`;

/** « 08:30:00 » → « 8 h 30 ». */
export function frTime(value: string | null | undefined): string {
  const t = normalizeTime((value ?? '').slice(0, 5));
  if (!t) return (value ?? '').trim();
  const [h, m] = t.split(':');
  return `${Number(h)} h ${m}`;
}

/** Production de plusieurs événements le même jour : plats additionnés par nom, ingrédients consolidés. */
export function combinePlans(plans: Pick<ProductionPlan, 'dishes' | 'totals'>[]): { dishes: { name: string; toProduce: number; events: number }[]; totals: IngredientTotal[] } {
  const dishes = new Map<string, { name: string; toProduce: number; events: number }>();
  for (const plan of plans) {
    for (const d of plan.dishes) {
      const k = normalizeName(d.name);
      const existing = dishes.get(k);
      if (existing) { existing.toProduce += d.toProduce; existing.events += 1; }
      else dishes.set(k, { name: d.name, toProduce: d.toProduce, events: 1 });
    }
  }
  return { dishes: [...dishes.values()].sort(byName), totals: mergeTotals(plans.map((p) => p.totals)) };
}
