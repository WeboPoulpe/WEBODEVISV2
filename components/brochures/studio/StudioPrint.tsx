'use client';

// Les pages du Studio en A4 pour l'impression : une feuille par page, sans marge, couleurs gardées. La fenêtre
// d'impression s'ouvre seule quand polices et photos sont chargées (« Enregistrer en PDF » dans le navigateur).

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import type { ResolvedStudioPage } from '@/lib/brochureStudio';
import { StudioPageView } from './StudioPage';

export default function StudioPrint({ pages, language, name }: { pages: ResolvedStudioPage[]; language: 'fr' | 'en'; name: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const images = [...document.images].map((img) => (img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); })));
    Promise.all([document.fonts?.ready, ...images]).then(() => {
      if (!alive) return;
      setReady(true);
      // Un temps pour que les textes de prestation s'ajustent à leur cadre.
      window.setTimeout(() => { if (alive) window.print(); }, 400);
    });
    return () => { alive = false; };
  }, []);
  return (
    <div className="wb-print min-h-screen bg-[#e9e4db] py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { margin: 0; background: #fff; }
          /* La feuille de l'app cache tout à l'impression sauf les devis : la brochure se montre. */
          .wb-print, .wb-print * { visibility: visible !important; }
          .wb-print-bar { display: none !important; }
          .wb-print-page { margin: 0 !important; box-shadow: none !important; }
        }
        .wb-print-page { width: 210mm; height: 297mm; position: relative; overflow: hidden; container-type: inline-size; break-after: page; page-break-after: always;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .wb-print-page:last-child { break-after: auto; page-break-after: auto; }
      `}</style>
      <div className="wb-print-bar mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2 text-sm text-[#1C2621]">
        <span>
          <span className="block font-semibold">{name} · {pages.length} page{pages.length > 1 ? 's' : ''}</span>
          <span className="block text-xs text-[#5b5b55]">Dans la fenêtre d’impression : destination « Enregistrer en PDF », marges « Aucune », graphiques d’arrière-plan cochés.</span>
        </span>
        <button type="button" onClick={() => window.print()} disabled={!ready}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#B4502D] px-3 py-2 font-semibold text-white disabled:opacity-60">
          <Printer className="h-4 w-4" /> {ready ? 'Imprimer ou enregistrer en PDF' : 'Préparation…'}
        </button>
      </div>
      {pages.map((page, i) => (
        <div key={i} className="wb-print-page mx-auto mb-6 bg-white shadow-lg">
          <StudioPageView page={page} language={language} />
        </div>
      ))}
    </div>
  );
}
