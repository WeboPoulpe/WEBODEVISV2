'use client';

import { useState, useMemo } from 'react';
import { Package, Printer, Loader2, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CONFIRMED_STATUSES } from '@/lib/quoteStatus';

interface RentalRow {
  material_name: string;
  total_qty: number;
  unit: string | null;
  supplier_name: string;
  supplier_id: string | null;
  total_cost: number;
  events: { date: string; client: string; qty: number }[];
}

interface QuoteInfo {
  id: string;
  event_date: string;
  client_name: string;
  guest_count: number | null;
}

export default function LocationGlobalePage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [rows, setRows]           = useState<RentalRow[]>([]);
  const [quotes, setQuotes]       = useState<QuoteInfo[]>([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  const search = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setSearched(true);
    const supabase = createClient();

    const { data: quotesData } = await supabase
      .from('quotes')
      .select('id, event_date, client_name, guest_count')
      .in('status', CONFIRMED_STATUSES)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date');

    if (!quotesData || quotesData.length === 0) {
      setRows([]);
      setQuotes([]);
      setLoading(false);
      return;
    }

    setQuotes(quotesData as QuoteInfo[]);
    const quoteIds = quotesData.map((q) => q.id);
    const quoteMap = Object.fromEntries(quotesData.map((q) => [q.id, q]));

    const { data: rentals } = await supabase
      .from('rental_items')
      .select('*, supplier:suppliers(id, name)')
      .in('quote_id', quoteIds)
      .or('confirmed_individually.is.null,confirmed_individually.eq.false');

    if (!rentals || rentals.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Aggregate by material_name + supplier
    const agg: Record<string, RentalRow> = {};
    for (const r of rentals) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sup = r.supplier as any;
      const key = `${r.material_name}__${sup?.id ?? 'none'}`;
      const q = quoteMap[r.quote_id];
      if (!agg[key]) {
        agg[key] = {
          material_name: r.material_name,
          total_qty: 0,
          unit: r.unit,
          supplier_name: sup?.name ?? 'Sans fournisseur',
          supplier_id: sup?.id ?? null,
          total_cost: 0,
          events: [],
        };
      }
      agg[key].total_qty += r.qty;
      agg[key].total_cost += r.qty * r.price_per_unit;
      if (q) {
        agg[key].events.push({
          date: q.event_date,
          client: q.client_name,
          qty: r.qty,
        });
      }
    }

    setRows(
      Object.values(agg).sort((a, b) =>
        a.supplier_name.localeCompare(b.supplier_name, 'fr') || a.material_name.localeCompare(b.material_name, 'fr')
      )
    );
    setLoading(false);
  };

  const grouped = useMemo(() =>
    rows.reduce<Record<string, RentalRow[]>>((acc, r) => {
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

  const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const today = new Date().toLocaleDateString('fr-FR');
  const periodLabel = startDate && endDate
    ? `Du ${fmtDate(startDate)} au ${fmtDate(endDate)}`
    : '';

  // Print general PDF (all suppliers)
  const printGeneral = () => {
    const grandTotal = rows.reduce((s, r) => s + r.total_cost, 0);
    const supplierBlocks = supplierKeys.map((sup) => {
      const items = grouped[sup];
      const supTotal = items.reduce((s, r) => s + r.total_cost, 0);
      const rowsHtml = items.map((r) => `
        <tr style="border-bottom:1px solid #f3e5f5;">
          <td style="padding:6px 8px;">${r.material_name}</td>
          <td style="text-align:center;padding:6px 8px;">${r.total_qty}${r.unit ? ` ${r.unit}` : ''}</td>
          <td style="text-align:right;padding:6px 8px;">${money(r.total_cost)}</td>
          <td style="padding:6px 8px;color:#888;font-size:10px;">${r.events.map((e) => `${fmtDate(e.date)} (${e.qty})`).join(', ')}</td>
        </tr>`).join('');
      return `
        <h3 style="color:#9c27b0;margin:18px 0 6px;font-size:14px;border-bottom:1px solid #e9d5ff;padding-bottom:4px;">${sup}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3e5f5;">
            <th style="text-align:left;padding:6px 8px;">Article</th>
            <th style="text-align:center;padding:6px 8px;width:80px;">Qté totale</th>
            <th style="text-align:right;padding:6px 8px;width:90px;">Coût</th>
            <th style="text-align:left;padding:6px 8px;width:180px;">Événements</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr>
            <td colspan="2" style="text-align:right;padding:6px 8px;font-weight:bold;font-size:12px;">Total ${sup}</td>
            <td style="text-align:right;padding:6px 8px;font-weight:bold;color:#9c27b0;">${money(supTotal)}</td>
            <td></td>
          </tr></tfoot>
        </table>`;
    }).join('');

    openPrintWindow(
      'Récapitulatif Location — Tous fournisseurs',
      `<p style="color:#888;font-size:11px;margin:0 0 20px;">${periodLabel} — ${quotes.length} événement${quotes.length > 1 ? 's' : ''} — Imprimé le ${today}</p>
      ${supplierBlocks}
      <p style="margin-top:20px;text-align:right;font-size:14px;font-weight:bold;color:#9c27b0;">
        Total général : ${money(grandTotal)}</p>`
    );
  };

  // Print PDF for a single supplier
  const printSupplier = (supplierName: string) => {
    const items = grouped[supplierName];
    if (!items) return;
    const supTotal = items.reduce((s, r) => s + r.total_cost, 0);
    const rowsHtml = items.map((r) => `
      <tr style="border-bottom:1px solid #f3e5f5;">
        <td style="padding:6px 8px;">${r.material_name}</td>
        <td style="text-align:center;padding:6px 8px;">${r.total_qty}${r.unit ? ` ${r.unit}` : ''}</td>
        <td style="text-align:right;padding:6px 8px;">${money(r.total_cost)}</td>
        <td style="padding:6px 8px;color:#888;font-size:10px;">${r.events.map((e) => `${fmtDate(e.date)} — ${e.client} (${e.qty})`).join('<br>')}</td>
      </tr>`).join('');

    openPrintWindow(
      `Bon de Commande — ${supplierName}`,
      `<p style="color:#888;font-size:11px;margin:0 0 20px;">${periodLabel} — Imprimé le ${today}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#f3e5f5;">
          <th style="text-align:left;padding:6px 8px;">Article</th>
          <th style="text-align:center;padding:6px 8px;width:80px;">Qté totale</th>
          <th style="text-align:right;padding:6px 8px;width:90px;">Coût</th>
          <th style="text-align:left;padding:6px 8px;width:200px;">Détail événements</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="2" style="text-align:right;padding:6px 8px;font-weight:bold;font-size:12px;">Total</td>
          <td style="text-align:right;padding:6px 8px;font-weight:bold;color:#9c27b0;">${money(supTotal)}</td>
          <td></td>
        </tr></tfoot>
      </table>`
    );
  };

  const openPrintWindow = (title: string, body: string) => {
    const htmlStr = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title>
      <style>@page{size:A4 landscape;margin:15mm}html,body{color-scheme:light}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:Georgia,serif;color:#1a1a1a;margin:0;background:#fff;padding:20mm;}</style></head>
      <body><h1 style="color:#9c27b0;font-size:18px;margin:0 0 4px;">${title}</h1>${body}</body></html>`;
    const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 600); };
  };

  const grandTotal = rows.reduce((s, r) => s + r.total_cost, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Location globale</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Récapitulatif des besoins en location de matériel sur une saison / période.
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Calculer les besoins
        </button>
      </div>

      {/* Events summary */}
      {searched && !loading && quotes.length > 0 && (
        <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-[#9c27b0] uppercase tracking-widest mb-2">
            {quotes.length} événement{quotes.length > 1 ? 's' : ''} sur la période
          </p>
          <div className="flex flex-wrap gap-2">
            {quotes.map((q) => (
              <span key={q.id} className="inline-flex items-center gap-1.5 text-xs bg-white border border-purple-200 text-gray-700 px-2.5 py-1 rounded-lg">
                <CalendarDays className="h-3 w-3 text-[#9c27b0]" />
                {fmtDate(q.event_date)} — {q.client_name} ({q.guest_count ?? '?'} conv.)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        rows.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune location trouvée sur cette période.</p>
            <p className="text-xs text-gray-400 mt-1">Vérifiez que vos événements ont une section « Location de matériel » remplie.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500">
                {rows.length} article{rows.length !== 1 ? 's' : ''} — {supplierKeys.length} fournisseur{supplierKeys.length !== 1 ? 's' : ''}
                {' — '}
                <span className="font-bold text-[#9c27b0]">{money(grandTotal)}</span>
              </p>
              <button
                onClick={printGeneral}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9c27b0] border border-[#9c27b0]/30 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Bon général PDF
              </button>
            </div>

            {/* Grouped by supplier */}
            {supplierKeys.map((sup) => {
              const isOpen = expandedSuppliers[sup] !== false;
              const supTotal = grouped[sup].reduce((s, r) => s + r.total_cost, 0);
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
                      <span className="text-xs font-bold text-[#9c27b0]">{money(supTotal)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); printSupplier(sup); }}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#9c27b0] border border-[#9c27b0]/20 rounded-lg hover:bg-purple-50 transition-colors"
                        title={`Bon de commande ${sup}`}
                      >
                        <Printer className="h-3 w-3" />
                        Bon fournisseur
                      </button>
                      {isOpen
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {grouped[sup].map((r, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="flex-1 text-sm text-gray-800">{r.material_name}</span>
                          <span className="text-sm font-bold text-[#9c27b0] tabular-nums bg-purple-50 px-2 py-0.5 rounded-lg">
                            {r.total_qty} {r.unit ?? ''}
                          </span>
                          <span className="text-xs font-semibold text-gray-600 tabular-nums">{money(r.total_cost)}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 max-w-[200px] truncate" title={r.events.map((e) => `${fmtDate(e.date)} ${e.client} (${e.qty})`).join(' | ')}>
                            {r.events.map((e) => `${fmtDate(e.date)} (${e.qty})`).join(', ')}
                          </span>
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
