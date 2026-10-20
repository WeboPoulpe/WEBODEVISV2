'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { loadDayView, saveDayView } from '@/lib/offlineStore';
import { getDayView, type DayView } from '@/server/dayView';
import DayEventCard from '@/components/journee/DayEventCard';

// « Ma journée » : les événements confirmés d'aujourd'hui et de demain, pour la cuisine et le lieu de l'événement.
// En ligne, la page charge les informations et en garde une copie sur l'appareil (lib/offlineStore.ts).
// Sans réseau, elle montre cette copie avec sa date ; le service worker (app/sw.js) garde la page elle-même.
// Le stockage et navigator ne sont lus que dans les effets et les gestionnaires, jamais au rendu.

type Status = 'loading' | 'online' | 'offline' | 'error';

const PARIS = 'Europe/Paris';
const parisDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(d);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const savedAt = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: PARIS });

/** Le jour par rapport à aujourd'hui (la copie enregistrée peut dater de la veille), ou null au-delà. */
function dayTitle(iso: string, today: string): string | null {
  if (iso === today) return 'Aujourd’hui';
  if (iso === addDays(today, 1)) return 'Demain';
  if (iso === addDays(today, -1)) return 'Hier';
  return null;
}

export default function JourneePage() {
  const { user } = useAuth();
  const [view, setView] = useState<DayView | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState('');
  // Compte connu de la session (absent hors ligne) : la copie montrée doit être la sienne.
  const userId = useRef<string | null>(null);
  useEffect(() => { userId.current = user?.id ?? null; }, [user]);

  const showSaved = useCallback(() => {
    const saved = loadDayView(userId.current);
    setView(saved);
    setStatus(saved ? 'offline' : 'error');
  }, []);

  const load = useCallback(async () => {
    setToday(parisDate(new Date()));
    if (!navigator.onLine) { showSaved(); return; }
    setRefreshing(true);
    try {
      const fresh = await getDayView();
      saveDayView(fresh);
      setView(fresh);
      setStatus('online');
    } catch {
      // Réseau coupé ou trop faible, serveur injoignable : la dernière copie enregistrée.
      showSaved();
    } finally {
      setRefreshing(false);
    }
  }, [showSaved]);

  useEffect(() => {
    load();
    // Le réseau revient : on recharge. Il se coupe : la page reste affichée, avec le bandeau.
    const onOnline = () => { load(); };
    const onOffline = () => setStatus((s) => (s === 'online' ? 'offline' : s));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [load]);

  // Une copie d'un autre compte (appareil partagé) ne s'affiche pas une fois la session connue.
  useEffect(() => {
    if (user && view && view.accountId !== user.id) {
      setView(null);
      setStatus((s) => (s === 'online' ? s : 'error'));
    }
  }, [user, view]);

  const count = view?.days.reduce((n, d) => n + d.events.length, 0) ?? 0;
  const stale = !!view && !!today && !view.days.some((d) => d.date === today);

  return (
    <div className="px-4 md:px-6 pb-8 max-w-3xl">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">Ma journée</h1>
          <p className="text-sm text-gray-600 mt-1">Aujourd’hui et demain, consultable même sans réseau.</p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="flex-shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Actualiser
        </button>
      </div>

      {status === 'offline' && view && (
        <div role="status" className="flex items-start gap-3 mb-4 px-4 py-3 rounded-2xl bg-forest text-white text-sm">
          <CloudOff className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold">Hors ligne</span> — informations du {savedAt(view.generatedAt)}.
            <span className="block text-white/75">Elles ne tiennent pas compte des changements faits depuis.</span>
          </p>
        </div>
      )}
      {status === 'online' && view && (
        <p className="mb-4 text-xs text-gray-500">À jour le {savedAt(view.generatedAt)}, enregistré sur cet appareil.</p>
      )}

      {status === 'loading' ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-48 rounded-2xl bg-white border border-gray-200 animate-pulse" />)}</div>
      ) : status === 'error' || !view ? (
        <div role="alert" className="rounded-2xl bg-white border border-gray-200 px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">Impossible d’afficher votre journée</p>
          <p className="text-sm text-gray-600 mt-1">
            Pas de réseau, et aucune copie enregistrée sur cet appareil. Ouvrez cette page une fois avec du réseau :
            elle restera ensuite consultable hors ligne.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {stale && (
            <p className="rounded-2xl bg-primary-100 text-primary text-sm px-4 py-3">
              Cette copie ne contient pas la journée d’aujourd’hui. Actualisez dès que vous avez du réseau.
            </p>
          )}
          {count === 0 && (
            <div className="rounded-2xl bg-white border border-gray-200 px-6 py-10 text-center">
              <p className="font-semibold text-gray-900">Aucun événement confirmé aujourd’hui ni demain</p>
              <p className="text-sm text-gray-600 mt-1">Un devis apparaît ici dès qu’il est validé pour l’une de ces deux dates.</p>
              <Link href="/evenements" className="inline-block mt-4 text-sm font-medium text-primary hover:underline">Voir tous les événements</Link>
            </div>
          )}
          {view.days.filter((d) => d.events.length > 0).map((day) => (
            <section key={day.date}>
              <h2 className="flex flex-wrap items-baseline gap-x-2 mb-3">
                <span className="font-display text-xl font-bold text-gray-900">{dayTitle(day.date, today) ?? capitalize(longDate(day.date))}</span>
                {dayTitle(day.date, today) && <span className="text-sm text-gray-500">{longDate(day.date)}</span>}
              </h2>
              <div className="space-y-4">
                {day.events.map((event) => <DayEventCard key={event.id} event={event} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
