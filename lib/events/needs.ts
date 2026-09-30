// Calcul des besoins en ingrédients d'un événement. Fonctions pures : aucune lecture de base.

export interface QuoteLine {
  name: string;
  isPageBreak?: boolean;
  removed?: boolean;
}

export interface RecipeIngredient {
  ingredient_id: string;
  qty_per_person: number;
  unit: string | null;
  preferred_supplier_id: string | null;
  unit_price: number;
}

export interface PrestationRecipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
}

export interface IngredientNeed {
  ingredient_id: string;
  quantity: number;
  unit: string | null;
  supplier_id: string | null;
  unit_price: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nom comparable : sans accents, sans casse, espaces réduits. */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Besoins = quantité par personne × nombre de convives, pour chaque prestation du devis.
 * La correspondance ligne du devis ↔ prestation est exacte (« Menu » ne prend pas « Menu enfant »),
 * et une prestation présente sur plusieurs lignes n'est comptée qu'une fois : la quantité de la
 * ligne encode déjà le plus souvent le nombre de convives.
 */
export function computeIngredientNeeds(lines: QuoteLine[], recipes: PrestationRecipe[], guestCount: number) {
  // Si deux prestations portent le même nom, celle qui a des ingrédients l'emporte.
  const byName = new Map<string, PrestationRecipe>();
  for (const r of recipes) {
    const key = normalizeName(r.name);
    const existing = byName.get(key);
    if (!existing || (existing.ingredients.length === 0 && r.ingredients.length > 0)) byName.set(key, r);
  }
  const matched: string[] = [];
  const unmatched: string[] = [];
  const withoutIngredients: string[] = [];
  const seen = new Set<string>();
  const needs = new Map<string, IngredientNeed>();

  for (const line of lines) {
    if (line.isPageBreak || line.removed || !line.name?.trim()) continue;
    const recipe = byName.get(normalizeName(line.name));
    if (!recipe) { unmatched.push(line.name.trim()); continue; }
    if (seen.has(recipe.id)) continue;
    seen.add(recipe.id);
    if (recipe.ingredients.length === 0) { withoutIngredients.push(recipe.name); continue; }
    matched.push(recipe.name);
    for (const ing of recipe.ingredients) {
      const quantity = ing.qty_per_person * guestCount;
      if (!(quantity > 0)) continue;
      const need = needs.get(ing.ingredient_id);
      if (need) need.quantity += quantity;
      else needs.set(ing.ingredient_id, {
        ingredient_id: ing.ingredient_id,
        quantity,
        unit: ing.unit,
        supplier_id: ing.preferred_supplier_id,
        unit_price: ing.unit_price,
      });
    }
  }

  return {
    needs: [...needs.values()].map((n) => ({ ...n, quantity: round2(n.quantity) })),
    matched,
    unmatched,
    withoutIngredients,
  };
}

/** Une commande par fournisseur ; les ingrédients sans fournisseur sont listés à part. */
export function groupNeedsBySupplier(needs: Pick<IngredientNeed, 'ingredient_id' | 'quantity' | 'supplier_id' | 'unit_price'>[]) {
  const bySupplier = new Map<string, { ingredient_id: string; quantity: number; unit_price: number }[]>();
  const withoutSupplier: string[] = [];
  for (const n of needs) {
    if (!n.supplier_id) { withoutSupplier.push(n.ingredient_id); continue; }
    if (!bySupplier.has(n.supplier_id)) bySupplier.set(n.supplier_id, []);
    bySupplier.get(n.supplier_id)!.push({ ingredient_id: n.ingredient_id, quantity: n.quantity, unit_price: n.unit_price });
  }
  const orders = [...bySupplier.entries()].map(([supplier_id, items]) => ({
    supplier_id,
    total: round2(items.reduce((s, i) => s + i.quantity * i.unit_price, 0)),
    items,
  }));
  return { orders, withoutSupplier };
}
