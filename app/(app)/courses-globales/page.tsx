'use client';

import { useState, useMemo } from 'react';
import { ShoppingBasket, Printer, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface IngredientRow {
  ingredient_id: string;
  ingredient_name: string;
  total_qty: number;
  unit: string | null;
  supplier_name: string;
  event_dates: string[];
}

export default function CoursesGlobalesPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [rows, setRows]           = useState<IngredientRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  const search = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setSearched(true);
    const supabase = createClient();

    // Fetch accepted quotes in date range
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, event_date, client_name')
      .in('status', ['accepted', 'accepte', 'signed'])
      .gte('event_date', startDate)
      .lte('event_date', endDate);

    if (!quotes || quotes.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const quoteIds = quotes.map((q) => q.id);
    const dateByQuoteId = Object.fromEntries(quotes.map((q) => [q.id, q.event_date ?? '']));

    // Fetch event_ingredients for those quotes
    const { data: ingredients } = await supabase
      .from('event_ingredients')
      .select('quote_id, ingredient_id, quantity, unit, ingredient:ingredients(id, name, unit), supplier:suppliers(id, name)')
      .in('quote_id', quoteIds);

    if (!ingredients || ingredients.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Aggregate by ingredient_id + supplier
    type AggKey = string;
    const agg: Record<AggKey, IngredientRow> = {};
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
      if (d && !agg[key].event_dates.includes(d)) {
        agg[key].event_dates.push(d);
      }
    }

    setRows(Object.values(agg).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, 'fr') || a.ingredient_name.localeCompare(b.ingredient_name, 'fr')));
    setLoading(false);
  };

  // Group by supplier
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
    setExpandedSuppliers((p) => ({ ...p, [key]: !p[key] }));

  const handlePrint = () => {
    const today = new Date().toLocaleDateString('fr-FR');
    const rows_html = supplierKeys.map((sup) => {
      const items = grouped[sup];
      const itemsHtml = items.map((r) => `
        <tr style="border-bottom:1px solid #f3e5f5;">
          <td style="padding:6px 8px;">${r.ingredient_name}</td>
          <td style="text-align:right;padding:6px 8px;font-weight:bold;color:#9c27b0;">${Math.round(r.total_qty * 100) / 100} ${r.unit ?? ''}</td>
          <td style="padding:6px 8px;color:#888;font-size:11px;">${r.event_dates.sort().map((d) => new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })).join(', ')}</td>
        </tr>`).join('');
      return `
        <h3 style="color:#9c27b0;margin:18px 0 6px;font-size:14px;border-bottom:1px solid #e9d5ff;padding-bottom:4px;">${sup}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3e5f5;">
            <th style="text-align:left;padding:6px 8px;">Ingrédient</th>
            <th style="text-align:right;padding:6px 8px;width:120px;">Quantité totale</th>
            <th style="text-align:left;padding:6px 8px;width:120px;">Événements</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>`;
    }).join('');

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Courses Globales</title>
      <style>@page{size:A4;margin:20mm}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:Georgia,serif;color:#1a1a1a;margin:0;}</style></head>
      <body>
        <h1 style="color:#9c27b0;font-size:18px;margin:0 0 4px;">Liste de Courses Globale</h1>
        <p style="color:#888;font-size:11px;margin:0 0 20px;">Du ${new Date(startDate + 'T00:00').toLocaleDateString('fr-FR')} au ${new Date(endDate + 'T00:00').toLocaleDateString('fr-FR')} — Imprimé le ${today}</p>
        ${rows_html}
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Courses globales</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Agrégez les besoins en ingrédients de tous vos événements sur une période.
        </p>
      </div>

      {/* Date range picker */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
            />
          </div>
        </div>
        <button
          onClick={search}
          disabled={!startDate || !endDate || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBasket className="h-4 w-4" />}
          Calculer les besoins
        </button>
      </div>

      {/* Results */}
      {searched && !loading && (
        rows.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ShoppingBasket className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun ingrédient trouvé sur cette période.</p>
            <p className="text-xs text-gray-400 mt-1">Vérifiez que vos événements ont une liste de courses remplie.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{rows.length} ingrédient{rows.length !== 1 ? 's' : ''} — {supplierKeys.length} fournisseur{supplierKeys.length !== 1 ? 's' : ''}</p>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimer
              </button>
            </div>

            {supplierKeys.map((sup) => {
              const isOpen = expandedSuppliers[sup] !== false; // default open
              return (
                <div key={sup} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSupplier(sup)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{sup}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {grouped[sup].length} article{grouped[sup].length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isOpen
                      ? <ChevronUp className="h-4 w-4 text-gray-400" />
                      : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {grouped[sup].map((r) => (
                        <div key={r.ingredient_id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex-1 text-sm text-gray-800">{r.ingredient_name}</span>
                          <span className="text-sm font-bold text-[#9c27b0] tabular-nums bg-purple-50 px-2 py-0.5 rounded-lg">
                            {Math.round(r.total_qty * 100) / 100} {r.unit ?? ''}
                          </span>
                          {r.event_dates.length > 0 && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {r.event_dates.sort().map((d) =>
                                new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                              ).join(', ')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
