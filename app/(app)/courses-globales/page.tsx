'use client';

import { useState, useMemo } from 'react';
import { ShoppingBasket, Printer, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CONFIRMED_STATUSES } from '@/lib/quoteStatus';
import { cn } from '@/lib/utils';
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls } from '@/components/ui/kit';
import { ErrorBanner, esc, printDocument } from '@/components/evenements/shared';

interface IngredientRow {
  ingredient_id: string;
  ingredient_name: string;
  total_qty: number;
  unit: string | null;
  supplier_name: string;
  event_dates: string[];
}

const fmtQty = (n: number) => (Math.round(n * 100) / 100).toLocaleString('fr-FR');
const fmtDay = (d: string) => new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const fmtFull = (d: string) => new Date(d + 'T00:00').toLocaleDateString('fr-FR');

export default function CoursesGlobalesPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [rows, setRows]           = useState<IngredientRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  const search = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setSearched(true);
    setError(null);
    const supabase = createClient();

    // Devis confirmés de la période
    const { data: quotes, error: quotesErr } = await supabase
      .from('quotes')
      .select('id, event_date, client_name')
      .in('status', CONFIRMED_STATUSES)
      .gte('event_date', startDate)
      .lte('event_date', endDate);

    if (quotesErr) setError('Les besoins n’ont pas pu être calculés. Réessayez.');
    if (!quotes || quotes.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const quoteIds = quotes.map((q) => q.id);
    const dateByQuoteId = Object.fromEntries(quotes.map((q) => [q.id, q.event_date ?? '']));

    // Listes de courses de ces événements
    const { data: ingredients, error: ingErr } = await supabase
      .from('event_ingredients')
      .select('quote_id, ingredient_id, quantity, unit, ingredient:ingredients(id, name, unit), supplier:suppliers(id, name)')
      .in('quote_id', quoteIds);

    if (ingErr) setError('Les besoins n’ont pas pu être calculés. Réessayez.');
    if (!ingredients || ingredients.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Regroupement par ingrédient et par fournisseur
    const agg: Record<string, IngredientRow> = {};
    for (const item of ingredients) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ing = item.ingredient as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sup = item.supplier as any;
      const key = `${item.ingredient_id}__${sup?.id ?? 'none'}`;
      if (!agg[key]) {
        agg[key] = {
          ingredient_id: item.ingredient_id,
          ingredient_name: ing?.name ?? '?',
          total_qty: 0,
          unit: item.unit ?? ing?.unit ?? null,
          supplier_name: sup?.name ?? 'Sans fournisseur',
          event_dates: [],
        };
      }
      agg[key].total_qty += item.quantity;
      const d = dateByQuoteId[item.quote_id];
      if (d && !agg[key].event_dates.includes(d)) agg[key].event_dates.push(d);
    }
    for (const r of Object.values(agg)) r.event_dates.sort();

    setRows(Object.values(agg).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, 'fr') || a.ingredient_name.localeCompare(b.ingredient_name, 'fr')));
    setLoading(false);
  };

  const grouped = useMemo(() =>
    rows.reduce<Record<string, IngredientRow[]>>((acc, r) => {
      if (!acc[r.supplier_name]) acc[r.supplier_name] = [];
      acc[r.supplier_name].push(r);
      return acc;
    }, {}),
  [rows]);

  const supplierKeys = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      if (a === 'Sans fournisseur') return 1;
      if (b === 'Sans fournisseur') return -1;
      return a.localeCompare(b, 'fr');
    }),
  [grouped]);

  const toggleSupplier = (key: string) =>
    setExpandedSuppliers((p) => ({ ...p, [key]: p[key] === false }));

  const handlePrint = () => {
    const today = new Date().toLocaleDateString('fr-FR');
    const blocks = supplierKeys.map((sup) => `
      <h2>${esc(sup)}</h2>
      <table>
        <thead><tr><th>Ingrédient</th><th class="r" style="width:130px">Quantité totale</th><th style="width:150px">Événements</th></tr></thead>
        <tbody>${grouped[sup].map((r) => `<tr>
          <td>${esc(r.ingredient_name)}</td>
          <td class="r"><strong>${fmtQty(r.total_qty)} ${esc(r.unit)}</strong></td>
          <td class="muted">${r.event_dates.map(fmtDay).join(', ')}</td>
        </tr>`).join('')}</tbody>
      </table>`).join('');
    const ok = printDocument('Liste de courses globale',
      `<p class="muted" style="margin:0 0 12px">Du ${fmtFull(startDate)} au ${fmtFull(endDate)}. Imprimé le ${today}.</p>${blocks}`);
    if (!ok) setError('Votre navigateur a bloqué l’ouverture de la liste. Autorisez les fenêtres pour ce site, puis réessayez.');
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Courses globales</h1>
        <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
          Additionnez les listes de courses de vos événements confirmés sur une période, fournisseur par fournisseur.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); search(); }}
        className={cn(cardCls, 'p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] items-end gap-3 mb-5')}>
        <div className="min-w-0">
          <label htmlFor="cg-start" className={labelCls}>Date de début</label>
          <input id="cg-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn(inputCls, 'px-3')} />
        </div>
        <div className="min-w-0">
          <label htmlFor="cg-end" className={labelCls}>Date de fin</label>
          <input id="cg-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={cn(inputCls, 'px-3')} />
        </div>
        <button type="submit" disabled={!startDate || !endDate || loading} className={cn(btnPrimary, 'col-span-2 sm:col-span-1 h-12')}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBasket className="h-4 w-4" />}
          Calculer les besoins
        </button>
      </form>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      {!searched ? (
        <p className="px-1 text-[15px] text-gray-600">Choisissez une période : la liste réunit les ingrédients de tous les événements confirmés qui s’y déroulent.</p>
      ) : loading ? null : rows.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900">Aucun ingrédient sur cette période</p>
          <p className="text-sm text-gray-500 mt-1">Vérifiez que vos événements confirmés ont une liste de courses remplie.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {rows.length} ingrédient{rows.length !== 1 ? 's' : ''} chez {supplierKeys.length} fournisseur{supplierKeys.length !== 1 ? 's' : ''}
            </p>
            <button onClick={handlePrint} className={btnSecondary}><Printer className="h-4 w-4" />Imprimer</button>
          </div>

          {supplierKeys.map((sup) => {
            const isOpen = expandedSuppliers[sup] !== false; // ouvert par défaut
            return (
              <section key={sup}>
                <h2>
                  <button onClick={() => toggleSupplier(sup)} aria-expanded={isOpen}
                    className="flex items-center gap-2 min-h-10 px-1 mb-1 text-[15px] font-semibold text-gray-900 text-left">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                    {sup}
                    <span className="text-sm font-normal text-gray-500">{grouped[sup].length}</span>
                  </button>
                </h2>
                {isOpen && (
                  <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
                    {grouped[sup].map((r) => (
                      <li key={r.ingredient_id} className="flex flex-wrap sm:flex-nowrap items-baseline gap-x-4 gap-y-0.5 px-4 sm:px-5 py-3">
                        <span className="flex-1 min-w-0 text-[15px] text-gray-900 break-words">{r.ingredient_name}</span>
                        <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{fmtQty(r.total_qty)} {r.unit ?? ''}</span>
                        {r.event_dates.length > 0 && (
                          <span className="basis-full sm:basis-40 sm:text-right text-sm text-gray-500 tabular-nums">
                            {r.event_dates.map(fmtDay).join(', ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
