'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText, Users, Plus, TrendingUp, Euro, CalendarDays, ArrowRight,
  Heart, PartyPopper, UtensilsCrossed, Wine, Music, Briefcase, Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface UpcomingEvent {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string;
  guest_count: number | null;
  total_amount: number | null;
}

interface MonthStat { month: string; amount: number }

// ── Config ────────────────────────────────────────────────────────────────────
const EVENT_ICONS: Record<string, React.ElementType> = {
  mariage: Heart, anniversaire: PartyPopper, dîner: UtensilsCrossed, diner: UtensilsCrossed,
  cocktail: Wine, soirée: Music, soiree: Music, conférence: Briefcase,
  conference: Briefcase, séminaire: Briefcase, seminaire: Briefcase,
};

function getEventIcon(t: string): React.ElementType {
  return EVENT_ICONS[t.toLowerCase().trim()] ?? CalendarDays;
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [caMensuel, setCaMensuel] = useState(0);
  const [couvertsAVenir, setCouvertsAVenir] = useState(0);
  const [devisEnCours, setDevisEnCours] = useState(0);
  const [tauxConversion, setTauxConversion] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      // 6 months ago for chart
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      const [caRes, covertsRes, enCoursRes, totalRes, upcomingRes, chartRes] = await Promise.all([
        // CA du mois (accepted)
        supabase.from('quotes').select('total_amount').eq('status', 'accepted').gte('created_at', startOfMonth),
        // Couverts à venir (accepted, event_date >= today)
        supabase.from('quotes').select('guest_count').eq('status', 'accepted').gte('event_date', today),
        // Devis en cours
        supabase.from('quotes').select('id', { count: 'exact', head: true }).in('status', ['draft', 'pending', 'sent']),
        // Total pour taux conversion
        supabase.from('quotes').select('id, status', { count: 'exact' }),
        // 5 prochains événements
        supabase.from('quotes')
          .select('id, client_name, event_type, event_date, guest_count, total_amount')
          .eq('status', 'accepted').gte('event_date', today)
          .order('event_date', { ascending: true }).limit(5),
        // CA 6 derniers mois (accepted)
        supabase.from('quotes').select('total_amount, created_at').eq('status', 'accepted').gte('created_at', sixMonthsAgo),
      ]);

      // CA mensuel
      const ca = (caRes.data ?? []).reduce((s, q) => s + (q.total_amount ?? 0), 0);
      setCaMensuel(ca);

      // Couverts à venir
      const cv = (covertsRes.data ?? []).reduce((s, q) => s + (q.guest_count ?? 0), 0);
      setCouvertsAVenir(cv);

      // Devis en cours
      setDevisEnCours(enCoursRes.count ?? 0);

      // Taux de conversion
      const all = totalRes.data ?? [];
      const accepted = all.filter((q) => q.status === 'accepted').length;
      setTauxConversion(all.length ? Math.round((accepted / all.length) * 100) : 0);

      // Upcoming events
      setUpcomingEvents((upcomingRes.data ?? []) as UpcomingEvent[]);

      // 6-month chart
      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
      }
      for (const q of chartRes.data ?? []) {
        const key = q.created_at.slice(0, 7); // YYYY-MM
        if (key in buckets) buckets[key] += q.total_amount ?? 0;
      }
      const stats: MonthStat[] = Object.entries(buckets).map(([k, v]) => ({
        month: MONTH_LABELS[parseInt(k.slice(5, 7), 10) - 1],
        amount: v,
      }));
      setMonthStats(stats);

      setLoading(false);
    };
    load();
  }, []);

  const maxCA = Math.max(...monthStats.map((s) => s.amount), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/devis/nouveau"
          className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-lg hover:bg-[#7b1fa2] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau devis
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'CA ce mois', value: loading ? '…' : formatCurrency(caMensuel), color: '#388e3c', bg: '#e8f5e9', icon: Euro },
          { label: 'Couverts à venir', value: loading ? '…' : String(couvertsAVenir), color: '#1976d2', bg: '#e3f2fd', icon: Users },
          { label: 'Devis en cours', value: loading ? '…' : String(devisEnCours), color: '#9c27b0', bg: '#f3e5f5', icon: FileText },
          { label: 'Taux conversion', value: loading ? '…' : `${tauxConversion}%`, color: '#e65100', bg: '#fff3e0', icon: TrendingUp },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 leading-tight">{label}</p>
              <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: bg, color }}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums truncate" style={{ color }}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Upcoming events */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Prochains événements confirmés</h2>
            <Link href="/calendrier" className="text-xs text-[#9c27b0] hover:underline flex items-center gap-1">
              Voir calendrier <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-5">
              <CalendarDays className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Aucun événement confirmé à venir</p>
              <Link href="/devis" className="text-xs text-[#9c27b0] mt-1 hover:underline">Gérer les devis</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {upcomingEvents.map((ev) => {
                const Icon = getEventIcon(ev.event_type || '');
                return (
                  <Link key={ev.id} href={`/devis/${ev.id}/modifier`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group"
                  >
                    <div className="w-9 h-9 bg-[#f3e5f5] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#9c27b0] transition-colors">
                      <Icon className="h-4 w-4 text-[#9c27b0] group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{ev.client_name || '—'}</p>
                      <p className="text-xs text-gray-500 truncate capitalize">
                        {ev.event_type} · {formatDate(ev.event_date)}
                        {ev.guest_count ? ` · ${ev.guest_count} conv.` : ''}
                      </p>
                    </div>
                    {ev.total_amount && (
                      <p className="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">
                        {formatCurrency(ev.total_amount)}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* CA 6 mois chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">CA sur 6 mois</h2>
          {loading ? (
            <div className="flex items-end gap-2 h-32 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-1 bg-gray-100 rounded-t-sm" style={{ height: `${30 + i * 10}%` }} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2 h-32">
                {monthStats.map(({ month, amount }) => {
                  const height = maxCA > 0 ? Math.max(4, Math.round((amount / maxCA) * 100)) : 4;
                  const isCurrent = month === MONTH_LABELS[new Date().getMonth()];
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-sm transition-all ${isCurrent ? 'bg-[#9c27b0]' : 'bg-[#e1bee7]'}`}
                        style={{ height: `${height}%` }}
                        title={formatCurrency(amount)}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                {monthStats.map(({ month }) => (
                  <p key={month} className="flex-1 text-center text-[10px] text-gray-400">{month}</p>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Total 6 mois : <span className="font-semibold text-gray-700">
                  {formatCurrency(monthStats.reduce((s, m) => s + m.amount, 0))}
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Link href="/devis/nouveau"
          className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-[#9c27b0] hover:shadow-sm transition-all group"
        >
          <div className="p-3 bg-[#f3e5f5] rounded-xl group-hover:bg-[#9c27b0] transition-colors">
            <FileText className="h-5 w-5 text-[#9c27b0] group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Créer un devis</p>
            <p className="text-sm text-gray-500">Wizard en 4 étapes avec aperçu en temps réel</p>
          </div>
        </Link>
        <Link href="/clients/nouveau"
          className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-[#1976d2] hover:shadow-sm transition-all group"
        >
          <div className="p-3 bg-[#e3f2fd] rounded-xl group-hover:bg-[#1976d2] transition-colors">
            <Users className="h-5 w-5 text-[#1976d2] group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Ajouter un client</p>
            <p className="text-sm text-gray-500">Particulier ou entreprise</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
