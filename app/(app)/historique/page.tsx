'use client';

// Historique : tout ce qui a été fait dans le compte de l'entreprise, avec la date et l'heure. Réservé au titulaire
// et aux gérants. Les filtres sont dans l'adresse de la page (lien partageable, retour arrière).

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { listActivity, type ActivityEntry, type ActivityFilters as Query } from '@/server/activity';
import type { ActivityAction, ActivityEntity } from '@/lib/activity';
import ActivityFilters, { type FilterState, type Period } from '@/components/historique/ActivityFilters';
import ActivityList from '@/components/historique/ActivityList';
import { btnSecondary, errorCls } from '@/components/ui/kit';

const PERIODS: Period[] = ['today', '7', '30', 'all', 'custom'];
/** Jour à Paris, AAAA-MM-JJ, décalé de `days` jours. */
const parisDay = (days = 0) => new Date(Date.now() - days * 86400_000).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

function readFilters(p: URLSearchParams): FilterState {
  const period = (PERIODS as string[]).includes(p.get('periode') ?? '') ? (p.get('periode') as Period) : '30';
  return {
    period, from: p.get('du') ?? '', to: p.get('au') ?? '', actor: p.get('personne') ?? '', entity: p.get('element') ?? '',
    action: p.get('action') ?? '', q: p.get('q') ?? '', order: p.get('tri') === 'asc' ? 'asc' : 'desc',
  };
}

function toQuery(f: FilterState): Query {
  const range = f.period === 'today' ? { from: parisDay(), to: parisDay() }
    : f.period === '7' ? { from: parisDay(6) } : f.period === '30' ? { from: parisDay(29) }
    : f.period === 'custom' ? { from: f.from || undefined, to: f.to || undefined } : {};
  return {
    ...range, actor: f.actor || undefined, entity: (f.entity || undefined) as ActivityEntity | undefined,
    action: (f.action || undefined) as ActivityAction | undefined, q: f.q || undefined, order: f.order,
  };
}

function HistoryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => readFilters(new URLSearchParams(params.toString())), [params]);
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [people, setPeople] = useState<{ id: string; label: string }[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);

  const change = useCallback((patch: Partial<FilterState>) => {
    const f = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (f.period !== '30') p.set('periode', f.period);
    if (f.period === 'custom' && f.from) p.set('du', f.from);
    if (f.period === 'custom' && f.to) p.set('au', f.to);
    if (f.actor) p.set('personne', f.actor);
    if (f.entity) p.set('element', f.entity);
    if (f.action) p.set('action', f.action);
    if (f.q) p.set('q', f.q);
    if (f.order === 'asc') p.set('tri', 'asc');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, pathname, router]);

  useEffect(() => {
    let alive = true;
    setEntries(null); setError(false);
    listActivity(toQuery(filters))
      .then((r) => { if (!alive) return; setAllowed(r.allowed); setEntries(r.entries); setNext(r.next); setPeople(r.people); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [filters]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const r = await listActivity({ ...toQuery(filters), cursor: next });
      setEntries((e) => [...(e ?? []), ...r.entries]);
      setNext(r.next);
    } catch {
      setError(true);
    } finally {
      setMore(false);
    }
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight">Historique</h1>
        <p className="text-sm text-gray-600 mt-1">Tout ce qui a été fait dans votre compte, avec le jour et l’heure. Rien ne peut en être effacé.</p>
      </div>

      {!allowed ? (
        <p className="text-sm text-gray-600">L’historique est réservé au titulaire et aux gérants.</p>
      ) : (
        <div className="space-y-5">
          <ActivityFilters value={filters} onChange={change} people={people} />
          {error ? (
            <p className={errorCls}>L’historique n’a pas pu être chargé. Réessayez dans un instant.</p>
          ) : entries === null ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune action sur cette période.</p>
          ) : (
            <>
              <ActivityList entries={entries} />
              {next && (
                <div className="flex justify-center">
                  <button type="button" onClick={loadMore} disabled={more} className={btnSecondary}>
                    {more && <Loader2 className="h-4 w-4 animate-spin" />} Voir plus
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><HistoryPage /></Suspense>;
}
