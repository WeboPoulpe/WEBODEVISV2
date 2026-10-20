// Feuilles de la vue en pages : une bande couleur du fond entre deux pages (bas de la feuille précédente,
// haut de la suivante), avec « Page N ». Simple superposition : ni imprimée, ni cliquable, jamais dans le devis.

import { SHEET_GAP_PX, type PageBand } from './pageView';

export function PageSheets({ bands }: { bands: PageBand[] }) {
  if (bands.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 print:hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {bands.map((b) => (
        <div key={b.nextPage} className="absolute -left-2 -right-2" style={{ top: b.top, height: SHEET_GAP_PX }}>
          <div
            className="absolute inset-0 bg-slate-100"
            style={{ boxShadow: 'inset 0 7px 7px -7px rgba(15,23,42,0.28), inset 0 -5px 5px -5px rgba(15,23,42,0.18)' }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] leading-none text-gray-400">Page {b.nextPage}</span>
          {b.nearlyEmpty && (
            <span className="absolute right-4 bottom-full mb-2 px-1.5 text-[10px] leading-4 rounded bg-amber-50 text-amber-800 border border-amber-200">
              Page presque vide
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
