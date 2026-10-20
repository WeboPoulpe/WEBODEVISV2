export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ALLERGENS } from '@/lib/allergens';
import { getQuoteAllergenSheet, type QuoteAllergenSheet } from '@/server/allergenSheet';
import AllergenSheetToolbar from '@/components/allergens/AllergenSheetToolbar';

// Fiche allergènes d'un devis : un tableau plats × 14 allergènes, à remettre au client ou à afficher sur le buffet.
// A4 paysage pour que les 14 colonnes restent lisibles.

export const metadata: Metadata = { title: 'Fiche allergènes – WeboDevis', robots: { index: false } };

const CSS = `
  html, body { background: #EFEBE3; }
  @page { size: A4 landscape; margin: 10mm; }
  @media print {
    html, body { background: #fff !important; }
    .allergen-sheet, .allergen-sheet * { visibility: visible !important; }
    .allergen-sheet { position: absolute !important; top: 0; left: 0; width: 277mm !important; box-shadow: none !important; padding: 0 !important; }
  }
  .allergen-sheet th.vertical span { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; }
`;

const frDate = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default async function FicheAllergenesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let sheet: QuoteAllergenSheet | null = null;
  try {
    sheet = await getQuoteAllergenSheet(id);
  } catch {
    sheet = null;
  }
  if (!sheet) notFound();
  const toCheck = sheet.rows.filter((r) => !r.checked).length;

  return (
    <>
      <style>{CSS}</style>
      <AllergenSheetToolbar quoteId={id} />
      {toCheck > 0 && (
        <p className="no-print max-w-[297mm] mx-auto px-4 -mt-2 mb-3 text-sm text-amber-800">
          {toCheck === 1 ? '1 plat n’a' : `${toCheck} plats n’ont`} pas encore d’allergènes vérifiés : contrôlez-les dans Prestations avant de remettre cette fiche.
        </p>
      )}
      <div className="allergen-sheet bg-white mx-auto max-w-[297mm] p-[10mm] shadow-sm text-gray-900" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <div className="flex items-end justify-between gap-6 mb-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{sheet.companyName}</p>
            <h1 className="text-[22px] font-bold leading-tight">Allergènes du menu</h1>
            <p className="text-[12px] text-gray-600 mt-1">
              {[sheet.eventType, frDate(sheet.eventDate), sheet.clientName, sheet.guestCount ? `${sheet.guestCount} couverts` : '', sheet.quoteNumber ? `devis n° ${sheet.quoteNumber}` : '']
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          <p className="text-[10px] text-gray-500 max-w-[90mm] text-right">
            Les 14 allergènes à déclaration obligatoire (règlement UE n° 1169/2011). Pour toute allergie, adressez-vous au personnel.
          </p>
        </div>

        {sheet.rows.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun plat de ce devis n’est relié au catalogue des prestations : la fiche ne peut pas être établie.</p>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="text-left align-bottom font-semibold border-b-2 border-gray-800 py-2 pr-3">Plat</th>
                {ALLERGENS.map((a) => (
                  <th key={a.key} className="vertical align-bottom font-semibold border-b-2 border-gray-800 px-1 py-2 w-[7mm]" title={a.detail}>
                    <span>{a.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((r) => (
                <tr key={r.dish} className="break-inside-avoid">
                  <td className="border-b border-gray-200 py-2 pr-3 font-medium">{r.dish}</td>
                  {ALLERGENS.map((a) => (
                    <td key={a.key} className="border-b border-l border-gray-200 text-center">
                      {r.keys.includes(a.key) ? <span className="inline-block w-3.5 h-3.5 rounded-full bg-gray-900" aria-label={`Contient : ${a.label}`} /> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[10px] text-gray-500 mt-4">● : le plat contient cet allergène ou des traces. Établie le {new Date().toLocaleDateString('fr-FR')}.</p>
        {sheet.unmatched.length > 0 && (
          <p className="no-print text-[11px] text-gray-500 mt-3">
            Lignes du devis sans prestation au catalogue, non reprises : {sheet.unmatched.join(', ')}.
          </p>
        )}
      </div>
    </>
  );
}
