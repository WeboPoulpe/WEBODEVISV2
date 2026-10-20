export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRunSheet, type EventRunSheet, type RunSheetMaterial } from '@/server/eventSheets';
import { directionsUrl, frTime } from '@/lib/production';
import { missionStatus } from '@/lib/extras';
import RunSheetToolbar from '@/components/evenements/RunSheetToolbar';
import { Fact, SHEET_CSS, frDate, guestsLabel, sheetCls, sheetFont } from '@/components/evenements/RunSheetProduction';

// Feuille de route d'un événement, à remettre à l'équipe : contacts, lieu, horaires, déroulé,
// équipe et matériel à emporter. A4 portrait.

export const metadata: Metadata = { title: 'Feuille de route – WeboDevis', robots: { index: false } };

const h2 = 'text-[15px] font-bold mb-2 mt-6';
const td = 'border-b border-gray-200 py-1.5 pr-3 align-top';

function Tel({ value }: { value: string }) {
  return <a href={`tel:${value.replace(/[^\d+]/g, '')}`} className="underline decoration-gray-300">{value}</a>;
}

const qtyLabel = (m: RunSheetMaterial) => `${m.qty.toLocaleString('fr-FR')}${m.unit ? ` ${m.unit}` : ''}`;

interface Contact { who: string; name: string; phone: string | null; email: string | null }

export default async function FeuilleDeRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let sheet: EventRunSheet | null = null;
  try {
    sheet = await getRunSheet(id);
  } catch {
    sheet = null;
  }
  if (!sheet) notFound();

  const contacts: Contact[] = [
    { who: 'Client', name: sheet.contactPerson ? `${sheet.clientName} (${sheet.contactPerson})` : sheet.clientName, phone: sheet.clientPhone, email: sheet.clientEmail },
  ];
  if (sheet.recipientPhone || sheet.recipientEmail) {
    contacts.push({ who: sheet.recipientRole || 'Contact', name: '', phone: sheet.recipientPhone, email: sheet.recipientEmail });
  }
  if (sheet.onsiteContact) contacts.push({ who: 'Sur place', name: sheet.onsiteContact, phone: null, email: null });
  const toBring = [...sheet.materials, ...sheet.rentals];

  return (
    <>
      <style>{SHEET_CSS}</style>
      <RunSheetToolbar backHref={`/evenements/${id}`} />
      <div className={sheetCls} style={sheetFont}>
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">{sheet.companyName}</p>
          <h1 className="text-[22px] font-bold leading-tight">Feuille de route</h1>
          <p className="text-[13px] text-gray-700 mt-1">
            {[sheet.clientName, sheet.eventType, sheet.quoteNumber ? `devis n° ${sheet.quoteNumber}` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-y border-gray-300 py-3">
          <Fact label="Date"><span className="first-letter:uppercase inline-block">{frDate(sheet.eventDate) || 'À fixer'}</span></Fact>
          <Fact label="Lieu">
            {sheet.eventLocation || 'À préciser'}
            {sheet.eventLocation && (
              <a href={directionsUrl(sheet.eventLocation)} target="_blank" rel="noreferrer" className="no-print block text-[12px] font-normal text-primary underline">Itinéraire</a>
            )}
          </Fact>
          <Fact label="Arrivée de l’équipe">{sheet.teamArrivalTime ? frTime(sheet.teamArrivalTime) : 'À fixer'}</Fact>
          <Fact label="Couverts">{guestsLabel(sheet)}</Fact>
        </div>

        <h2 className={h2}>Contacts</h2>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {contacts.map((c) => (
              <tr key={c.who}>
                <td className={`${td} w-[30mm] text-gray-500`}>{c.who}</td>
                <td className={td}>
                  {c.name && <span className="font-medium">{c.name}</span>}
                  {c.phone && <span className="block"><Tel value={c.phone} /></span>}
                  {c.email && <span className="block text-gray-600 break-all">{c.email}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className={h2}>Déroulé</h2>
        {sheet.steps.length === 0 ? (
          <p className="text-[12px] text-gray-600">Aucun déroulé saisi : complétez-le dans la section « Feuille de route » de la fiche événement.</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {sheet.steps.map((s, i) => (
                <tr key={i}>
                  <td className={`${td} w-[18mm] font-semibold tabular-nums whitespace-nowrap`}>{s.time ? frTime(s.time) : ''}</td>
                  <td className={td}>
                    <span className="font-medium">{s.label}</span>
                    {s.note && <span className="block text-gray-600">{s.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2 className={h2}>Équipe</h2>
        {sheet.team.length === 0 ? (
          <p className="text-[12px] text-gray-600">Aucun extra sur cet événement.</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                <th className="font-medium pb-1 pr-3">Nom</th>
                <th className="font-medium pb-1 pr-3">Téléphone</th>
                <th className="font-medium pb-1 pr-3">Horaires</th>
                <th className="font-medium pb-1">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sheet.team.map((m, i) => (
                <tr key={i}>
                  <td className={td}>
                    <span className="font-medium">{m.name}</span>
                    {m.role && <span className="block text-gray-600">{m.role}</span>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{m.phone ? <Tel value={m.phone} /> : ''}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {m.arrival || m.departure ? `${m.arrival ? frTime(m.arrival) : '?'} – ${m.departure ? frTime(m.departure) : '?'}` : ''}
                  </td>
                  <td className={`${td} pr-0 whitespace-nowrap`}>{missionStatus(m.status).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {toBring.length > 0 && (
          <>
            <h2 className={h2}>Matériel à emporter</h2>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {toBring.map((m, i) => (
                  <tr key={i}>
                    <td className={td}>
                      <span className="inline-block w-3 h-3 mr-2 align-[-1px] border border-gray-400 rounded-sm" aria-hidden />{m.name}
                      {m.supplier && <span className="text-gray-500"> · loué chez {m.supplier}</span>}
                    </td>
                    <td className={`${td} pr-0 text-right tabular-nums font-semibold whitespace-nowrap`}>{qtyLabel(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {(sheet.internalNotes || sheet.remarks) && (
          <>
            <h2 className={h2}>Remarques</h2>
            {sheet.internalNotes && <p className="text-[12px] whitespace-pre-line">{sheet.internalNotes}</p>}
            {sheet.remarks && <p className="text-[12px] whitespace-pre-line mt-2"><span className="text-gray-500">Mentionné au devis : </span>{sheet.remarks}</p>}
          </>
        )}

        <p className="text-[10px] text-gray-500 mt-6">Établie le {new Date().toLocaleDateString('fr-FR')}.</p>
      </div>
    </>
  );
}
