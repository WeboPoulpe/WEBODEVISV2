export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDayProduction, type DayProduction } from '@/server/eventSheets';
import { combinePlans, frTime } from '@/lib/production';
import RunSheetToolbar from '@/components/evenements/RunSheetToolbar';
import { IngredientTable, ProductionBlock, SHEET_CSS, frDate, guestsLabel, sheetCls, sheetFont } from '@/components/evenements/RunSheetProduction';

// Production du jour : tous les événements confirmés d'une date, avec le total des plats et des
// ingrédients, puis la fiche de production de chaque événement (une page chacun). A4 portrait.

export const metadata: Metadata = { title: 'Production du jour – WeboDevis', robots: { index: false } };

export default async function ProductionDuJourPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  let day: DayProduction | null = null;
  try {
    day = await getDayProduction(date);
  } catch {
    day = null;
  }
  if (!day) notFound();
  const all = combinePlans(day.events.map((e) => e.plan));
  const guests = day.events.reduce((s, e) => s + e.guestCount, 0);

  return (
    <>
      <style>{SHEET_CSS}</style>
      <RunSheetToolbar backHref="/calendrier" />
      <div className={sheetCls} style={sheetFont}>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{day.companyName}</p>
          <h1 className="text-[22px] font-bold leading-tight">Production du jour</h1>
          <p className="text-[13px] text-gray-700 mt-1 first-letter:uppercase">
            {frDate(day.date)}
            {day.events.length > 0 && ` · ${day.events.length} événement${day.events.length > 1 ? 's' : ''} · ${guests} couverts`}
          </p>
        </div>

        {day.events.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun événement confirmé ce jour-là.</p>
        ) : (
          <>
            <h2 className="text-[15px] font-bold mb-2">Événements</h2>
            <table className="w-full border-collapse text-[12px] mb-6">
              <tbody>
                {day.events.map((e) => (
                  <tr key={e.id}>
                    <td className="border-b border-gray-200 py-1.5 pr-3">
                      <span className="font-medium">{e.clientName}</span>
                      {e.eventLocation && <span className="block text-[11px] text-gray-500">{e.eventLocation}</span>}
                    </td>
                    <td className="border-b border-gray-200 py-1.5 pr-3 whitespace-nowrap">{guestsLabel(e)}</td>
                    <td className="border-b border-gray-200 py-1.5 text-right whitespace-nowrap">{e.teamArrivalTime ? `Équipe à ${frTime(e.teamArrivalTime)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {all.dishes.length > 0 && (
              <>
                <h2 className="text-[15px] font-bold mb-2">Total des plats</h2>
                <table className="w-full border-collapse text-[12px] mb-6">
                  <tbody>
                    {all.dishes.map((d) => (
                      <tr key={d.name}>
                        <td className="border-b border-gray-200 py-1.5 pr-3 font-medium">
                          {d.name}{d.events > 1 && <span className="font-normal text-gray-500"> · {d.events} événements</span>}
                        </td>
                        <td className="border-b border-gray-200 py-1.5 text-right tabular-nums font-semibold">{d.toProduce.toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {all.totals.length > 0 && (
              <div className="keep">
                <h2 className="text-[15px] font-bold mb-2">Total des ingrédients</h2>
                <IngredientTable rows={all.totals} caption="Total des ingrédients du jour" />
              </div>
            )}

            {day.events.map((e) => (
              <section key={e.id} className="sheet-break pt-8">
                <h2 className="text-[18px] font-bold leading-tight mb-3">
                  {e.clientName}{e.eventType && <span className="font-normal text-gray-600"> · {e.eventType}</span>}
                </h2>
                <ProductionBlock event={e} showTotals={false} />
              </section>
            ))}
          </>
        )}
        <p className="text-[10px] text-gray-500 mt-5">
          Événements confirmés uniquement. Quantités calculées d’après les recettes. Établie le {new Date().toLocaleDateString('fr-FR')}.
        </p>
      </div>
    </>
  );
}
