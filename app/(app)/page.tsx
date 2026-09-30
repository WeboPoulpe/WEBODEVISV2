'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Euro, FilePlus2, FileText, TrendingUp, UserPlus, UtensilsCrossed } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn, formatCurrency } from '@/lib/utils';
import { CONFIRMED_STATUSES, PENDING_STATUSES, isConfirmed } from '@/lib/quoteStatus';

// ── Types ─────────────────────────────────────────────────────────────────────
interface UpcomingEvent {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string;
  guest_count: number | null;
  total_amount: number | null;
}

interface ConfirmedQuote { total_amount: number | null; created_at: string }

type Period = 'month' | 'quarter' | 'year';

const PERIODS: { key: Period; label: string; caLabel: string }[] = [
  { key: 'month', label: 'Ce mois', caLabel: 'CA ce mois' },
  { key: 'quarter', label: 'Trimestre', caLabel: 'CA du trimestre' },
  { key: 'year', label: 'Année', caLabel: "CA de l'année" },
];

const MONTH_LABELS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

const card = 'bg-white border border-gray-200 rounded-2xl';

/** Bloc date façon éphéméride : jour en grand, mois et année dessous. */
function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  return (
    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white border border-gray-200 flex flex-col items-center justify-center">
      <span className="font-display text-xl font-bold text-gray-900 leading-none tabular-nums">{String(d.getDate()).padStart(2, '0')}</span>
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-1 leading-none">
        {MONTH_LABELS[d.getMonth()]} {String(d.getFullYear()).slice(2)}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [confirmed, setConfirmed] = useState<ConfirmedQuote[]>([]);
  const [couvertsAVenir, setCouvertsAVenir] = useState(0);
  const [devisEnCours, setDevisEnCours] = useState(0);
  const [tauxConversion, setTauxConversion] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      // Assez loin pour couvrir l'année en cours et les 6 derniers mois du graphique.
      const since = new Date(Math.min(
        new Date(now.getFullYear(), 0, 1).getTime(),
        new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime(),
      )).toISOString();

      const [confirmedRes, covertsRes, enCoursRes, totalRes, upcomingRes] = await Promise.all([
        supabase.from('quotes').select('total_amount, created_at').in('status', CONFIRMED_STATUSES).gte('created_at', since),
        supabase.from('quotes').select('guest_count').in('status', CONFIRMED_STATUSES).gte('event_date', today),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).in('status', PENDING_STATUSES),
        supabase.from('quotes').select('id, status'),
        supabase.from('quotes')
          .select('id, client_name, event_type, event_date, guest_count, total_amount')
          .in('status', CONFIRMED_STATUSES).gte('event_date', today)
          .order('event_date', { ascending: true }).limit(5),
      ]);

      setConfirmed((confirmedRes.data ?? []) as ConfirmedQuote[]);
      setCouvertsAVenir((covertsRes.data ?? []).reduce((s, q) => s + (q.guest_count ?? 0), 0));
      setDevisEnCours(enCoursRes.count ?? 0);
      const all = totalRes.data ?? [];
      setTauxConversion(all.length ? Math.round((all.filter((q) => isConfirmed(q.status)).length / all.length) * 100) : 0);
      setUpcomingEvents((upcomingRes.data ?? []) as UpcomingEvent[]);
      setLoading(false);
    };
    load();
  }, []);

  // Chiffre d'affaires de la période choisie et des 6 derniers mois, à partir des mêmes devis confirmés.
  const { ca, months, total6 } = useMemo(() => {
    const now = new Date();
    const starts: Record<Period, Date> = {
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      quarter: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
      year: new Date(now.getFullYear(), 0, 1),
    };
    const sum = (from: Date) =>
      confirmed.filter((q) => new Date(q.created_at) >= from).reduce((s, q) => s + (q.total_amount ?? 0), 0);

    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_LABELS[d.getMonth()], amount: 0, current: i === 5 };
    });
    for (const q of confirmed) {
      const bucket = buckets.find((b) => b.key === q.created_at.slice(0, 7));
      if (bucket) bucket.amount += q.total_amount ?? 0;
    }
    return { ca: sum(starts[period]), months: buckets, total6: buckets.reduce((s, b) => s + b.amount, 0) };
  }, [confirmed, period]);

  const maxMonth = Math.max(...months.map((m) => m.amount), 1);
  const periodInfo = PERIODS.find((p) => p.key === period)!;
  const firstName = profile?.first_name ? profile.first_name.charAt(0).toUpperCase() + profile.first_name.slice(1) : '';
  const skeleton = <span className="inline-block h-8 w-24 rounded-lg bg-current opacity-10 animate-pulse align-middle" />;

  return (
    <div className="px-4 md:px-6 pb-6">
      {/* Accueil + période */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 mb-5">
        <div>
          <p className="text-sm text-gray-500 capitalize">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-[32px] md:text-[40px] font-bold text-gray-900 leading-tight mt-1">
            Bonjour{firstName ? ` ${firstName}` : ''}
          </h1>
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70" role="tablist" aria-label="Période du chiffre d'affaires">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn('h-9 px-4 rounded-lg text-sm font-medium transition-colors',
                period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <div className="col-span-2 sm:col-span-1 rounded-2xl bg-forest text-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">{periodInfo.caLabel}</p>
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Euro className="h-4 w-4" /></span>
          </div>
          <p className="font-display text-[32px] font-bold tabular-nums leading-none mt-6 whitespace-nowrap">
            {loading ? skeleton : formatCurrency(ca)}
          </p>
        </div>

        <div className={cn(card, 'p-5')}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Couverts à venir</p>
            <span className="w-8 h-8 rounded-lg bg-sage-100 text-sage flex items-center justify-center"><UtensilsCrossed className="h-4 w-4" /></span>
          </div>
          <p className="font-display text-[32px] font-bold text-gray-900 tabular-nums leading-none mt-6">{loading ? skeleton : couvertsAVenir}</p>
        </div>

        <div className={cn(card, 'p-5')}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Devis en cours</p>
            <span className="w-8 h-8 rounded-lg bg-primary-100 text-primary flex items-center justify-center"><FileText className="h-4 w-4" /></span>
          </div>
          <p className="font-display text-[32px] font-bold text-gray-900 tabular-nums leading-none mt-6">{loading ? skeleton : devisEnCours}</p>
        </div>

        <div className={cn(card, 'col-span-2 sm:col-span-1 p-5')}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Taux de conversion</p>
            <span className="w-8 h-8 rounded-lg bg-sage-100 text-sage flex items-center justify-center"><TrendingUp className="h-4 w-4" /></span>
          </div>
          <p className="font-display text-[32px] font-bold text-gray-900 tabular-nums leading-none mt-6">{loading ? skeleton : `${tauxConversion} %`}</p>
          <div className="h-1.5 rounded-full bg-gray-200 mt-3 overflow-hidden" role="progressbar" aria-valuenow={tauxConversion} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-sage transition-[width] duration-500" style={{ width: `${tauxConversion}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
        {/* Prochains événements */}
        <section className={cn(card, 'p-5')}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Prochains événements confirmés</h2>
            <Link href="/calendrier" className="flex-shrink-0 flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Voir le calendrier <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => <div key={i} className="h-[76px] rounded-2xl bg-gray-50 animate-pulse" />)}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center">
              <p className="text-sm text-gray-600">Aucun événement confirmé à venir.</p>
              <Link href="/devis" className="inline-block mt-2 text-sm font-medium text-primary hover:underline">Voir les devis en cours</Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((ev) => (
                <li key={ev.id}>
                  <Link href={`/evenements/${ev.id}`} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <DateBlock iso={ev.event_date} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{ev.client_name || 'Sans nom'}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {ev.event_type && <span className="px-2.5 py-0.5 rounded-full bg-primary-100 text-primary text-xs font-medium capitalize">{ev.event_type}</span>}
                        {!!ev.guest_count && <span className="px-2.5 py-0.5 rounded-full bg-sage-100 text-sage text-xs font-medium">{ev.guest_count} couverts</span>}
                      </div>
                    </div>
                    <p className="flex-shrink-0 font-display text-base sm:text-lg font-bold text-gray-900 tabular-nums">
                      {formatCurrency(ev.total_amount ?? 0)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* CA sur 6 mois */}
        <section className={cn(card, 'p-5')}>
          <h2 className="text-lg font-semibold text-gray-900">CA sur 6 mois</h2>
          <p className="mt-2">
            <span className="font-display text-[28px] font-bold text-gray-900 tabular-nums">{loading ? skeleton : formatCurrency(total6)}</span>
            <span className="ml-2 text-xs text-gray-500 lowercase">{months[0].label}. à {months[5].label}.</span>
          </p>
          <div className="flex items-end gap-2 h-24 mt-5">
            {months.map((m) => (
              <div key={m.key} className="flex-1 h-full flex items-end" title={`${m.label} : ${formatCurrency(m.amount)}`}>
                {m.amount > 0 ? (
                  <div className={cn('w-full rounded-lg', m.current ? 'bg-primary' : 'bg-primary-200')} style={{ height: `${Math.max(8, Math.round((m.amount / maxMonth) * 100))}%` }} />
                ) : (
                  // Mois sans chiffre d'affaires : gabarit vide, pour garder le rythme du graphique.
                  <div className="w-full h-full rounded-lg bg-primary-50 border border-dashed border-primary-200" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {months.map((m) => (
              <p key={m.key} className={cn('flex-1 text-center text-xs', m.current ? 'font-semibold text-gray-900' : 'text-gray-500')}>{m.label}</p>
            ))}
          </div>
        </section>
      </div>

      {/* Raccourcis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <Link href="/devis/nouveau" className={cn(card, 'group flex items-center gap-4 p-4 hover:border-gray-300 transition-colors')}>
          <span className="w-12 h-12 rounded-xl bg-primary-100 text-primary flex items-center justify-center flex-shrink-0"><FilePlus2 className="h-5 w-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-gray-900">Créer un devis</span>
            <span className="block text-sm text-gray-600">Assistant en 4 étapes avec aperçu en temps réel</span>
          </span>
          <ArrowRight className="h-5 w-5 text-gray-500 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link href="/clients/nouveau" className={cn(card, 'group flex items-center gap-4 p-4 hover:border-gray-300 transition-colors')}>
          <span className="w-12 h-12 rounded-xl bg-sage-100 text-sage flex items-center justify-center flex-shrink-0"><UserPlus className="h-5 w-5" /></span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-gray-900">Ajouter un client</span>
            <span className="block text-sm text-gray-600">Particulier ou entreprise</span>
          </span>
          <ArrowRight className="h-5 w-5 text-gray-500 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
