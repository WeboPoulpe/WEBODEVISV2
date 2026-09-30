'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isConfirmed, isPending, REJECTED_STATUSES } from '@/lib/quoteStatus';
import { cn, formatCurrency } from '@/lib/utils';
import DateBlock from '@/components/ui/DateBlock';
import StatusPill from '@/components/ui/StatusPill';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Quote {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string;
  event_location: string | null;
  guest_count: number | null;
  total_amount: number | null;
  status: string;
}

/** Au-delà de ce nombre de couverts sur une même journée, la journée est signalée. */
const CAPACITY_THRESHOLD = 300;

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayKey = (q: Quote) => q.event_date.slice(0, 10);

/** Un devis confirmé ouvre la fiche événement ; les autres ouvrent le devis. */
const hrefOf = (q: Quote) => (isConfirmed(q.status) ? `/evenements/${q.id}` : `/devis/${q.id}/modifier`);

/** Semaines du mois, du lundi au dimanche ; null pour les cases hors du mois. */
function buildWeeks(year: number, month: number): (number | null)[][] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

function EventRow({ quote, showDate }: { quote: Quote; showDate: boolean }) {
  return (
    <Link href={hrefOf(quote)} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
      {showDate && <DateBlock iso={quote.event_date} />}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{quote.client_name || 'Sans nom'}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <StatusPill status={quote.status} />
          {quote.event_type && <span className="text-xs text-gray-600 capitalize">{quote.event_type}</span>}
          {!!quote.guest_count && <span className="text-xs text-gray-600">{quote.guest_count} couverts</span>}
        </div>
        {quote.event_location && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mt-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{quote.event_location}
          </p>
        )}
      </div>
      {quote.total_amount != null && (
        <p className="flex-shrink-0 font-display font-bold text-gray-900 tabular-nums">{formatCurrency(quote.total_amount)}</p>
      )}
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CalendrierPage() {
  const now = new Date();
  const todayKey = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from('quotes')
      .select('id, client_name, event_type, event_date, event_location, guest_count, total_amount, status')
      .not('event_date', 'is', null)
      .not('status', 'in', `(${REJECTED_STATUSES.join(',')})`)
      .order('event_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError('Le calendrier n’a pas pu être chargé. Rechargez la page.');
        setQuotes((data ?? []) as Quote[]);
        setLoading(false);
      });
  }, []);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const visible = useMemo(() => (confirmedOnly ? quotes.filter((q) => isConfirmed(q.status)) : quotes), [quotes, confirmedOnly]);
  const monthQuotes = useMemo(() => visible.filter((q) => dayKey(q).startsWith(monthPrefix)), [visible, monthPrefix]);
  const byDay = useMemo(() => {
    const map = new Map<string, Quote[]>();
    for (const q of monthQuotes) map.set(dayKey(q), [...(map.get(dayKey(q)) ?? []), q]);
    return map;
  }, [monthQuotes]);
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(null);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDay(todayKey); };

  const confirmedCount = monthQuotes.filter((q) => isConfirmed(q.status)).length;
  const pendingCount = monthQuotes.filter((q) => isPending(q.status)).length;
  const guests = monthQuotes.reduce((s, q) => s + (q.guest_count ?? 0), 0);

  const agenda = selectedDay ? byDay.get(selectedDay) ?? [] : monthQuotes;
  const selectedDate = selectedDay ? new Date(selectedDay + 'T00:00:00') : null;
  const selectedGuests = agenda.reduce((s, q) => s + (q.guest_count ?? 0), 0);
  const navButton = 'w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors';

  return (
    <div className="px-4 md:px-6 pb-8">
      {/* Mois affiché et navigation */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-4">
        <div>
          <p className="text-sm text-gray-500">Calendrier</p>
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">{MONTHS[month]} {year}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} className={navButton} aria-label="Mois précédent"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={goToday} className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-900 hover:border-gray-300 transition-colors">Aujourd’hui</button>
          <button onClick={() => go(1)} className={navButton} aria-label="Mois suivant"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Résumé du mois et filtre */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-600">
          {loading ? 'Chargement…' : monthQuotes.length === 0
            ? 'Aucun événement ce mois-ci.'
            : `${confirmedCount} confirmé${confirmedCount > 1 ? 's' : ''}, ${pendingCount} en cours, ${guests} couverts`}
        </p>
        <div className="flex p-1 rounded-xl bg-gray-200/70" role="tablist" aria-label="Événements affichés">
          {[{ v: false, label: 'Tous' }, { v: true, label: 'Confirmés' }].map((o) => (
            <button key={o.label} role="tab" aria-selected={confirmedOnly === o.v} onClick={() => setConfirmedOnly(o.v)}
              className={cn('h-9 px-4 rounded-lg text-sm font-medium transition-colors', confirmedOnly === o.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-danger bg-white border border-danger/30 rounded-2xl px-4 py-3">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-3 items-start">
        {/* Grille du mois */}
        <section className="bg-white border border-gray-200 rounded-2xl p-2 sm:p-3">
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <p key={d} className="py-2 text-center text-xs font-medium text-gray-500">
                <span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d.slice(0, 3)}</span>
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const key = iso(year, month, day);
              const events = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const selected = key === selectedDay;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(selected ? null : key)}
                  aria-pressed={selected}
                  aria-label={`${day} ${MONTHS[month]}, ${events.length} événement${events.length > 1 ? 's' : ''}`}
                  className={cn('relative flex flex-col items-center md:items-stretch rounded-xl p-1 md:p-1.5 min-h-[52px] md:min-h-[104px] text-left transition-colors',
                    selected ? 'bg-primary-50 ring-2 ring-primary' : events.length ? 'bg-gray-50 hover:bg-gray-100' : 'hover:bg-gray-50')}
                >
                  <span className={cn('w-7 h-7 flex items-center justify-center rounded-full text-sm tabular-nums',
                    isToday ? 'bg-primary text-white font-semibold' : 'text-gray-900 font-medium')}>
                    {day}
                  </span>

                  {/* Téléphone : un point par événement (plein = confirmé) */}
                  <span className="md:hidden flex gap-0.5 mt-1 h-1.5">
                    {events.slice(0, 4).map((q) => (
                      <span key={q.id} className={cn('w-1.5 h-1.5 rounded-full', isConfirmed(q.status) ? 'bg-primary' : 'border border-primary')} />
                    ))}
                  </span>

                  {/* Tablette et ordinateur : le nom de chaque événement */}
                  <span className="hidden md:flex flex-col gap-1 mt-1 min-w-0">
                    {events.slice(0, 2).map((q) => (
                      <span key={q.id} className={cn('block px-1.5 py-0.5 rounded-md text-xs font-medium truncate',
                        isConfirmed(q.status) ? 'bg-primary text-white' : 'bg-white border border-primary/40 text-primary')}>
                        {q.client_name || q.event_type || 'Sans nom'}
                      </span>
                    ))}
                    {events.length > 2 && <span className="px-1.5 text-xs text-gray-500">+{events.length - 2}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="flex items-center gap-4 px-2 pt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Confirmé</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border border-primary" />En cours</span>
          </p>
        </section>

        {/* Événements du jour choisi, ou du mois */}
        <section className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 first-letter:uppercase">
                {selectedDate ? selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Tout le mois'}
              </h2>
              {selectedDate && agenda.length > 0 && (
                <p className={cn('flex items-center gap-1.5 text-sm mt-0.5', selectedGuests > CAPACITY_THRESHOLD ? 'text-danger font-medium' : 'text-gray-600')}>
                  {selectedGuests > CAPACITY_THRESHOLD && <AlertTriangle className="h-4 w-4" />}
                  {selectedGuests} couverts{selectedGuests > CAPACITY_THRESHOLD ? `, au-delà de ${CAPACITY_THRESHOLD}` : ''}
                </p>
              )}
            </div>
            {selectedDate && (
              <button onClick={() => setSelectedDay(null)} className="flex-shrink-0 text-sm font-medium text-primary hover:underline">Voir tout le mois</button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[76px] rounded-2xl bg-gray-50 animate-pulse" />)}</div>
          ) : agenda.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center">
              <p className="text-sm text-gray-600">{selectedDate ? 'Aucun événement ce jour-là.' : 'Aucun événement ce mois-ci.'}</p>
              <Link href={selectedDay ? `/devis/nouveau?date=${selectedDay}` : '/devis/nouveau'} className="inline-block mt-2 text-sm font-medium text-primary hover:underline">
                {selectedDay ? 'Créer un devis pour ce jour' : 'Créer un devis'}
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {agenda.map((q) => <li key={q.id}><EventRow quote={q} showDate={!selectedDate} /></li>)}
              {selectedDay && (
                <li><Link href={`/devis/nouveau?date=${selectedDay}`} className="block px-4 py-3 rounded-2xl border border-dashed border-gray-300 text-sm font-medium text-primary hover:bg-gray-50">Autre devis ce jour-là</Link></li>
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
