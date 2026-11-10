'use client';

// Statistiques du site de présentation, sans cookie (lib/siteStats.ts) : visiteurs, pages vues, provenances,
// appareils et conversions sur 7, 30 ou 90 jours. Les visites sont écrites par paquets, au plus une fois par heure :
// les toutes dernières peuvent n'apparaître qu'un peu plus tard (l'ouverture de cette page écrit le paquet en cours
// de l'instance qui la sert).

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cardCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { DEVICE_LABEL, SOURCE_LABEL } from '@/lib/siteStats';
import { adminSiteStats } from '@/server/admin';
import type { SiteStats } from '@/server/siteStats';

const nf = new Intl.NumberFormat('fr-FR');
const PERIODS = [7, 30, 90] as const;
const dayLabel = (iso: string, long = false) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className={cn(cardCls, 'p-4')}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-[28px] font-bold text-gray-900 tabular-nums leading-tight">{nf.format(value)}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** Visiteurs par jour : une seule série, barres fines, détail au survol (et au toucher). */
function DailyChart({ daily }: { daily: SiteStats['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const H = 160;
  const shown = hover === null ? null : daily[hover];
  const labelEvery = daily.length > 31 ? 14 : daily.length > 7 ? 5 : 1;
  return (
    <div>
      <div className="h-6 text-sm text-gray-700" aria-live="polite">
        {shown
          ? <><span className="font-medium text-gray-900">{dayLabel(shown.day, true)}</span> · {nf.format(shown.visitors)} visiteur{shown.visitors > 1 ? 's' : ''}, {nf.format(shown.views)} page{shown.views > 1 ? 's' : ''} vue{shown.views > 1 ? 's' : ''}</>
          : <span className="text-gray-500">Survolez une barre pour le détail du jour.</span>}
      </div>
      <div className="relative mt-2" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {/* Repère discret : le maximum de la période. */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" aria-hidden />
        <span className="absolute right-0 -top-5 text-xs text-gray-400 tabular-nums" aria-hidden>{nf.format(max)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {daily.map((d, i) => (
            <button
              key={d.day}
              type="button"
              aria-label={`${dayLabel(d.day, true)} : ${d.visitors} visiteurs, ${d.views} pages vues`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              className="group relative flex-1 h-full flex items-end focus:outline-none"
            >
              <span
                className={cn('block w-full rounded-t-[4px] transition-colors', hover === i ? 'bg-primary-700' : 'bg-primary-400 group-hover:bg-primary-600')}
                style={{ height: d.visitors ? `${Math.max(3, (d.visitors / max) * 100)}%` : 2, opacity: d.visitors ? 1 : 0.35 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] text-[11px] text-gray-500" aria-hidden>
        {daily.map((d, i) => (
          <span key={d.day} className="flex-1 text-center whitespace-nowrap overflow-visible">{i % labelEvery === 0 ? dayLabel(d.day) : ''}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500 border-l-2 border-gray-200 pl-2 md:hidden">Touchez une barre pour le détail.</p>
    </div>
  );
}

/** Une liste classée, avec une barre de proportion d'une seule teinte. */
function Ranked({ title, rows, empty }: { title: string; rows: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={cn(cardCls, 'p-4')}>
      <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-gray-500">{empty}</p> : (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="align-middle">
                <td className="py-1.5 pr-3 w-full">
                  <div className="text-gray-800 truncate max-w-[22rem]">{r.label}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-primary-400" style={{ width: `${(r.value / max) * 100}%` }} /></div>
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-900 font-medium">{nf.format(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminStatsPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStats(null);
    setError(null);
    adminSiteStats(days).then(setStats).catch(() => setError('Les statistiques n’ont pas pu être chargées.'));
  }, [days]);

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Statistiques du site</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visiteurs des pages de présentation, sans cookie. Les personnes connectées ne sont pas comptées.</p>
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70" role="tablist" aria-label="Période">
          {PERIODS.map((p) => (
            <button key={p} role="tab" aria-selected={days === p} onClick={() => setDays(p)}
              className={cn('h-10 px-4 rounded-lg text-sm font-medium transition-colors', days === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {p} jours
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!stats && !error && <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-label="Chargement" /></div>}

      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Tile label="Visiteurs" value={stats.totals.visitors} hint="Un visiteur compté une fois par jour" />
            <Tile label="Pages vues" value={stats.totals.views} />
            <Tile label="Démos ouvertes" value={stats.totals.demo} />
            <Tile label="Demandes de contact" value={stats.totals.contact} hint="Hors demandes suspectes" />
            <Tile label="Comptes créés" value={stats.totals.signup} />
          </div>

          <div className={cn(cardCls, 'p-4')}>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Visiteurs par jour</h2>
            <DailyChart daily={stats.daily} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Ranked title="Pages les plus vues" empty="Aucune visite sur la période."
              rows={stats.pages.map((p) => ({ label: p.path, value: p.views }))} />
            <Ranked title="Provenance des visiteurs" empty="Aucune visite sur la période."
              rows={stats.sources.map((s) => ({ label: SOURCE_LABEL[s.source] ?? s.source, value: s.visitors }))} />
            <Ranked title="Sites qui vous envoient des visiteurs" empty="Aucun site pour l’instant."
              rows={stats.referrers.map((r) => ({ label: r.host, value: r.visitors }))} />
            <Ranked title="Appareils" empty="Aucune visite sur la période."
              rows={stats.devices.map((d) => ({ label: DEVICE_LABEL[d.device] ?? d.device, value: d.visitors }))} />
          </div>

          <p className="text-xs text-gray-500">
            Les visites sont enregistrées par paquets, au plus une fois par heure, pour ne pas réveiller la base de données à chaque page : les dernières peuvent apparaître avec un peu de retard. Données conservées 13 mois.
          </p>
        </div>
      )}
    </div>
  );
}
