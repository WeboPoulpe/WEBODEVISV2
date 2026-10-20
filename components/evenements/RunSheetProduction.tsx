import { allergenLabels, formatQuantity, frTime, type IngredientTotal } from '@/lib/production';
import type { EventHeading, EventProduction } from '@/server/eventSheets';

// Morceaux communs des documents imprimables de l'événement (A4 portrait) : styles d'impression,
// en-tête de l'événement et fiche de production d'un événement. Rendu serveur, sans interaction.

export const SHEET_CSS = `
  html, body { background: #EFEBE3; }
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    html, body { background: #fff !important; }
    .event-sheet, .event-sheet * { visibility: visible !important; }
    .event-sheet { position: absolute !important; top: 0; left: 0; width: 186mm !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
    .event-sheet .sheet-break { break-before: page; }
  }
  .event-sheet h2, .event-sheet h3, .event-sheet tr, .event-sheet .keep { break-inside: avoid; }
  .event-sheet h2, .event-sheet h3 { break-after: avoid; }
`;

export const sheetCls = 'event-sheet bg-white mx-auto max-w-[210mm] p-[12mm] shadow-sm text-gray-900 mb-8';
export const sheetFont = { fontFamily: 'system-ui, sans-serif' };

export const frDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** « 40 couverts (32 adultes, 8 enfants) ». */
export function guestsLabel(e: Pick<EventHeading, 'guestCount' | 'adults' | 'children'>) {
  const detail = [e.adults ? `${e.adults} adulte${e.adults > 1 ? 's' : ''}` : '', e.children ? `${e.children} enfant${e.children > 1 ? 's' : ''}` : '']
    .filter(Boolean).join(', ');
  return `${e.guestCount} couvert${e.guestCount > 1 ? 's' : ''}${detail ? ` (${detail})` : ''}`;
}

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-[13px] font-medium break-words">{children}</p>
    </div>
  );
}

export function IngredientTable({ rows, caption }: { rows: IngredientTotal[]; caption?: string }) {
  return (
    <table className="w-full border-collapse text-[12px]">
      {caption && <caption className="sr-only">{caption}</caption>}
      <tbody>
        {rows.map((t) => (
          <tr key={`${t.ingredient_id}|${t.unit}`}>
            <td className="border-b border-gray-200 py-1.5 pr-3">
              <span className="inline-block w-3 h-3 mr-2 align-[-1px] border border-gray-400 rounded-sm" aria-hidden />{t.name}
            </td>
            <td className="border-b border-gray-200 py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">{formatQuantity(t.quantity, t.unit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Fiche de production d'un événement : infos, plats à produire, détail par plat et récapitulatif. */
export function ProductionBlock({ event, showTotals = true }: { event: EventProduction; showTotals?: boolean }) {
  const { plan } = event;
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-y border-gray-300 py-3 mb-5">
        <Fact label="Date"><span className="first-letter:uppercase inline-block">{frDate(event.eventDate) || 'À fixer'}</span></Fact>
        <Fact label="Lieu">{event.eventLocation || 'À préciser'}</Fact>
        <Fact label="Arrivée de l’équipe">{event.teamArrivalTime ? frTime(event.teamArrivalTime) : 'À fixer'}</Fact>
        <Fact label="Couverts">{guestsLabel(event)}</Fact>
      </div>

      {plan.dishes.length === 0 ? (
        <p className="text-sm text-gray-600">Aucun plat de ce devis n’est relié au catalogue des prestations : la fiche ne peut pas être établie.</p>
      ) : (
        <>
          <h2 className="text-[15px] font-bold mb-2">Plats à produire</h2>
          <table className="w-full border-collapse text-[12px] mb-6">
            <thead>
              <tr>
                <th className="text-left font-semibold border-b-2 border-gray-800 py-1.5 pr-3">Plat</th>
                <th className="text-right font-semibold border-b-2 border-gray-800 py-1.5 w-[24mm]">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {plan.dishes.map((d) => (
                <tr key={d.name}>
                  <td className="border-b border-gray-200 py-1.5 pr-3">
                    <span className="font-medium">{d.name}</span>
                    {d.allergens.length > 0 && <span className="block text-[10px] text-gray-500">Allergènes : {allergenLabels(d.allergens)}</span>}
                  </td>
                  <td className="border-b border-gray-200 py-1.5 text-right tabular-nums font-semibold">{d.toProduce.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-[15px] font-bold mb-2">Détail par plat</h2>
          <div className="space-y-4 mb-6">
            {plan.dishes.map((d) => (
              <div key={d.name} className="keep">
                <h3 className="text-[13px] font-semibold">
                  {d.name} <span className="font-normal text-gray-600">· {d.toProduce.toLocaleString('fr-FR')} à produire</span>
                </h3>
                {d.allergens.length > 0 && <p className="text-[10px] text-gray-500">Allergènes : {allergenLabels(d.allergens)}</p>}
                {d.ingredients.length === 0
                  ? <p className="text-[12px] text-gray-500 mt-1">Recette non renseignée dans Prestations.</p>
                  : <div className="mt-1"><IngredientTable rows={d.ingredients} caption={`Ingrédients : ${d.name}`} /></div>}
              </div>
            ))}
          </div>

          {showTotals && plan.totals.length > 0 && (
            <div className="keep">
              <h2 className="text-[15px] font-bold mb-2">Récapitulatif des ingrédients</h2>
              <IngredientTable rows={plan.totals} caption="Récapitulatif des ingrédients" />
            </div>
          )}
        </>
      )}

      {plan.unmatched.length > 0 && (
        <p className="no-print text-[11px] text-gray-500 mt-4">
          Lignes du devis sans prestation au catalogue, non reprises : {plan.unmatched.join(', ')}.
        </p>
      )}
    </div>
  );
}
