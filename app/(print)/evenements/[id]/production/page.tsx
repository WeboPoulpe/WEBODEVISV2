export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductionSheet, type EventProduction } from '@/server/eventSheets';
import RunSheetToolbar from '@/components/evenements/RunSheetToolbar';
import { ProductionBlock, SHEET_CSS, sheetCls, sheetFont } from '@/components/evenements/RunSheetProduction';

// Fiche de production cuisine d'un événement : ce qu'il faut produire et avec quoi. A4 portrait.

export const metadata: Metadata = { title: 'Fiche de production – WeboDevis', robots: { index: false } };

export default async function FicheProductionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let sheet: EventProduction | null = null;
  try {
    sheet = await getProductionSheet(id);
  } catch {
    sheet = null;
  }
  if (!sheet) notFound();

  return (
    <>
      <style>{SHEET_CSS}</style>
      <RunSheetToolbar backHref={`/evenements/${id}`} />
      {sheet.plan.withoutRecipe.length > 0 && (
        <p className="no-print max-w-[210mm] mx-auto px-4 -mt-2 mb-3 text-sm text-amber-800">
          Sans recette renseignée dans Prestations : {sheet.plan.withoutRecipe.join(', ')}. Leurs ingrédients ne sont pas comptés.
        </p>
      )}
      <div className={sheetCls} style={sheetFont}>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{sheet.companyName}</p>
          <h1 className="text-[22px] font-bold leading-tight">Fiche de production</h1>
          <p className="text-[13px] text-gray-700 mt-1">
            {[sheet.clientName, sheet.eventType, sheet.quoteNumber ? `devis n° ${sheet.quoteNumber}` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ProductionBlock event={sheet} />
        <p className="text-[10px] text-gray-500 mt-5">
          Quantités calculées d’après les recettes (quantité par personne × couverts). Établie le {new Date().toLocaleDateString('fr-FR')}.
        </p>
      </div>
    </>
  );
}
