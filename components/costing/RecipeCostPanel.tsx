'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { btnSecondary } from '@/components/ui/kit';
import { createClient } from '@/lib/supabase/client';
import { margin, recipeCost, type RecipeCost } from '@/lib/costing';
import { cn, formatCurrency } from '@/lib/utils';

// Coût matière calculé depuis la recette d'une prestation (ingrédients liés × prix d'achat).
// Le traiteur garde la main : « Utiliser ce coût » remplit le prix de revient, rien n'est enregistré sans lui.

interface LinkRow {
  qty_per_person: number | string | null;
  unit: string | null;
  ingredient: { name: string; unit: string | null; volume_unit_price: number | string | null } | null;
}

const qtyText = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');
const list = (names: string[]) => names.join(', ');

export default function RecipeCostPanel({ prestationId, recipeKey, priceHT, costHT, onUse }: {
  prestationId: string;
  /** Change quand la recette change (ingrédient lié ou retiré) : le calcul est refait. */
  recipeKey: string;
  /** Prix de vente HT saisi (null s'il n'est pas lisible). */
  priceHT: number | null;
  /** Prix de revient saisi. */
  costHT: number | null;
  onUse: (cost: number) => void;
}) {
  const [result, setResult] = useState<RecipeCost | null>(null);

  useEffect(() => {
    let alive = true;
    createClient()
      .from('service_ingredients')
      .select('qty_per_person, unit, ingredient:ingredients(name, unit, volume_unit_price)')
      .eq('service_id', prestationId)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setResult(null); return; }
        const rows = ((data ?? []) as unknown as LinkRow[]).filter((r) => r.ingredient);
        setResult(recipeCost(rows.map((r) => ({
          name: r.ingredient!.name,
          qtyPerPerson: r.qty_per_person,
          unit: r.unit,
          ingredientUnit: r.ingredient!.unit,
          unitPrice: r.ingredient!.volume_unit_price,
        }))));
      });
    return () => { alive = false; };
  }, [prestationId, recipeKey]);

  if (!result || result.lines.length === 0) return null;

  const priced = result.lines.some((l) => l.status === 'ok');
  const same = costHT != null && Math.abs(costHT - result.total) < 0.005;
  const m = priced && priceHT != null && priceHT > 0 ? margin(priceHT, result.total) : null;

  return (
    <div className="rounded-xl bg-gray-50 p-4 mt-3" data-testid="recipe-cost">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-gray-800">
            Coût matière calculé : <strong className="font-display font-semibold tabular-nums">{formatCurrency(result.total)}</strong> par personne (recette)
          </p>
          {m && !same && (
            <p className="text-sm text-gray-600 mt-0.5">
              Avec ce coût : marge de {formatCurrency(m.amount)}{m.rate != null && <> ({String(m.rate).replace('.', ',')} %)</>}
              {m.coefficient != null && <>, coefficient {String(m.coefficient).replace('.', ',')}</>}
            </p>
          )}
        </div>
        {priced && !same && (
          <button type="button" onClick={() => onUse(result.total)} className={cn(btnSecondary, 'flex-shrink-0')}>
            Utiliser ce coût
          </button>
        )}
      </div>

      {result.missingPrice.length > 0 && (
        <p className="text-sm text-amber-800 mt-2">
          Sans prix d’achat, non comptés : {list(result.missingPrice)}.{' '}
          <Link href="/ingredients" className="underline underline-offset-2 hover:text-gray-900">Compléter les prix</Link>
        </p>
      )}
      {result.incomparable.length > 0 && (
        <p className="text-sm text-amber-800 mt-2">
          Prix non comparable, non comptés : {list(result.incomparable)} (l’unité de la recette n’est pas celle du prix d’achat).
        </p>
      )}

      <details className="group mt-2">
        <summary className="inline-flex items-center gap-1 min-h-10 cursor-pointer select-none text-sm font-medium text-primary-700 list-none [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />Détail par ingrédient
        </summary>
        <ul className="mt-1 divide-y divide-gray-200 text-sm">
          {result.lines.map((l, i) => (
            <li key={`${l.name}-${i}`} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block text-gray-900 break-words">{l.name}</span>
                <span className="block text-gray-500">
                  {qtyText(l.qty)} {l.unit} / pers.
                  {l.unitPrice > 0 && <>, {formatCurrency(l.unitPrice)}{l.ingredientUnit ? ` le ${l.ingredientUnit}` : ''}</>}
                </span>
              </span>
              <span className={cn('whitespace-nowrap tabular-nums', l.cost == null ? 'text-amber-800' : 'text-gray-900')}>
                {l.status === 'ok' ? formatCurrency(l.cost ?? 0) : l.status === 'sans_prix' ? 'Sans prix' : 'Non comparable'}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
