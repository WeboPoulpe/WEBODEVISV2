import Link from 'next/link';
import { Clock, MapPin, Navigation, Phone, Users } from 'lucide-react';
import { directionsUrl, frTime } from '@/lib/production';
import { guestsLabel } from '@/components/evenements/RunSheetProduction';
import type { DayViewEvent } from '@/server/dayView';

// Carte d'un événement de « Ma journée » : tout ce qu'il faut sur place ou en cuisine, sur un téléphone.
// Elle s'affiche aussi depuis la copie enregistrée sur l'appareil, sans réseau : les liens « Appeler »
// et « Itinéraire » ouvrent les applications du téléphone et n'ont pas besoin de WeboDevis.

/** Lien d'appel : seuls les chiffres et le « + » comptent. */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** Numéro de téléphone écrit dans un texte libre (« Marc 06 22 22 22 22 »), ou null. */
export function phoneIn(text: string | null): string | null {
  const m = text?.match(/(\+?\d[\d .-]{7,}\d)/);
  return m ? m[1] : null;
}

const actionCls = 'flex-1 min-w-[132px] inline-flex items-center justify-center gap-2 h-11 px-3 rounded-xl text-sm font-semibold';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-3.5 border-t border-gray-200">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      {children}
    </section>
  );
}

export default function DayEventCard({ event }: { event: DayViewEvent }) {
  const clientPhone = event.clientPhone || event.recipientPhone;
  const onsitePhone = phoneIn(event.onsiteContact);
  const allergens = [...new Set(event.dishes.flatMap((d) => d.allergens))];

  return (
    <article className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* ── En-tête : heure, client, lieu, couverts ── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 min-w-[64px] text-center rounded-xl bg-primary-100 text-primary px-2 py-1.5">
            <p className="font-display text-xl font-bold leading-tight tabular-nums">{event.teamArrivalTime ? frTime(event.teamArrivalTime) : '—'}</p>
            <p className="text-[11px] font-medium leading-tight">arrivée</p>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 text-lg leading-snug break-words">{event.clientName}</h2>
            {event.eventType && <p className="text-sm text-gray-600 capitalize">{event.eventType}</p>}
          </div>
        </div>

        <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
          {event.eventLocation && (
            <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" /><span className="break-words">{event.eventLocation}</span></li>
          )}
          <li className="flex items-start gap-2"><Users className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />{guestsLabel(event)}</li>
          {(event.onsiteContact || event.contactPerson) && (
            <li className="flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
              <span className="break-words">
                {event.onsiteContact ? <>Sur place : {event.onsiteContact}</> : <>Contact : {event.contactPerson}{event.recipientRole ? ` (${event.recipientRole})` : ''}</>}
              </span>
            </li>
          )}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {clientPhone && (
            <a href={telHref(clientPhone)} className={`${actionCls} bg-primary text-white`}>
              <Phone className="h-4 w-4" />Appeler le client
            </a>
          )}
          {onsitePhone && onsitePhone !== clientPhone && (
            <a href={telHref(onsitePhone)} className={`${actionCls} bg-primary-100 text-primary`}>
              <Phone className="h-4 w-4" />Appeler sur place
            </a>
          )}
          {event.eventLocation && (
            <a href={directionsUrl(event.eventLocation)} target="_blank" rel="noreferrer" className={`${actionCls} border border-gray-200 text-gray-800`}>
              <Navigation className="h-4 w-4" />Itinéraire
            </a>
          )}
        </div>
      </div>

      {/* ── Allergènes en premier : c'est ce qu'on ne doit pas manquer ── */}
      {allergens.length > 0 && (
        <Section title="Allergènes du menu">
          <div className="flex flex-wrap gap-1.5">
            {allergens.map((a) => <span key={a} className="px-2.5 py-1 rounded-full bg-primary-100 text-primary text-xs font-semibold">{a}</span>)}
          </div>
        </Section>
      )}

      {event.steps.length > 0 && (
        <Section title="Déroulé">
          <ol className="space-y-2">
            {event.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-14 flex-shrink-0 font-display font-semibold text-gray-900 tabular-nums">{s.time ? frTime(s.time) : ''}</span>
                <span className="min-w-0 text-sm text-gray-800">
                  <span className="font-medium">{s.label}</span>
                  {s.note && <span className="block text-gray-500">{s.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {event.team.length > 0 && (
        <Section title={`Équipe (${event.team.length})`}>
          <ul className="divide-y divide-gray-100">
            {event.team.map((m, i) => (
              <li key={i} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.name}{m.role ? <span className="font-normal text-gray-500"> · {m.role}</span> : null}</p>
                  {(m.arrival || m.departure) && (
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      {m.arrival ? frTime(m.arrival) : '?'}{m.departure ? ` → ${frTime(m.departure)}` : ''}
                    </p>
                  )}
                </div>
                {m.phone && (
                  <a href={telHref(m.phone)} className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700" aria-label={`Appeler ${m.name}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(event.dishes.length > 0 || event.otherLines.length > 0) && (
        <Section title="Production">
          <ul className="space-y-2">
            {event.dishes.map((d) => (
              <li key={d.name} className="flex items-start gap-3">
                <span className="w-12 flex-shrink-0 text-right font-display font-semibold text-gray-900 tabular-nums">{d.toProduce}</span>
                <span className="min-w-0 text-sm text-gray-800">
                  {d.name}
                  {d.allergens.length > 0 && <span className="block text-xs text-primary">{d.allergens.join(', ')}</span>}
                </span>
              </li>
            ))}
          </ul>
          {event.otherLines.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">Aussi au devis : {event.otherLines.join(', ')}</p>
          )}
        </Section>
      )}

      {(event.remarks || event.internalNotes) && (
        <Section title="Remarques">
          {event.internalNotes && <p className="text-sm text-gray-800 whitespace-pre-line">{event.internalNotes}</p>}
          {event.remarks && <p className="text-sm text-gray-800 whitespace-pre-line mt-2"><span className="text-gray-500">Mentionné au devis : </span>{event.remarks}</p>}
        </Section>
      )}

      <div className="px-4 py-3 border-t border-gray-200">
        <Link href={`/evenements/${event.id}`} className="text-sm font-medium text-primary hover:underline">Ouvrir la fiche de l’événement</Link>
      </div>
    </article>
  );
}
