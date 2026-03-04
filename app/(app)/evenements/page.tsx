'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarRange, ChevronRight, Loader2, Users, MapPin, Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Event {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string | null;
  guest_count: number | null;
  total_amount: number | null;
  status: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  accepted: { label: 'Confirmé',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  sent:     { label: 'Envoyé',    className: 'bg-blue-50 text-blue-700 border border-blue-200'         },
  draft:    { label: 'Brouillon', className: 'bg-gray-100 text-gray-500 border border-gray-200'        },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.className}`}>
      {s.label}
    </span>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event }: { event: Event }) {
  const date = event.event_date
    ? new Date(event.event_date + 'T00:00:00')
    : null;

  const isToday  = date ? date.toDateString() === new Date().toDateString() : false;
  const isPast   = date ? date < new Date() && !isToday : false;

  const dayNum   = date?.toLocaleDateString('fr-FR', { day: 'numeric' });
  const month    = date?.toLocaleDateString('fr-FR', { month: 'short' });
  const fullDate = date?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Link
      href={`/evenements/${event.id}`}
      className={[
        'group flex items-center gap-4 bg-white border rounded-2xl p-4 transition-all hover:shadow-md hover:border-[#9c27b0]/30',
        isPast ? 'opacity-60' : '',
        isToday ? 'border-[#9c27b0]/40 ring-1 ring-[#9c27b0]/20' : 'border-gray-200',
      ].join(' ')}
    >
      {/* Date chip */}
      <div className={[
        'flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center',
        isToday
          ? 'bg-[#9c27b0] text-white'
          : 'bg-gray-50 text-gray-700 border border-gray-200',
      ].join(' ')}>
        {date ? (
          <>
            <span className="text-lg font-bold leading-none">{dayNum}</span>
            <span className="text-[10px] uppercase font-medium leading-none mt-0.5 opacity-70">{month}</span>
          </>
        ) : (
          <Clock className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{event.client_name || 'Client inconnu'}</p>
          {isToday && (
            <span className="text-[10px] font-bold text-[#9c27b0] bg-[#f3e5f5] px-2 py-0.5 rounded-full flex-shrink-0">
              Aujourd&apos;hui
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 capitalize truncate">{event.event_type || '—'}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {fullDate && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <MapPin className="h-3 w-3" />
              {fullDate}
            </span>
          )}
          {event.guest_count && (
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Users className="h-3 w-3" />
              {event.guest_count} couvert{event.guest_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <StatusBadge status={event.status} />
        {event.total_amount != null && (
          <p className="text-sm font-bold text-[#9c27b0] tabular-nums">
            {formatCurrency(event.total_amount)}
          </p>
        )}
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#9c27b0] transition-colors" />
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EvenementsPage() {
  const [events, setEvents]   = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('quotes')
      .select('id, client_name, event_type, event_date, guest_count, total_amount, status')
      .or(`user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
      .not('event_date', 'is', null)
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        setEvents((data ?? []) as Event[]);
        setLoading(false);
      });
  }, [user]);

  // Split: upcoming (today + future) vs past
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => e.event_date && new Date(e.event_date + 'T00:00:00') >= today);
  const past     = events.filter((e) => e.event_date && new Date(e.event_date + 'T00:00:00') < today);

  // Sort upcoming ascending, past descending
  upcoming.sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Événements</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {upcoming.length} à venir · {past.length} passé{past.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/calendrier"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <CalendarRange className="h-4 w-4" />
          Vue calendrier
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <CalendarRange className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">Aucun événement planifié</p>
          <p className="text-sm text-gray-400 mt-1">
            Les devis avec une date d&apos;événement apparaissent ici.
          </p>
          <Link
            href="/devis/nouveau"
            className="mt-4 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] transition-colors"
          >
            Créer un devis
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                À venir — {upcoming.length}
              </p>
              {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Passés — {past.length}
              </p>
              {past.map((e) => <EventCard key={e.id} event={e} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
