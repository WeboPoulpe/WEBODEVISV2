'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, CalendarDays, Users, MapPin, FileText,
  AlertTriangle, Eye, X, ExternalLink, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import Sheet from '@/components/ui/Sheet';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Quote {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string;         // ISO date string — guaranteed non-null (filtered at fetch)
  guest_count: number | null;
  total_amount: number | null;
  status: string;
  client_address: string | null;
  services: ServiceLine[] | null;
}

interface ServiceLine {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  isPageBreak?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────
/** Beyond this number of guests on a single day the cell turns red */
const CAPACITY_THRESHOLD = 300;

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR  = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ── Status helpers ─────────────────────────────────────────────────────────────
const CONFIRMED = new Set(['accepted']);
const PENDING   = new Set(['sent', 'pending']);

function quoteVariant(status: string): 'confirmed' | 'pending' | 'other' {
  if (CONFIRMED.has(status)) return 'confirmed';
  if (PENDING.has(status))   return 'pending';
  return 'other';
}

const EVENT_PILL: Record<string, string> = {
  confirmed: 'bg-[#9c27b0] text-white',
  pending:   'bg-white text-[#9c27b0] border border-[#9c27b0]/50',
  other:     'bg-gray-100 text-gray-500 border border-gray-200',
};

// ── Date helpers ───────────────────────────────────────────────────────────────
function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function quoteDate(q: Quote): string {
  return q.event_date.slice(0, 10); // normalise to YYYY-MM-DD
}

/** Returns Monday-aligned weeks for a given year/month (0-indexed month) */
function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  // JS: 0=Sun … 6=Sat; we want 0=Mon … 6=Sun
  const startDow = (firstDay.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// ── Sheet detail ──────────────────────────────────────────────────────────────
function EventSheet({
  quote,
  onClose,
}: {
  quote: Quote;
  onClose: () => void;
}) {
  const variant  = quoteVariant(quote.status);
  const services = (quote.services ?? []).filter((s) => !s.isPageBreak);
  const ht       = services.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const mapsUrl = quote.client_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(quote.client_address)}`
    : null;

  const STATUS_LABELS: Record<string, string> = {
    accepted: 'Accepté', sent: 'Envoyé', pending: 'En attente', draft: 'Brouillon', rejected: 'Refusé',
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={quote.client_name || 'Événement'}
      subtitle={quote.event_type}
      width="w-[480px]"
    >
      <div className="p-6 space-y-5">

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={[
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
            variant === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
            variant === 'pending'   ? 'bg-amber-50 text-amber-700'     :
                                      'bg-gray-100 text-gray-600',
          ].join(' ')}>
            <span className={[
              'w-1.5 h-1.5 rounded-full',
              variant === 'confirmed' ? 'bg-emerald-500' :
              variant === 'pending'   ? 'bg-amber-500'   :
                                        'bg-gray-400',
            ].join(' ')} />
            {STATUS_LABELS[quote.status] ?? quote.status}
          </span>
          {quote.guest_count && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Users className="h-3.5 w-3.5" />
              {quote.guest_count} couvert{quote.guest_count > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <CalendarDays className="h-4 w-4 text-[#9c27b0] flex-shrink-0" />
          <span>
            {new Date(quote.event_date + 'T00:00:00').toLocaleDateString('fr-FR', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
        </div>

        {/* Address */}
        {quote.client_address && (
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <MapPin className="h-4 w-4 text-[#9c27b0] flex-shrink-0 mt-0.5" />
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#9c27b0] hover:underline flex items-center gap-1 transition-colors"
              >
                {quote.client_address}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            ) : (
              <span>{quote.client_address}</span>
            )}
          </div>
        )}

        {/* Prestations à préparer */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Prestations à préparer
          </p>
          {services.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucune prestation enregistrée</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {s.name || '—'}
                      {s.quantity > 1 && (
                        <span className="text-gray-400 font-normal ml-1 text-xs">× {s.quantity}</span>
                      )}
                    </p>
                    {s.description && (
                      <p className="text-xs italic text-gray-400 mt-0.5 leading-relaxed">{s.description}</p>
                    )}
                    {s.category && (
                      <span className="inline-block text-[10px] text-[#9c27b0] bg-[#f3e5f5] px-1.5 py-0.5 rounded mt-1">
                        {s.category}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 pt-0.5">
                    {formatCurrency(s.quantity * s.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        {quote.total_amount != null && (
          <div className="flex items-center justify-between bg-[#f3e5f5]/40 rounded-xl px-4 py-3 border border-[#9c27b0]/10">
            <span className="text-sm font-medium text-gray-700">Total TTC</span>
            <span className="font-bold text-[#9c27b0] text-base tabular-nums">
              {formatCurrency(quote.total_amount)}
            </span>
          </div>
        )}

        {/* CTAs */}
        <div className="space-y-2">
          {variant === 'confirmed' && (
            <Link
              href={`/evenements/${quote.id}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
            >
              <Eye className="h-4 w-4" />
              Gérer l&apos;événement
            </Link>
          )}
          <Link
            href={`/devis/${quote.id}/modifier`}
            className={[
              'flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold rounded-xl transition-colors',
              variant === 'confirmed'
                ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'bg-[#9c27b0] text-white hover:bg-[#7b1fa2]',
            ].join(' ')}
          >
            <FileText className="h-4 w-4" />
            Accéder au devis
          </Link>
        </div>
      </div>
    </Sheet>
  );
}

