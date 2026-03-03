'use client';

import type { QuoteDocumentProps } from './QuoteDocument';
import type { ServiceLine } from '@/context/DevisContext';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function totalHT(services: ServiceLine[]) {
  return services.filter((s) => !s.isPageBreak).reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
}

function splitByPageBreaks(services: ServiceLine[]): ServiceLine[][] {
  const pages: ServiceLine[][] = [[]];
  for (const s of services) {
    if (s.isPageBreak) pages.push([]);
    else pages[pages.length - 1].push(s);
  }
  return pages;
}

function groupByCategory(services: ServiceLine[]): Map<string, ServiceLine[]> {
  const map = new Map<string, ServiceLine[]>();
  for (const s of services) {
    const key = s.category?.trim() || 'Prestations';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

// ── Main document ─────────────────────────────────────────────────────────────
export default function QuoteDocumentBusiness({
  companyName, companyAddress, companyPhone,
  clientName, eventType, eventDate, guestCount,
  services, options, quoteDate,
  logoUrl, cgv, images,
}: QuoteDocumentProps) {
  const realServices = services.filter((s) => !s.isPageBreak);
  const ht = totalHT(services);
  const tva = ht * (options.vatRate / 100);
  const ttc = ht + tva;

  const displayDate = quoteDate
    ? new Date(quoteDate).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const servicePages = splitByPageBreaks(services);

  return (
    <div
      className={[
        'quote-document',
        'flex flex-col bg-white text-[10.5px]',
        'border border-gray-300 rounded-xl overflow-hidden shadow-sm',
        'print:border-0 print:rounded-none print:overflow-visible print:min-h-[297mm]',
      ].join(' ')}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-stretch print-block flex-shrink-0">
        {/* Left accent band */}
        <div className="w-2 bg-slate-900 flex-shrink-0" />

        {/* Header content */}
        <div className="flex-1 flex items-center justify-between px-6 py-5">
          <div>
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={companyName} className="h-9 max-w-[160px] object-contain" />
            ) : (
              <p className="font-semibold text-[16px] text-slate-900 leading-tight">{companyName}</p>
            )}
            {companyAddress && <p className="text-slate-500 text-[8.5px] mt-0.5">{companyAddress}</p>}
            {companyPhone  && <p className="text-slate-500 text-[8.5px]">{companyPhone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[8px] tracking-[0.2em] text-slate-400 uppercase mb-0.5">Document</p>
            <p className="font-bold text-[22px] text-slate-900 leading-tight">DEVIS</p>
            <p className="text-slate-400 text-[8.5px] mt-1">{displayDate}</p>
          </div>
        </div>
      </div>

      {/* ── Event info bar ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900 px-6 py-3 print-block flex-shrink-0">
        <div className="flex items-center gap-6 text-white/90">
          <div>
            <p className="text-[7px] tracking-[0.2em] text-white/40 uppercase mb-0.5">Événement</p>
            <p className="text-[11px] font-semibold capitalize">{eventType || '—'}</p>
          </div>
          {eventDate && (
            <div>
              <p className="text-[7px] tracking-[0.2em] text-white/40 uppercase mb-0.5">Date</p>
              <p className="text-[11px] font-semibold">{formatDate(eventDate)}</p>
            </div>
          )}
          {guestCount > 0 && (
            <div>
              <p className="text-[7px] tracking-[0.2em] text-white/40 uppercase mb-0.5">Couverts</p>
              <p className="text-[11px] font-semibold">{guestCount}</p>
            </div>
          )}
          {clientName && (
            <div className="ml-auto">
              <p className="text-[7px] tracking-[0.2em] text-white/40 uppercase mb-0.5">Pour</p>
              <p className="text-[11px] font-semibold">{clientName}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Services table ─────────────────────────────────────────────────── */}
      {servicePages.map((pageServices, pageIdx) => {
        const groups = groupByCategory(pageServices);
        return (
          <div key={pageIdx}>
            {pageIdx > 0 && <div className="page-break" />}
            {pageServices.length > 0 && (
              <div className="px-0 print-block">
                {/* Table header */}
                {pageIdx === 0 && (
                  <div className="grid grid-cols-[1fr_48px_80px_80px] gap-0 bg-slate-100 border-b border-slate-200">
                    <p className="px-6 py-2 text-[8.5px] font-bold text-slate-500 uppercase tracking-wide">Désignation</p>
                    <p className="px-2 py-2 text-[8.5px] font-bold text-slate-500 uppercase tracking-wide text-center">Qté</p>
                    <p className="px-3 py-2 text-[8.5px] font-bold text-slate-500 uppercase tracking-wide text-right">PU HT</p>
                    {!options.hidePrice && (
                      <p className="px-4 py-2 text-[8.5px] font-bold text-slate-500 uppercase tracking-wide text-right">Total HT</p>
                    )}
                  </div>
                )}

                {Array.from(groups.entries()).map(([cat, items], gi) => (
                  <div key={cat} className="print-block">
                    {groups.size > 1 && (
                      <div className="bg-slate-50 border-b border-slate-100">
                        <p className="px-6 py-1.5 text-[8.5px] font-semibold text-slate-600 uppercase tracking-wide">{cat}</p>
                      </div>
                    )}
                    {items.map((s, idx) => (
                      <div
                        key={s.id}
                        className={[
                          'grid grid-cols-[1fr_48px_80px_80px] gap-0 border-b border-slate-50 print-block',
                          (gi + idx) % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                        ].join(' ')}
                      >
                        <div className="px-6 py-2">
                          <p className="text-[10.5px] font-medium text-slate-900">{s.name}</p>
                          {s.description && (
                            <div
                              className="text-[8.5px] text-slate-500 mt-0.5 description-html"
                              dangerouslySetInnerHTML={{ __html: s.description }}
                            />
                          )}
                        </div>
                        <p className="px-2 py-2 text-[10px] text-slate-700 text-center tabular-nums self-start pt-2.5">{s.quantity}</p>
                        <p className="px-3 py-2 text-[10px] text-slate-700 text-right tabular-nums self-start pt-2.5">
                          {formatCurrency(s.unitPrice)}
                        </p>
                        {!options.hidePrice && (
                          <p className="px-4 py-2 text-[10px] font-semibold text-slate-900 text-right tabular-nums self-start pt-2.5">
                            {formatCurrency(s.quantity * s.unitPrice)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Totals ─────────────────────────────────────────────────────────── */}
      {!options.hidePrice && realServices.length > 0 && (
        <div className="px-6 py-4 print-block">
          <div className="flex justify-end">
            <div className="min-w-[220px] space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Total HT</span>
                <span className="tabular-nums font-medium">{formatCurrency(ht)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>TVA ({options.vatRate}%)</span>
                <span className="tabular-nums">{formatCurrency(tva)}</span>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              {/* TTC — slate solid block */}
              <div className="flex justify-between items-center bg-slate-900 rounded-lg px-4 py-2.5">
                <p className="text-[9px] tracking-[0.15em] text-white/60 uppercase font-semibold">Total TTC</p>
                <span className="font-bold text-[22px] text-white tabular-nums leading-none">
                  {formatCurrency(ttc)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Remarks ────────────────────────────────────────────────────────── */}
      {options.remarks && (
        <div className="px-6 pb-4 bg-slate-50 border-t border-slate-100 print-block">
          <p className="text-[8.5px] font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-1.5">Conditions</p>
          <p className="text-[9.5px] text-slate-600 whitespace-pre-line leading-relaxed">{options.remarks}</p>
        </div>
      )}

      {/* ── Photo gallery ──────────────────────────────────────────────────── */}
      {images && images.length > 0 && (
        <div className="px-6 py-4 print-block">
          <div className={[
            'grid gap-2',
            images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
          ].join(' ')}>
            {images.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
            ))}
          </div>
        </div>
      )}

      {/* ── Signature ──────────────────────────────────────────────────────── */}
      <div className="print:mt-auto px-6 py-5 border-t border-slate-200 print-block">
        <div className="grid grid-cols-2 gap-10">
          <div>
            <p className="text-[7.5px] tracking-[0.15em] text-slate-400 uppercase mb-1">Signature du prestataire</p>
            <div className="h-12 border-b border-slate-300 mb-1.5" />
            <p className="text-[9px] text-slate-500">{companyName}</p>
          </div>
          <div>
            <p className="text-[7.5px] tracking-[0.15em] text-slate-700 uppercase mb-0.5 font-semibold">Bon pour accord</p>
            <p className="text-[8px] italic text-slate-400 mb-3">Lu et approuvé</p>
            <div className="h-12 border-b border-slate-300 mb-1.5" />
            <p className="text-[9px] text-slate-500">{clientName || 'Le client'}</p>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 bg-slate-50 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <p className="text-[8px] italic text-slate-400">Document confidentiel · Non contractuel</p>
        <p className="text-[8px] text-slate-500">{companyName}</p>
      </div>

      {/* ── CGV page 2 ─────────────────────────────────────────────────────── */}
      {cgv && (
        <div className="page-break px-6 py-8 print-block flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[8px] font-bold tracking-[0.2em] text-slate-400 uppercase">Conditions Générales de Vente</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div
            className="text-[9px] text-slate-600 leading-relaxed description-html"
            dangerouslySetInnerHTML={{ __html: cgv }}
          />
        </div>
      )}
    </div>
  );
}
