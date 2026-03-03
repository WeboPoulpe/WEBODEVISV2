'use client';

import { useEffect, useRef } from 'react';
import type { ServiceLine } from '@/context/DevisContext';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Category sort order ────────────────────────────────────────────────────────
const GASTRO_ORDER = [
  'apéritif', 'cocktail', 'mise en bouche', 'entrée', 'plat',
  'fromage', 'dessert', 'mignardise', 'boissons', 'vins', 'bar',
];
const LOGISTIQUE_KEYS = [
  'matériel', 'materiel', 'personnel', 'vaisselle', 'transport',
  'livraison', 'location', 'logistique', 'technique', 'service',
];

function isLogistique(category?: string): boolean {
  if (!category) return false;
  return LOGISTIQUE_KEYS.some((k) => category.toLowerCase().includes(k));
}

function categoryOrder(cat: string | undefined): number {
  if (!cat) return 99;
  const idx = GASTRO_ORDER.findIndex((k) => cat.toLowerCase().includes(k));
  return idx === -1 ? 50 : idx;
}

function groupByCategory(services: ServiceLine[]): Map<string, ServiceLine[]> {
  const map = new Map<string, ServiceLine[]>();
  const sorted = [...services].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
  for (const s of sorted) {
    const key = s.category?.trim() || 'Autres prestations';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

function totalHT(services: ServiceLine[]) {
  return services.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
}

/**
 * Split the service list at page-break markers.
 * Returns an array of service arrays (one per "page section").
 * Page-break items themselves are excluded from each section.
 */
function splitByPageBreaks(services: ServiceLine[]): ServiceLine[][] {
  const pages: ServiceLine[][] = [[]];
  for (const s of services) {
    if (s.isPageBreak) {
      pages.push([]);
    } else {
      pages[pages.length - 1].push(s);
    }
  }
  return pages;
}

// ── Editable inline text ──────────────────────────────────────────────────────
function EditableText({
  value, onSave, className, placeholder, editMode, multiline = false,
}: {
  value: string;
  onSave?: (v: string) => void;
  className?: string;
  placeholder?: string;
  editMode?: boolean;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  // Sync prop → DOM only when the element is not focused
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) {
      el.textContent = value || '';
    }
  }, [value]);

  if (!editMode) {
    return <span className={className}>{value || placeholder}</span>;
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => onSave?.(ref.current?.textContent?.trim() ?? '')}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
        if (e.key === 'Escape') ref.current?.blur();
      }}
      className={[
        className,
        'outline-none cursor-text rounded px-0.5 ring-1 ring-[#9c27b0]/30 bg-[#f3e5f5]/20',
        'hover:ring-[#9c27b0]/50 focus:ring-[#9c27b0] focus:bg-[#f3e5f5]/40 transition-all',
      ].join(' ')}
    >
      {value || ''}
    </span>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center my-4">
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-gray-200" />
        <div>
          <p className="font-menu text-[11px] font-semibold tracking-[0.18em] text-[#9c27b0] uppercase leading-none">{label}</p>
          {sub && <p className="text-[8px] tracking-[0.15em] text-gray-400 uppercase mt-0.5">{sub}</p>}
        </div>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  );
}

function CategoryLabel({ name }: { name: string }) {
  return (
    <p className="font-menu text-[9px] font-semibold tracking-[0.2em] text-gray-400 uppercase mt-3 mb-1.5 first:mt-0">
      {name}
    </p>
  );
}

function MenuLine({
  service, hidePrice, editMode, onEditName,
}: {
  service: ServiceLine; hidePrice: boolean;
  editMode?: boolean;
  onEditName?: (id: string, v: string) => void;
}) {
  const linePrice = service.quantity * service.unitPrice;
  return (
    <div className="mb-2 print-block">
      <div className="flex items-baseline gap-0 min-w-0">
        <EditableText
          value={service.name} placeholder="(sans nom)"
          onSave={(v) => onEditName?.(service.id, v)}
          editMode={editMode}
          className="text-[11px] font-semibold text-gray-900 leading-snug"
        />
        {service.quantity > 1 && (
          <span className="font-normal text-gray-400 ml-1 text-[9px]">× {service.quantity}</span>
        )}
        {!hidePrice && (
          <>
            <span className="dot-leader" />
            <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 font-medium">
              {formatCurrency(linePrice)}
            </span>
          </>
        )}
      </div>
      {/* Description — rendered as HTML (supports bold, italic, lists from RichTextEditor) */}
      {service.description && (
        <div className="mt-0.5 pl-2 border-l-2 border-[#9c27b0]/15">
          <div
            className="font-menu text-[9.5px] italic text-gray-500 leading-relaxed description-html"
            dangerouslySetInnerHTML={{ __html: service.description }}
          />
        </div>
      )}
    </div>
  );
}

