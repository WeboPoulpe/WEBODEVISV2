// Repères « Fin de la page N » posés sur la feuille de l'éditeur, là où l'impression change de page.
// Simple superposition : ni imprimée, ni modifiable, jamais dans le contenu du devis.

import type { PageEndMarker } from './usePrintPreview';

export function PageEndMarkers({ markers }: { markers: PageEndMarker[] }) {
  if (markers.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 print:hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {markers.map((m) => (
        <div key={m.page} className="absolute left-0 right-0" style={{ top: m.top }}>
          <div className="border-t border-dashed border-gray-400" />
          <div className="absolute right-1.5 -top-2 flex items-center gap-1.5 text-[10px] leading-4">
            {m.nearlyEmpty && (
              <span className="px-1.5 rounded bg-amber-50 text-amber-800 border border-amber-200">Page presque vide</span>
            )}
            <span className="px-1.5 rounded bg-white text-gray-500 border border-gray-200">Fin de la page {m.page}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