// ── Day cell ───────────────────────────────────────────────────────────────────
function DayCell({
  date,
  isToday,
  isCurrentMonth,
  quotes,
  onQuoteClick,
}: {
  date: Date | null;
  isToday: boolean;
  isCurrentMonth: boolean;
  quotes: Quote[];
  onQuoteClick: (q: Quote) => void;
}) {
  if (!date) {
    return <div className="min-h-[100px] bg-gray-50/40 border border-gray-100" />;
  }

  const totalGuests = quotes.reduce((s, q) => s + (q.guest_count ?? 0), 0);
  const overCapacity = totalGuests > CAPACITY_THRESHOLD;

  return (
    <div
      className={[
        'min-h-[100px] p-1.5 border border-gray-100 flex flex-col gap-1 transition-colors',
        isCurrentMonth ? 'bg-white' : 'bg-gray-50/60',
        isToday ? 'ring-2 ring-inset ring-[#9c27b0]/40' : '',
      ].join(' ')}
    >
      {/* Day number */}
      <div className="flex items-center justify-between px-0.5">
        <span
          className={[
            'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
            isToday
              ? 'bg-[#9c27b0] text-white'
              : isCurrentMonth
              ? 'text-gray-800'
              : 'text-gray-300',
          ].join(' ')}
        >
          {date.getDate()}
        </span>

        {/* Total guests indicator */}
        {totalGuests > 0 && (
          <span
            className={[
              'flex items-center gap-0.5 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full',
              overCapacity
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-gray-100 text-gray-500',
            ].join(' ')}
            title={overCapacity ? `⚠ Capacité max dépassée (${totalGuests} couverts)` : `${totalGuests} couverts`}
          >
            {overCapacity && <AlertTriangle className="h-2.5 w-2.5" />}
            <Users className="h-2.5 w-2.5" />
            {totalGuests}
          </span>
        )}
      </div>

      {/* Event pills */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {quotes.map((q) => {
          const variant = quoteVariant(q.status);
          return (
            <button
              key={q.id}
              onClick={() => onQuoteClick(q)}
              className={[
                'w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight truncate transition-opacity hover:opacity-80',
                EVENT_PILL[variant],
              ].join(' ')}
              title={`${q.client_name} — ${q.event_type}${q.guest_count ? ` (${q.guest_count} cvt)` : ''}`}
            >
              {q.client_name || q.event_type || '—'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-[#9c27b0]" />
        Accepté
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded border border-[#9c27b0]/50 bg-white" />
        Envoyé / En attente
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded border border-gray-200 bg-gray-100" />
        Autre
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-red-50 border border-red-200" />
        <AlertTriangle className="h-2.5 w-2.5 text-red-500" />
        Capacité dépassée ({CAPACITY_THRESHOLD}+ cvts)
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CalendrierPage() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());  // 0-indexed

  const [quotes, setQuotes]       = useState<Quote[]>([]);
  const [loading, setLoading]     = useState(true);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [sheetQuote, setSheetQuote] = useState<Quote | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('quotes')
      .select('id, client_name, event_type, event_date, guest_count, total_amount, status, client_address, services')
      .not('event_date', 'is', null)
      .order('event_date', { ascending: true });

    if (error) console.error('[Calendrier] Supabase error:', error.message);
    setQuotes((data as Quote[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  // ── Calendar data ────────────────────────────────────────────────────────────
  const weeks = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  /** Map ISO date string → filtered quotes for that day */
  const quotesByDay = useMemo(() => {
    const map = new Map<string, Quote[]>();
    const visible = confirmedOnly
      ? quotes.filter((q) => CONFIRMED.has(q.status))
      : quotes;

    for (const q of visible) {
      const key = quoteDate(q);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return map;
  }, [quotes, confirmedOnly]);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const goPrev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else              setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else               setMonth((m) => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // ── Stats for header ──────────────────────────────────────────────────────────
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthQuotes = useMemo(
    () => quotes.filter((q) => quoteDate(q).startsWith(monthKey)),
    [quotes, monthKey],
  );
  const confirmedCount  = monthQuotes.filter((q) => CONFIRMED.has(q.status)).length;
  const pendingCount    = monthQuotes.filter((q) => PENDING.has(q.status)).length;
  const totalGuestsMonth = monthQuotes.reduce((s, q) => s + (q.guest_count ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Topbar ────────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">

          {/* Title + nav */}
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-[#9c27b0]" />
            <h1 className="text-lg font-bold text-gray-900">Calendrier</h1>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={goPrev}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                title="Mois précédent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToday}
                className="px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Aujourd'hui
              </button>
              <button
                onClick={goNext}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                title="Mois suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-base font-semibold text-gray-700 min-w-[160px]">
              {MONTHS_FR[month]} {year}
            </h2>
          </div>

          {/* Month stats + filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick stats */}
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {confirmedCount} confirmé{confirmedCount > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {pendingCount} en attente
              </span>
              {totalGuestsMonth > 0 && (
                <span className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <Users className="h-3 w-3" />
                  {totalGuestsMonth} couverts
                </span>
              )}
            </div>

            {/* Filter toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                role="checkbox"
                aria-checked={confirmedOnly}
                onClick={() => setConfirmedOnly((v) => !v)}
                className={[
                  'relative w-9 h-5 rounded-full transition-colors',
                  confirmedOnly ? 'bg-[#9c27b0]' : 'bg-gray-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    confirmedOnly ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </div>
              <span className="text-xs font-medium text-gray-600">Validés uniquement</span>
            </label>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3">
          <Legend />
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Chargement des événements…</span>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS_SHORT.map((d) => (
                <div
                  key={d}
                  className="py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
                {week.map((date, di) => {
                  const isToday =
                    date !== null &&
                    date.getDate()     === today.getDate() &&
                    date.getMonth()    === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();

                  const isCurrentMonth = date !== null && date.getMonth() === month;

                  const key = date ? isoDate(date.getFullYear(), date.getMonth(), date.getDate()) : '';
                  const dayQuotes = date ? (quotesByDay.get(key) ?? []) : [];

                  return (
                    <div key={di} className={di < 6 ? 'border-r border-gray-100' : ''}>
                      <DayCell
                        date={date}
                        isToday={isToday}
                        isCurrentMonth={isCurrentMonth}
                        quotes={dayQuotes}
                        onQuoteClick={setSheetQuote}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Empty state for the month */}
        {!loading && monthQuotes.length === 0 && (
          <div className="mt-4 flex flex-col items-center gap-2 text-center py-6">
            <CalendarDays className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              Aucun événement pour {MONTHS_FR[month]} {year}
            </p>
            <Link
              href="/devis/nouveau"
              className="mt-1 text-xs text-[#9c27b0] hover:underline font-medium"
            >
              + Créer un devis
            </Link>
          </div>
        )}
      </div>

      {/* ── Event detail Sheet ────────────────────────────────────────────────── */}
      {sheetQuote && (
        <EventSheet
          quote={sheetQuote}
          onClose={() => setSheetQuote(null)}
        />
      )}
    </div>
  );
}
