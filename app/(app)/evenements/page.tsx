'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn, formatCurrency } from '@/lib/utils';
import { CONFIRMED_STATUSES } from '@/lib/quoteStatus';
import DateBlock from '@/components/ui/DateBlock';
import StatusPill from '@/components/ui/StatusPill';

// Un événement est un devis confirmé (validé, acompte reçu ou payé) qui a une date.
interface Event {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string;
  event_location: string | null;
  guest_count: number | null;
  total_amount: number | null;
  status: string;
}

type Scope = 'upcoming' | 'past';

function EventCard({ event, today }: { event: Event; today: string }) {
  const isToday = event.event_date.slice(0, 10) === today;
  return (
    <Link href={`/evenements/${event.id}`} className="flex items-center gap-4 p-3 sm:p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-colors">
      <DateBlock iso={event.event_date} today={isToday} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{event.client_name || 'Sans nom'}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {isToday && <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-medium">Aujourd’hui</span>}
          {event.event_type && <span className="px-2.5 py-0.5 rounded-full bg-primary-100 text-primary text-xs font-medium capitalize">{event.event_type}</span>}
          {!!event.guest_count && <span className="px-2.5 py-0.5 rounded-full bg-sage-100 text-sage text-xs font-medium">{event.guest_count} couverts</span>}
          <StatusPill status={event.status} className="hidden sm:inline-flex" />
        </div>
        {event.event_location && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mt-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{event.event_location}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        {event.total_amount != null && <p className="hidden sm:block font-display font-bold text-gray-900 tabular-nums">{formatCurrency(event.total_amount)}</p>}
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}

export default function EvenementsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('upcoming');

  useEffect(() => {
    createClient()
      .from('quotes')
      .select('id, client_name, event_type, event_date, event_location, guest_count, total_amount, status')
      .in('status', CONFIRMED_STATUSES)
      .not('event_date', 'is', null)
      .order('event_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError('Les événements n’ont pas pu être chargés. Rechargez la page.');
        setEvents((data ?? []) as Event[]);
        setLoading(false);
      });
  }, []);

  const today = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-JJ, heure locale
  const { upcoming, past } = useMemo(() => ({
    upcoming: events.filter((e) => e.event_date.slice(0, 10) >= today),
    // Les plus récents d'abord.
    past: events.filter((e) => e.event_date.slice(0, 10) < today).reverse(),
  }), [events, today]);
  const shown = scope === 'upcoming' ? upcoming : past;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
        <div>
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">Événements</h1>
          <p className="text-sm text-gray-600 mt-1">Vos devis confirmés, à préparer puis à servir.</p>
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70" role="tablist" aria-label="Période">
          {([['upcoming', `À venir (${upcoming.length})`], ['past', `Passés (${past.length})`]] as [Scope, string][]).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={scope === key} onClick={() => setScope(key)}
              className={cn('h-9 px-4 rounded-lg text-sm font-medium transition-colors', scope === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-danger bg-white border border-danger/30 rounded-2xl px-4 py-3">{error}</p>}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[88px] rounded-2xl bg-white border border-gray-200 animate-pulse" />)}</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl bg-white border border-gray-200 px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">{scope === 'upcoming' ? 'Aucun événement à venir' : 'Aucun événement passé'}</p>
          <p className="text-sm text-gray-600 mt-1">Un devis apparaît ici dès qu’il est validé et qu’il a une date.</p>
          <Link href="/devis" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">Voir les devis en cours</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((e) => <li key={e.id}><EventCard event={e} today={today} /></li>)}
        </ul>
      )}
    </div>
  );
}
