'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, RotateCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { quoteStatusLabel } from '@/lib/quoteStatus';
import { BUCKETS, type Bucket, type DashboardData, type TodoItem, type UpcomingEvent } from '@/lib/dashboard';
import { getDashboard } from '@/server/dashboard';
import DateBlock from '@/components/ui/DateBlock';
import { btnSecondary, cardCls, pill } from '@/components/ui/kit';

// Tableau de bord : d'abord ce qu'il faut faire, trié par échéance, puis le résumé de l'activité.
// Tout vient d'une seule action serveur (server/dashboard.ts) ; l'en-tête s'affiche tout de suite.

const euros = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Couleur de l'échéance : rouge si en retard, terracotta aujourd'hui, neutre ensuite. */
const BUCKET_TONE: Record<Bucket, { dot: string; text: string }> = {
  retard: { dot: 'bg-danger', text: 'text-danger' },
  aujourdhui: { dot: 'bg-primary', text: 'text-primary' },
  semaine: { dot: 'bg-amber-500', text: 'text-gray-600' },
  bientot: { dot: 'bg-gray-300', text: 'text-gray-600' },
};

/** Nombre de tâches montrées avant « Afficher les autres ». */
const FIRST = 8;

export default function DashboardPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getDashboard(localToday()).then(setData).catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const firstName = profile?.first_name ? profile.first_name.charAt(0).toUpperCase() + profile.first_name.slice(1) : '';
  const late = data?.todo.filter((t) => t.bucket === 'retard').length ?? 0;
  const todayCount = data?.todo.filter((t) => t.bucket === 'aujourdhui').length ?? 0;

  return (
    <div className="px-4 md:px-6 pb-8">
      <header className="mb-5">
        <p className="text-sm text-gray-500 first-letter:uppercase">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="text-[32px] md:text-[40px] font-bold text-gray-900 leading-tight mt-1">Bonjour{firstName ? ` ${firstName}` : ''}</h1>
        <p className="text-[15px] text-gray-600 mt-1 min-h-[1.5em]" data-testid="dashboard-headline">
          {data && (data.todo.length === 0
            ? 'Rien d’urgent pour le moment.'
            : [late ? `${plural(late, 'tâche', 'tâches')} en retard` : null, todayCount ? `${todayCount} pour aujourd’hui` : null,
              !late && !todayCount ? `${plural(data.todo.length, 'chose', 'choses')} à faire dans les deux semaines` : null]
              .filter(Boolean).join(', ') + '.')}
        </p>
      </header>

      {failed ? (
        <div className={cn(cardCls, 'p-6 text-center')} role="alert">
          <p className="font-medium text-gray-900">Le tableau de bord n’a pas pu être chargé.</p>
          <p className="text-sm text-gray-600 mt-1">Vérifiez votre connexion, puis réessayez.</p>
          <button onClick={load} className={cn(btnSecondary, 'mt-4')}><RotateCw className="h-4 w-4" />Réessayer</button>
        </div>
      ) : (
        // Grand écran : à gauche ce qu'il faut faire et les prochains événements, à droite les chiffres.
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-3 items-start">
          <div className="space-y-3 min-w-0">
            <TodoPanel data={data} />
            <UpcomingPanel data={data} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3 min-w-0">
            <RevenueCard data={data} />
            <ActivityCard data={data} />
            <div className="md:col-span-2 xl:col-span-1"><PipelineCard data={data} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── À faire ───────────────────────────────────────────────────────────────────
function TodoPanel({ data }: { data: DashboardData | null }) {
  const [all, setAll] = useState(false);
  const todo = data?.todo ?? [];
  const shown = all ? todo : todo.slice(0, FIRST);

  return (
    <section className={cn(cardCls, 'p-4 sm:p-5')} aria-labelledby="todo-title" data-testid="todo">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="todo-title" className="text-xl font-semibold text-gray-900">À faire</h2>
        {data && todo.length > 0 && <p className="text-sm text-gray-500">{plural(todo.length, 'tâche', 'tâches')}, la plus urgente d’abord</p>}
      </div>

      {!data ? (
        <div className="space-y-2 mt-4" aria-hidden>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[72px] rounded-2xl bg-gray-50 animate-pulse" />)}
        </div>
      ) : todo.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl bg-sage-100/50 px-4 py-6 mt-4" data-testid="todo-empty">
          <span className="w-11 h-11 rounded-full bg-sage-100 text-sage flex items-center justify-center flex-shrink-0"><Check className="h-5 w-5" /></span>
          <div>
            <p className="font-semibold text-gray-900">Rien d’urgent</p>
            <p className="text-sm text-gray-600 mt-0.5">Pas de demande en attente, pas de devis à relancer, vos prochains événements sont prêts.</p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          {BUCKETS.map((b) => {
            const items = shown.filter((t) => t.bucket === b.key);
            if (items.length === 0) return null;
            const total = todo.filter((t) => t.bucket === b.key).length;
            return (
              <div key={b.key} className="mt-3 first:mt-0" data-bucket={b.key}>
                <h3 className="flex items-center gap-2 px-1 py-1.5 text-sm font-semibold text-gray-900">
                  <span className={cn('w-2 h-2 rounded-full', BUCKET_TONE[b.key].dot)} aria-hidden />
                  {b.label}<span className="font-normal text-gray-500">{total}</span>
                </h3>
                <ul className="divide-y divide-gray-100">
                  {items.map((t) => <TodoRow key={t.key} item={t} />)}
                </ul>
              </div>
            );
          })}
          {todo.length > FIRST && (
            <button onClick={() => setAll(!all)} className="w-full h-11 mt-2 rounded-xl text-[15px] font-medium text-primary hover:bg-primary-50 transition-colors">
              {all ? 'Afficher moins' : `Afficher les ${todo.length - FIRST} autres`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function TodoRow({ item }: { item: TodoItem }) {
  const tone = BUCKET_TONE[item.bucket];
  return (
    <li className="py-3 flex items-start gap-3" data-todo={item.kind} data-todo-key={item.key}>
      <div className="flex-1 min-w-0">
        <Link href={item.href} className="block group rounded-lg">
          <p className="text-[15px] font-medium text-gray-900 group-hover:text-primary transition-colors break-words">{item.title}</p>
          {item.detail && <p className="text-sm text-gray-600 mt-0.5 break-words">{item.detail}</p>}
          <p className={cn('text-sm mt-0.5 first-letter:uppercase', tone.text)}>{item.when}</p>
        </Link>
        {item.links && item.links.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-2" aria-label="Ce qui manque">
            {item.links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="inline-flex items-center min-h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800 hover:border-primary-300 hover:text-primary transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link href={item.href} className={cn(btnSecondary, 'h-10 px-3 flex-shrink-0')} aria-label={`${item.action} : ${item.title}`}>
        <span className="hidden sm:inline">{item.action}</span><ChevronRight className="h-4 w-4" />
      </Link>
    </li>
  );
}

// ── Résumé ────────────────────────────────────────────────────────────────────
const skeletonLine = (w: string) => <span className={cn('inline-block h-7 rounded-lg bg-current opacity-10 animate-pulse align-middle', w)} />;

function RevenueCard({ data }: { data: DashboardData | null }) {
  const s = data?.summary;
  const max = Math.max(...(s?.months.map((m) => m.amount) ?? [0]), 1);
  return (
    <section className="rounded-2xl bg-forest text-white p-5" aria-labelledby="ca-title" data-testid="revenue">
      <h2 id="ca-title" className="text-sm text-white/70">Chiffre d’affaires du mois</h2>
      <p className="font-display text-[32px] font-bold tabular-nums leading-tight mt-1 whitespace-nowrap">{s ? euros(s.caMonth) : skeletonLine('w-32')}</p>
      <p className="text-sm text-white/70 mt-1">
        {s ? <>{plural(s.caMonthEvents, 'événement confirmé', 'événements confirmés')} ce mois, TTC</> : ' '}
      </p>
      <div className="flex items-baseline justify-between gap-3 mt-4 pt-4 border-t border-white/15">
        <p className="text-sm text-white/70">Depuis le 1er janvier</p>
        <p className="font-display text-lg font-bold tabular-nums whitespace-nowrap">{s ? euros(s.caYear) : '…'}</p>
      </div>
      {s && (
        <div className="mt-4" aria-label="Chiffre d’affaires des six derniers mois">
          <div className="flex items-end gap-1.5 h-16">
            {s.months.map((m, i) => (
              <div key={m.key} className="flex-1 h-full flex items-end" title={`${m.label} : ${euros(m.amount)}`}>
                <div className={cn('w-full rounded-md', i === 5 ? 'bg-white' : 'bg-white/30')} style={{ height: m.amount > 0 ? `${Math.max(8, Math.round((m.amount / max) * 100))}%` : '3px' }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {s.months.map((m, i) => <p key={m.key} className={cn('flex-1 text-center text-xs', i === 5 ? 'text-white' : 'text-white/60')}>{m.label}</p>)}
          </div>
        </div>
      )}
    </section>
  );
}

function ActivityCard({ data }: { data: DashboardData | null }) {
  const s = data?.summary;
  const rate = s && s.conversion.total > 0 ? Math.round((s.conversion.confirmed / s.conversion.total) * 100) : null;
  const rows: { label: string; value: string; hint?: string; href?: string }[] = s ? [
    { label: 'Devis en cours', value: euros(s.pendingAmount), hint: plural(s.pendingCount, 'devis', 'devis'), href: '/devis' },
    { label: 'Taux de transformation', value: rate == null ? '–' : `${rate} %`, hint: `${s.conversion.confirmed} confirmés sur ${s.conversion.total} devis, sur 12 mois` },
    { label: 'Couverts à venir', value: String(s.upcomingGuests), hint: plural(s.upcomingEvents, 'événement confirmé', 'événements confirmés'), href: '/calendrier' },
    ...(s.requestsMonth != null ? [{ label: 'Demandes reçues ce mois', value: String(s.requestsMonth), href: '/prospects' }] : []),
    { label: 'Devis créés ce mois', value: String(s.quotesMonth) },
  ] : [];

  return (
    <section className={cn(cardCls, 'p-5')} aria-labelledby="activity-title" data-testid="activity">
      <h2 id="activity-title" className="text-lg font-semibold text-gray-900">Activité</h2>
      {!s ? (
        <div className="space-y-3 mt-4" aria-hidden>{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-xl bg-gray-50 animate-pulse" />)}</div>
      ) : (
        <dl className="mt-2 divide-y divide-gray-100">
          {rows.map((r) => {
            const body = (
              <>
                <dt className="min-w-0">
                  <span className="block text-[15px] text-gray-800">{r.label}</span>
                  {r.hint && <span className="block text-sm text-gray-500">{r.hint}</span>}
                </dt>
                <dd className="font-display text-lg font-bold text-gray-900 tabular-nums whitespace-nowrap">{r.value}</dd>
              </>
            );
            return r.href
              ? <Link key={r.label} href={r.href} className="flex items-center justify-between gap-4 py-2.5 min-h-12 hover:text-primary group">{body}</Link>
              : <div key={r.label} className="flex items-center justify-between gap-4 py-2.5 min-h-12">{body}</div>;
          })}
        </dl>
      )}
    </section>
  );
}

function UpcomingPanel({ data }: { data: DashboardData | null }) {
  const events = data?.upcoming ?? [];
  const withEvents = data?.modules.includes('evenements') ?? true;
  return (
    <section className={cn(cardCls, 'p-4 sm:p-5')} aria-labelledby="upcoming-title" data-testid="upcoming">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="upcoming-title" className="text-lg font-semibold text-gray-900">Prochains événements</h2>
        <Link href="/calendrier" className="flex-shrink-0 inline-flex items-center gap-1 min-h-10 text-sm font-medium text-primary hover:underline">
          Calendrier <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {!data ? (
        <div className="space-y-2" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-[72px] rounded-2xl bg-gray-50 animate-pulse" />)}</div>
      ) : events.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center">Aucun événement confirmé à venir.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => <UpcomingRow key={ev.id} ev={ev} today={data.today} href={withEvents ? `/evenements/${ev.id}` : `/devis/${ev.id}/modifier`} />)}
        </ul>
      )}
    </section>
  );
}

function UpcomingRow({ ev, today, href }: { ev: UpcomingEvent; today: string; href: string }) {
  const ready = ev.missing && ev.missing.length === 0;
  return (
    <li data-event={ev.client}>
      <Link href={href} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors">
        <DateBlock iso={ev.date} today={ev.date === today} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{ev.client}</p>
          <p className="text-sm text-gray-600 truncate first-letter:uppercase">
            {[ev.eventType, ev.guests ? `${ev.guests} couverts` : null, ev.total ? euros(ev.total) : null].filter(Boolean).join(', ')}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {ev.missing == null ? (
              <span className={cn(pill, 'bg-sage-100 text-sage')}>{quoteStatusLabel(ev.status)}</span>
            ) : ready ? (
              <span className={cn(pill, 'bg-sage-100 text-sage')} data-ready>Prêt</span>
            ) : (
              <span className={cn(pill, 'bg-amber-100 text-amber-800')} title={ev.missing.join(', ')}>
                {plural(ev.missing.length, 'point', 'points')} à régler
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
      </Link>
    </li>
  );
}

function PipelineCard({ data }: { data: DashboardData | null }) {
  const steps = data?.summary.pipeline ?? [];
  const max = Math.max(...steps.map((s) => s.count), 1);
  return (
    <section className={cn(cardCls, 'p-4 sm:p-5')} aria-labelledby="pipeline-title" data-testid="pipeline">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="pipeline-title" className="text-lg font-semibold text-gray-900">Devis en cours, par étape</h2>
        <Link href="/devis" className="flex-shrink-0 inline-flex items-center gap-1 min-h-10 text-sm font-medium text-primary hover:underline">
          Devis <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {!data ? (
        <div className="space-y-3" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-lg bg-gray-50 animate-pulse" />)}</div>
      ) : steps.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center">Aucun devis en cours pour un événement à venir.</p>
      ) : (
        <ul className="space-y-3">
          {steps.map((s) => (
            <li key={s.status}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-800">{quoteStatusLabel(s.status)} <span className="text-gray-500">({s.count})</span></span>
                <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{euros(s.amount)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((s.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
