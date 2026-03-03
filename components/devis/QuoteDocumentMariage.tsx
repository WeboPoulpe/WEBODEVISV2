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

// ── Ornament SVG ─────────────────────────────────────────────────────────────
function Flourish() {
  return (
    <div className="flex items-center justify-center my-4 text-[#c8956c]/50 text-[10px] tracking-[0.4em] uppercase font-menu">
      ❧ &nbsp;&nbsp;&nbsp; ❧
    </div>
  );
}

// ── Main document ─────────────────────────────────────────────────────────────
export default function QuoteDocumentMariage({
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
        'flex flex-col bg-[#fffdf7] text-[10.5px]',
        'border border-[#c8956c]/20 rounded-xl overflow-hidden shadow-sm',
        'print:border-0 print:rounded-none print:overflow-visible print:min-h-[297mm]',
      ].join(' ')}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-6 text-center print-block flex-shrink-0 border-b border-[#c8956c]/15">
        {/* Top line */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[#c8956c]/30" />
          <span className="font-menu text-[7px] tracking-[0.35em] text-[#c8956c]/60 uppercase">Proposition de réception</span>
          <div className="flex-1 h-px bg-[#c8956c]/30" />
        </div>

        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoUrl} alt={companyName} className="h-12 max-w-[180px] object-contain mx-auto mb-2" />
        ) : (
          <p className="font-menu font-bold text-[18px] text-[#5c3a1e] leading-tight tracking-wide">{companyName}</p>
        )}
        {companyAddress && <p className="font-menu text-[8.5px] text-[#c8956c]/70 mt-0.5">{companyAddress}</p>}
        {companyPhone  && <p className="font-menu text-[8.5px] text-[#c8956c]/70">{companyPhone}</p>}

        <p className="font-menu text-[8px] text-[#c8956c]/50 mt-2">{displayDate}</p>
      </div>

      {/* ── Event hero ─────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 text-center print-block flex-shrink-0">
        <Flourish />
        <p className="font-menu font-bold text-[20px] text-[#5c3a1e] leading-tight capitalize">{eventType || 'Votre événement'}</p>
        <div className="flex items-center justify-center gap-4 mt-2 font-menu text-[9.5px] text-[#c8956c]/80">
          {eventDate && <span>{formatDate(eventDate)}</span>}
          {guestCount > 0 && <span>· {guestCount} invité{guestCount > 1 ? 's' : ''}</span>}
          {clientName && <span>· Pour {clientName}</span>}
        </div>
        <Flourish />
      </div>

      {/* ── Services ───────────────────────────────────────────────────────── */}
      {servicePages.map((pageServices, pageIdx) => (
        <div key={pageIdx}>
          {pageIdx > 0 && <div className="page-break" />}
          {pageServices.length > 0 && (
            <div className="px-8 pb-4 print-block">
              <div className="space-y-3">
                {pageServices.map((s) => (
                  <div key={s.id} className="print-block">
                    <div className="flex items-baseline gap-0 min-w-0">
                      <span className="font-menu font-semibold text-[11px] text-[#5c3a1e] leading-snug">
                        {s.name}
                        {s.quantity > 1 && <span className="font-normal text-[#c8956c]/60 ml-1 text-[9px]">× {s.quantity}</span>}
                      </span>
                      {!options.hidePrice && (
                        <>
                          <span className="dot-leader" style={{ borderBottomColor: '#c8956c40' }} />
                          <span className="font-menu text-[10px] text-[#c8956c] tabular-nums flex-shrink-0 font-medium">
                            {formatCurrency(s.quantity * s.unitPrice)}
                          </span>
                        </>
                      )}
                    </div>
                    {s.description && (
                      <div className="mt-0.5 pl-2 border-l border-[#c8956c]/20">
                        <div
                          className="font-menu text-[9px] italic text-[#8b6347]/70 leading-relaxed description-html"
                          dangerouslySetInnerHTML={{ __html: s.description }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Totals ─────────────────────────────────────────────────────────── */}
      {!options.hidePrice && realServices.length > 0 && (
        <div className="px-8 pb-6 print-block">
          <div className="h-px bg-[#c8956c]/20 mb-4" />
          <div className="flex justify-end">
            <div className="min-w-[200px] space-y-1 font-menu">
              <div className="flex justify-between text-[10px] text-[#8b6347]/70">
                <span>Total HT</span><span className="tabular-nums">{formatCurrency(ht)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-[#8b6347]/70">
                <span>TVA ({options.vatRate}%)</span><span className="tabular-nums">{formatCurrency(tva)}</span>
              </div>
            </div>
          </div>
          {/* TTC block — gold border */}
          <div className="mt-3 border border-[#c8956c]/40 rounded-xl px-5 py-3.5 bg-[#fffbf5] print-block">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-menu text-[8px] tracking-[0.25em] text-[#c8956c]/70 uppercase font-semibold">Total TTC</p>
                <p className="font-menu text-[8px] italic text-[#c8956c]/50">Toutes taxes comprises</p>
              </div>
              <span className="font-menu font-black text-[26px] text-[#5c3a1e] tabular-nums leading-none">
                {formatCurrency(ttc)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Remarks ────────────────────────────────────────────────────────── */}
      {options.remarks && (
        <div className="px-8 pb-5 print-block">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-px bg-[#c8956c]/20" />
            <span className="font-menu text-[7px] tracking-[0.2em] text-[#c8956c]/50 uppercase">Conditions</span>
            <div className="flex-1 h-px bg-[#c8956c]/20" />
          </div>
          <p className="font-menu text-[9px] text-[#8b6347]/70 whitespace-pre-line leading-relaxed text-center italic">
            {options.remarks}
          </p>
        </div>
      )}

      {/* ── Photo gallery ──────────────────────────────────────────────────── */}
      {images && images.length > 0 && (
        <div className="px-8 py-4 print-block">
          <div className={[
            'grid gap-2',
            images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
          ].join(' ')}>
            {images.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="w-full h-32 object-cover rounded-xl border border-[#c8956c]/20" />
            ))}
          </div>
        </div>
      )}

      {/* ── Signature ──────────────────────────────────────────────────────── */}
      <div className="print:mt-auto px-8 py-6 border-t border-[#c8956c]/15 print-block">
        <Flourish />
        <div className="grid grid-cols-2 gap-10">
          <div className="text-center">
            <p className="font-menu text-[7.5px] tracking-[0.15em] text-[#c8956c]/60 uppercase mb-1">Signature du prestataire</p>
            <div className="h-10 border-b border-[#c8956c]/30 mb-1.5" />
            <p className="font-menu text-[8.5px] text-[#8b6347]/70">{companyName}</p>
          </div>
          <div className="text-center">
            <p className="font-menu text-[7.5px] tracking-[0.15em] text-[#5c3a1e] uppercase mb-0.5 font-semibold">Bon pour accord</p>
            <p className="font-menu text-[8px] italic text-[#c8956c]/50 mb-2.5">Lu et approuvé</p>
            <div className="h-10 border-b border-[#c8956c]/30 mb-1.5" />
            <p className="font-menu text-[8.5px] text-[#8b6347]/70">{clientName || 'Le client'}</p>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-[#c8956c]/10 bg-[#fdf9f3] px-8 py-2 flex items-center justify-between flex-shrink-0">
        <p className="font-menu text-[8px] italic text-[#c8956c]/40">Document confidentiel</p>
        <p className="font-menu text-[8px] text-[#8b6347]/50">{companyName}</p>
      </div>

      {/* ── CGV page 2 ─────────────────────────────────────────────────────── */}
      {cgv && (
        <div className="page-break px-8 py-8 print-block flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#c8956c]/20" />
            <span className="font-menu text-[7px] tracking-[0.2em] text-[#c8956c]/50 uppercase">Conditions Générales de Vente</span>
            <div className="flex-1 h-px bg-[#c8956c]/20" />
          </div>
          <div
            className="font-menu text-[9px] text-[#8b6347]/70 leading-relaxed description-html"
            dangerouslySetInnerHTML={{ __html: cgv }}
          />
        </div>
      )}
    </div>
  );
}