function TotalsRow({ label, value, bold, small, accent }: {
  label: string; value: string; bold?: boolean; small?: boolean; accent?: boolean;
}) {
  return (
    <div className={['flex justify-between items-baseline gap-4', small ? 'text-[9.5px]' : 'text-[10.5px]', bold ? 'font-bold' : '', accent ? 'text-[#9c27b0]' : 'text-gray-600'].join(' ')}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function TvaBreakdown({ gastroHT, logistiqueHT, vatRate, hideLogistique }: {
  gastroHT: number; logistiqueHT: number; vatRate: number; hideLogistique: boolean;
}) {
  const gastroTva = gastroHT * (vatRate / 100);
  const logistiqueTva = logistiqueHT * 0.2;
  if (hideLogistique || logistiqueHT === 0)
    return <TotalsRow label={`TVA (${vatRate}%)`} value={formatCurrency(gastroTva)} />;
  return (
    <>
      {gastroHT > 0 && <TotalsRow label={`TVA gastronomie (${vatRate}%)`} value={formatCurrency(gastroTva)} small />}
      <TotalsRow label="TVA services (20%)" value={formatCurrency(logistiqueTva)} small />
    </>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface QuoteDocumentProps {
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  clientName: string;
  eventType: string;
  eventDate: string | null;
  guestCount: number;
  services: ServiceLine[];
  options: { vatRate: number; hidePrice: boolean; remarks?: string; };
  quoteDate?: string;
  editMode?: boolean;
  onEditServiceName?: (id: string, value: string) => void;
  onEditEventType?: (value: string) => void;
  onEditRemarks?: (value: string) => void;
  logoUrl?: string | null;
  cgv?: string | null;
  images?: string[];
}

// ── Main document ─────────────────────────────────────────────────────────────
export default function QuoteDocument({
  companyName, companyAddress, companyPhone,
  clientName, eventType, eventDate, guestCount,
  services, options, quoteDate,
  editMode, onEditServiceName, onEditEventType, onEditRemarks,
  logoUrl, cgv, images,
}: QuoteDocumentProps) {
  // ── Financials (exclude page-break markers from totals) ─────────────────────
  const realServices = services.filter((s) => !s.isPageBreak);
  const gastronomie  = realServices.filter((s) => !isLogistique(s.category));
  const logistique   = realServices.filter((s) =>  isLogistique(s.category));

  const gastroHT     = totalHT(gastronomie);
  const logistiqueHT = totalHT(logistique);
  const ht           = gastroHT + logistiqueHT;
  const gastroTva    = gastroHT * (options.vatRate / 100);
  const logistiqueTva = logistiqueHT > 0 ? logistiqueHT * 0.2 : 0;
  const ttc          = ht + gastroTva + logistiqueTva;

  const displayDate = quoteDate
    ? new Date(quoteDate).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  // ── Page-break splitting ────────────────────────────────────────────────────
  // Each "page" is the list of services between two page-break markers.
  const servicePages = splitByPageBreaks(services);

  // Pre-compute on which page index each section first appears (for section headers)
  const firstGastroIdx = servicePages.findIndex((pg) => pg.some((s) => !isLogistique(s.category)));
  const firstLogiIdx   = servicePages.findIndex((pg) => pg.some((s) =>  isLogistique(s.category)));

  return (
    /*
     * .quote-document is targeted by globals.css @media print:
     *   • visibility: visible (overrides body * { visibility: hidden })
     *   • position: absolute top-0 left-0 width-100% → fills the A4 page
     *
     * flex flex-col + print:min-h-[297mm] lets mt-auto on the signature
     * section push it to the bottom of the last page when content is short.
     */
    <div
      className={[
        'quote-document',
        'bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-[10.5px]',
        'flex flex-col',
        'print:border-0 print:rounded-none print:overflow-visible print:min-h-[297mm]',
        editMode ? 'ring-2 ring-[#9c27b0]/25' : '',
      ].join(' ')}
    >

      {/* ── Purple header ───────────────────────────────────────────────────── */}
      <div className="bg-[#9c27b0] px-6 pt-6 pb-5 print-block flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-menu text-[8px] tracking-[0.25em] text-white/50 uppercase mb-1">Proposé par</p>
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={companyName} className="h-8 max-w-[120px] object-contain mb-0.5 brightness-0 invert" />
            ) : (
              <p className="font-menu font-bold text-[14px] text-white leading-tight">{companyName}</p>
            )}
            {companyAddress && <p className="text-white/55 text-[9px] mt-0.5">{companyAddress}</p>}
            {companyPhone  && <p className="text-white/55 text-[9px]">{companyPhone}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-menu text-[8px] tracking-[0.2em] text-white/50 uppercase">Document</p>
            <p className="font-menu font-bold text-[20px] text-white leading-tight mt-0.5">DEVIS</p>
            <p className="text-white/45 text-[9px] mt-1">{displayDate}</p>
          </div>
        </div>
      </div>

      {/* ── Event block ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 bg-[#faf7fb] border-b border-[#9c27b0]/10 print-block flex-shrink-0">
        <div className="text-center">
          <p className="font-menu text-[8px] tracking-[0.3em] text-[#9c27b0]/60 uppercase mb-1.5">Carte de réception</p>
          <p className="font-menu font-bold text-[15px] text-gray-900 leading-tight">
            <EditableText
              value={eventType} placeholder="Événement"
              onSave={onEditEventType} editMode={editMode}
              className="font-menu font-bold text-[15px] text-gray-900"
            />
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1.5 text-[9.5px] text-gray-500">
            {eventDate && <span>{formatDate(eventDate)}</span>}
            {guestCount > 0 && <span>· {guestCount} couvert{guestCount > 1 ? 's' : ''}</span>}
          </div>
          {clientName && (
            <p className="text-[9px] text-gray-400 mt-1">
              Pour <span className="font-semibold text-gray-600">{clientName}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── Services — one rendering block per page section ─────────────────── */}
      {servicePages.map((pageServices, pageIdx) => {
        const pgGastro = pageServices.filter((s) => !isLogistique(s.category));
        const pgLogi   = pageServices.filter((s) =>  isLogistique(s.category));
        const pgGastroGroups = groupByCategory(pgGastro);
        const pgLogiGroups   = groupByCategory(pgLogi);

        const showGastroHeader = pgGastro.length > 0 && pageIdx === firstGastroIdx;
        const showLogiHeader   = pgLogi.length   > 0 && pageIdx === firstLogiIdx;

        return (
          <div key={pageIdx}>
            {/* CSS page-break before each section after the first */}
            {pageIdx > 0 && <div className="page-break" />}

            {/* Gastronomie section */}
            {(pgGastro.length > 0 || (pageIdx === 0 && gastronomie.length === 0)) && (
              <div className="px-6 print-block">
                {showGastroHeader && (
                  <SectionHeader label="✦  Gastronomie & Saveurs  ✦" sub="Composition du menu" />
                )}
                {gastronomie.length === 0 ? (
                  <p className="text-[9px] text-gray-400 italic text-center py-2 mb-3">Aucune prestation culinaire ajoutée</p>
                ) : (
                  <div className="mb-1">
                    {Array.from(pgGastroGroups.entries()).map(([cat, items]) => (
                      <div key={cat} className="print-block">
                        <CategoryLabel name={cat} />
                        {items.map((s) => (
                          <MenuLine key={s.id} service={s} hidePrice={options.hidePrice}
                            editMode={editMode} onEditName={onEditServiceName} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Logistique section */}
            {pgLogi.length > 0 && (
              <div className="px-6 pb-1 bg-gray-50/60 border-t border-gray-100 print-block">
                {showLogiHeader && (
                  <SectionHeader label="◈  Logistique & Services  ◈" sub="Personnel · Matériel · Transport" />
                )}
                <div className="mb-2">
                  {Array.from(pgLogiGroups.entries()).map(([cat, items]) => (
                    <div key={cat} className="print-block">
                      {pgLogiGroups.size > 1 && <CategoryLabel name={cat} />}
                      {items.map((s) => (
                        <MenuLine key={s.id} service={s} hidePrice={options.hidePrice}
                          editMode={editMode} onEditName={onEditServiceName} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Financial recap ──────────────────────────────────────────────────── */}
      {!options.hidePrice && realServices.length > 0 && (
        <div className="px-6 pb-5 pt-2 print-block">
          <div className="h-px bg-gray-200 mb-3" />

          {logistique.length > 0 && (
            <div className="space-y-0.5 mb-2">
              {gastronomie.length > 0 && (
                <TotalsRow label="Sous-total gastronomie HT" value={formatCurrency(gastroHT)} small />
              )}
              <TotalsRow label="Sous-total logistique HT" value={formatCurrency(logistiqueHT)} small />
              <div className="h-px bg-gray-100 my-1.5" />
            </div>
          )}

          <div className="flex justify-end">
            <div className="min-w-[200px] space-y-1">
              <TotalsRow label="Total HT" value={formatCurrency(ht)} />
              <TvaBreakdown
                gastroHT={gastroHT} logistiqueHT={logistiqueHT}
                vatRate={options.vatRate} hideLogistique={logistique.length === 0}
              />
            </div>
          </div>

          {/* ── Massive TTC block ──────────────────────────────────────────── */}
          <div className="mt-4 bg-[#9c27b0] rounded-xl px-5 py-4 print:rounded-none print-block">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] tracking-[0.25em] text-white/65 uppercase font-semibold leading-none mb-1">
                  Total TTC
                </p>
                <p className="text-[8.5px] text-white/45 font-menu italic">Toutes taxes comprises</p>
              </div>
              <span className="font-menu font-black text-[28px] text-white tabular-nums leading-none tracking-tight">
                {formatCurrency(ttc)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Conditions / Remarks ─────────────────────────────────────────────── */}
      {(options.remarks || editMode) && (
        <div className="px-6 pb-4 bg-gray-50/60 border-t border-gray-100 print-block">
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[8px] font-bold tracking-[0.2em] text-gray-400 uppercase">Conditions</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <EditableText
            value={options.remarks ?? ''} placeholder="Ajouter des conditions ou remarques…"
            onSave={onEditRemarks} editMode={editMode} multiline
            className="text-[9.5px] text-gray-500 whitespace-pre-line leading-relaxed block w-full"
          />
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
              <img key={url} src={url} alt="" className="w-full h-32 object-cover rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/*
       * ── Signature block ───────────────────────────────────────────────────
       * print:mt-auto : in print, the flex-col container has min-h-[297mm].
       * If content is shorter than one A4 page, mt-auto pushes the signature
       * to the bottom of the page — "floating footer" effect.
       * On screen, the parent has no fixed height so mt-auto = 0.
       */}
      <div className="print:mt-auto px-6 py-5 border-t border-gray-200 print-block">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-[8px] font-bold tracking-[0.2em] text-gray-400 uppercase">Signatures</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="grid grid-cols-2 gap-10">
          <div>
            <p className="text-[8px] tracking-[0.15em] text-gray-400 uppercase mb-1">Signature du prestataire</p>
            <div className="h-12 border-b border-gray-300 mb-1.5" />
            <p className="font-menu text-[9px] text-gray-500">{companyName}</p>
          </div>
          <div>
            <p className="text-[8px] tracking-[0.15em] text-[#9c27b0] uppercase mb-0.5 font-semibold">Bon pour accord</p>
            <p className="font-menu text-[8.5px] italic text-gray-400 mb-3">Lu et approuvé</p>
            <div className="h-12 border-b border-gray-300 mb-1.5" />
            <p className="font-menu text-[9px] text-gray-500">{clientName || 'Le client'}</p>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
        <p className="font-menu text-[8.5px] italic text-gray-400">Document non contractuel · Confidentiel</p>
        <p className="font-menu text-[8.5px] text-gray-500">{companyName}</p>
      </div>

      {/* ── CGV — page 2 (print only) ──────────────────────────────────────── */}
      {cgv && (
        <div className="page-break px-6 py-8 print-block flex-shrink-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[8px] font-bold tracking-[0.2em] text-gray-400 uppercase">
              Conditions Générales de Vente
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div
            className="text-[9px] text-gray-600 leading-relaxed description-html"
            dangerouslySetInnerHTML={{ __html: cgv }}
          />
        </div>
      )}
    </div>
  );
}
