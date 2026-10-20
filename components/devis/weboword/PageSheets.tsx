// Feuilles de la vue en pages : une bande couleur du fond entre deux pages (bas de la feuille précédente,
// haut de la suivante), avec « Page N ». Simple superposition : ni imprimée, ni cliquable, jamais dans le devis.
// Styles en ligne : la feuille annule les styles de l'application pour imiter le papier.

import { SHEET_GAP_PX, type PageBand } from './pageView';

const LABEL: React.CSSProperties = { position: 'absolute', right: 16, fontSize: 10, lineHeight: '16px', padding: '0 6px', borderRadius: 4 };

export function PageSheets({ bands }: { bands: PageBand[] }) {
  if (bands.length === 0) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 print:hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {bands.map((b) => b.cut ? (
        // Bloc plus haut qu'une page : le papier le coupe ici.
        <div key={b.nextPage} style={{ position: 'absolute', left: 0, right: 0, top: b.top, borderTop: '2px dashed #c43a3a' }}>
          <span style={{ ...LABEL, top: -18, background: '#fff', color: '#c43a3a', border: '1px solid #f0c4c4' }}>
            Bloc trop long pour une page : il sera coupé ici (page {b.nextPage})
          </span>
        </div>
      ) : (
        <div key={b.nextPage} style={{ position: 'absolute', left: -8, right: -8, top: b.top, height: SHEET_GAP_PX }}>
          <div
            className="bg-slate-100"
            style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 7px 7px -7px rgba(15,23,42,0.28), inset 0 -5px 5px -5px rgba(15,23,42,0.18)' }}
          />
          <span style={{ ...LABEL, top: 4, color: '#94a3b8' }}>Page {b.nextPage}</span>
          {b.nearlyEmpty && (
            <span style={{ ...LABEL, bottom: '100%', marginBottom: 8, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
              Page presque vide
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
