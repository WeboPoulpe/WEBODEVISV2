'use client';

import { useState, useMemo } from 'react';
import { Package, Printer, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CONFIRMED_STATUSES } from '@/lib/quoteStatus';
import { cn } from '@/lib/utils';
import { btnPrimary, btnSecondary, cardCls, inputCls, labelCls } from '@/components/ui/kit';
import { ErrorBanner, esc, money, printDocument } from '@/components/evenements/shared';

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

const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const fmtQty = (n: number) => n.toLocaleString('fr-FR');

export default function LocationGlobalePage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [rows, setRows]           = useState<RentalRow[]>([]);
  const [quotes, setQuotes]       = useState<QuoteInfo[]>([]);
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

    const { data: quotesData, error: quotesErr } = await supabase
      .from('quotes')
      .select('id, event_date, client_name, guest_count')
      .in('status', CONFIRMED_STATUSES)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date');

    if (quotesErr) setError('Les besoins n’ont pas pu être calculés. Réessayez.');
    if (!quotesData || quotesData.length === 0) {
      setRows([]);
      setQuotes([]);
      setLoading(false);
      return;
    }

    setQuotes(quotesData as QuoteInfo[]);
    const quoteIds = quotesData.map((q) => q.id);
    const quoteMap = Object.fromEntries(quotesData.map((q) => [q.id, q]));

    const { data: rentals, error: rentalsErr } = await supabase
      .from('rental_items')
      .select('*, supplier:suppliers(id, name)')
      .in('quote_id', quoteIds)
      .or('confirmed_individually.is.null,confirmed_individually.eq.false');

    if (rentalsErr) setError('Les besoins n’ont pas pu être calculés. Réessayez.');
    if (!rentals || rentals.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Regroupement par article et par fournisseur
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
      if (q) agg[key].events.push({ date: q.event_date, client: q.client_name, qty: r.qty });
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
    setExpandedSuppliers((p) => ({ ...p, [key]: p[key] === false }));

  const today = new Date().toLocaleDateString('fr-FR');
  const periodLabel = startDate && endDate ? `Du ${fmtDate(startDate)} au ${fmtDate(endDate)}` : '';
  const grandTotal = rows.reduce((s, r) => s + r.total_cost, 0);

  const table = (items: RentalRow[], detail: (r: RentalRow) => string, totalLabel: string) => `
    <table>
      <thead><tr><th>Article</th><th class="r" style="width:90px">Quantité</th><th class="r" style="width:90px">Coût</th><th style="width:200px">Événements</th></tr></thead>
      <tbody>${items.map((r) => `<tr>
        <td>${esc(r.material_name)}</td>
        <td class="r">${fmtQty(r.total_qty)}${r.unit ? ` ${esc(r.unit)}` : ''}</td>
        <td class="r">${money(r.total_cost)}</td>
        <td class="muted">${detail(r)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td colspan="2" class="r" style="font-weight:bold;border:0">${esc(totalLabel)}</td>
        <td class="r" style="font-weight:bold;border:0">${money(items.reduce((s, r) => s + r.total_cost, 0))}</td>
        <td style="border:0"></td>
      </tr></tfoot>
    </table>`;

  const print = (title: string, body: string) => {
    if (!printDocument(title, body)) setError('Votre navigateur a bloqué l’ouverture du bon. Autorisez les fenêtres pour ce site, puis réessayez.');
  };

  // Bon général : tous les fournisseurs
  const printGeneral = () => {
    const blocks = supplierKeys.map((sup) => `<h2>${esc(sup)}</h2>${table(
      grouped[sup], (r) => r.events.map((e) => `${fmtDate(e.date)} (${fmtQty(e.qty)})`).join(', '), `Total ${sup}`)}`).join('');
    print('Récapitulatif de location, tous fournisseurs',
      `<p class="muted" style="margin:0 0 12px">${periodLabel}. ${quotes.length} événement${quotes.length > 1 ? 's' : ''}. Imprimé le ${today}.</p>
      ${blocks}
      <p style="margin-top:20px;text-align:right;font-size:14px;font-weight:bold;color:#b4502d">Total général : ${money(grandTotal)}</p>`);
  };

  // Bon d'un seul fournisseur, avec le détail par événement
  const printSupplier = (supplierName: string) => {
    const items = grouped[supplierName];
    if (!items) return;
    print(`Bon de commande : ${supplierName}`,
      `<p class="muted" style="margin:0 0 12px">${periodLabel}. Imprimé le ${today}.</p>
      ${table(items, (r) => r.events.map((e) => `${fmtDate(e.date)}, ${esc(e.client)} (${fmtQty(e.qty)})`).join('<br>'), 'Total')}`);
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Location globale</h1>
        <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
          Additionnez le matériel à louer pour vos événements confirmés sur une période, et sortez un bon par fournisseur.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); search(); }}
        className={cn(cardCls, 'p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] items-end gap-3 mb-5')}>
        <div className="min-w-0">
          <label htmlFor="lg-start" className={labelCls}>Date de début</label>
          <input id="lg-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn(inputCls, 'px-3')} />
        </div>
        <div className="min-w-0">
          <label htmlFor="lg-end" className={labelCls}>Date de fin</label>
          <input id="lg-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={cn(inputCls, 'px-3')} />
        </div>
        <button type="submit" disabled={!startDate || !endDate || loading} className={cn(btnPrimary, 'col-span-2 sm:col-span-1 h-12')}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Calculer les besoins
        </button>
      </form>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      {!searched ? (
        <p className="px-1 text-[15px] text-gray-600">Choisissez une période : la location de tous les événements confirmés qui s’y déroulent est additionnée par fournisseur.</p>
      ) : loading ? null : (
        <div className="space-y-6">
          {quotes.length > 0 && (
            <section>
              <h2 className="px-1 mb-2 text-[15px] font-semibold text-gray-900">
                {quotes.length} événement{quotes.length > 1 ? 's' : ''} sur la période
              </h2>
              <ul className="flex flex-wrap gap-2">
                {quotes.map((q) => (
                  <li key={q.id} className="inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm text-gray-700">
                    <span className="font-semibold text-gray-900 tabular-nums">{fmtDate(q.event_date)}</span>
                    <span className="truncate">{q.client_name}</span>
                    <span className="text-gray-500 whitespace-nowrap">{q.guest_count ?? '?'} couverts</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rows.length === 0 ? (
            <div className={cn(cardCls, 'px-6 py-14 text-center')}>
              <p className="font-semibold text-gray-900">Aucune location sur cette période</p>
              <p className="text-sm text-gray-500 mt-1">Vérifiez que vos événements confirmés ont leur location de matériel remplie.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">
                  {rows.length} article{rows.length !== 1 ? 's' : ''} chez {supplierKeys.length} fournisseur{supplierKeys.length !== 1 ? 's' : ''}, total{' '}
                  <span className="font-semibold text-gray-900">{money(grandTotal)}</span>
                </p>
                <button onClick={printGeneral} className={btnSecondary}><Printer className="h-4 w-4" />Bon général</button>
              </div>

              {supplierKeys.map((sup) => {
                const isOpen = expandedSuppliers[sup] !== false;
                const supTotal = grouped[sup].reduce((s, r) => s + r.total_cost, 0);
                return (
                  <section key={sup}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h2 className="min-w-0">
                        <button onClick={() => toggleSupplier(sup)} aria-expanded={isOpen}
                          className="flex items-center gap-2 min-h-10 px-1 text-[15px] font-semibold text-gray-900 text-left">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                          <span className="break-words min-w-0">{sup}</span>
                          <span className="text-sm font-normal text-gray-500 whitespace-nowrap">{money(supTotal)}</span>
                        </button>
                      </h2>
                      <button onClick={() => printSupplier(sup)} className={cn(btnSecondary, 'h-10 w-10 sm:w-auto px-0 sm:px-3 text-sm flex-shrink-0')}
                        title={`Bon de commande pour ${sup}`} aria-label="Bon fournisseur">
                        <Printer className="h-4 w-4" /><span className="hidden sm:inline">Bon fournisseur</span>
                      </button>
                    </div>
                    {isOpen && (
                      <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
                        {grouped[sup].map((r, i) => (
                          <li key={i} className="flex flex-wrap sm:flex-nowrap items-baseline gap-x-4 gap-y-0.5 px-4 sm:px-5 py-3">
                            <span className="basis-full sm:basis-auto sm:flex-1 min-w-0 text-[15px] text-gray-900 break-words">{r.material_name}</span>
                            <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{fmtQty(r.total_qty)} {r.unit ?? ''}</span>
                            <span className="sm:w-24 sm:text-right text-sm text-gray-700 tabular-nums whitespace-nowrap">{money(r.total_cost)}</span>
                            <span className="basis-full sm:basis-48 sm:text-right text-sm text-gray-500 tabular-nums"
                              title={r.events.map((e) => `${fmtDate(e.date)} ${e.client} (${e.qty})`).join(', ')}>
                              {r.events.map((e) => `${fmtDate(e.date)} (${fmtQty(e.qty)})`).join(', ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
