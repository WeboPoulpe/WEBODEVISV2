'use client';

// Récapitulatif des heures des extras pour la paie : un mois, un tableau par extra (missions, heures,
// taux, montant brut) avec le détail par événement, et l'export CSV à transmettre au comptable.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useHydrated } from '@/lib/useHydrated';
import { cn } from '@/lib/utils';
import { btnPrimary, cardCls, iconBtn } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/evenements/shared';
import {
  euros, hoursLabel, monthLabel, monthRange, payrollByExtra, payrollCsv, toNumber,
  type PayrollExtraInput, type PayrollMissionInput, type PayrollRow,
} from '@/lib/staffCost';

interface Row {
  id: string; extra_id: string; status: string | null; arrival_time: string | null; departure_time: string | null;
  quote: { id: string; event_type: string | null; event_date: string | null; client_name: string | null } | null;
}

const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  return monthOf(new Date(y, m - 1 + by, 1));
}
const dayLabel = (d: string | null) =>
  d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Sans date';
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default function ExtrasHoursPage() {
  const { user } = useAuth();
  const hydrated = useHydrated();
  const [chosen, setChosen] = useState<string | null>(null);
  // Le mois en cours dépend de l'horloge du navigateur : calculé après l'hydratation.
  const month = chosen ?? (hydrated ? monthOf(new Date()) : null);

  const [extras, setExtras] = useState<PayrollExtraInput[]>([]);
  const [missions, setMissions] = useState<PayrollMissionInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Heures saisies et taux : colonnes de la migration 0023, absentes tant qu'elle n'est pas appliquée.
  const [hoursSupported, setHoursSupported] = useState(true);
  const [open, setOpen] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data: extrasData, error: extrasErr } = await supabase.from('extras').select('*').order('name');
    if (extrasErr) { setError('Vos extras n’ont pas pu être chargés. Rechargez la page.'); setLoading(false); return; }
    const list = (extrasData ?? []) as { id: string; name: string; role: string | null; hourly_rate?: unknown }[];
    const ids = list.map((e) => e.id);
    let rows: Row[] = [];
    let extraHours: Record<string, { hours_worked: unknown; hourly_rate: unknown }> = {};
    if (ids.length > 0) {
      const [assign, hours] = await Promise.all([
        supabase.from('event_extras')
          .select('id, extra_id, status, arrival_time, departure_time, quote:quotes(id, event_type, event_date, client_name)')
          .in('extra_id', ids),
        supabase.from('event_extras').select('id, hours_worked, hourly_rate').in('extra_id', ids),
      ]);
      if (assign.error) { setError('Les missions n’ont pas pu être chargées. Rechargez la page.'); setLoading(false); return; }
      rows = ((assign.data ?? []) as unknown as Row[]).filter((r) => r.quote?.id);
      setHoursSupported(!hours.error);
      if (!hours.error) {
        extraHours = Object.fromEntries(((hours.data ?? []) as { id: string; hours_worked: unknown; hourly_rate: unknown }[]).map((h) => [h.id, h]));
      }
    }
    setExtras(list.map((e) => ({ id: e.id, name: e.name, role: e.role, hourly_rate: toNumber(e.hourly_rate) })));
    setMissions(rows.map((r) => ({
      id: r.id, extra_id: r.extra_id, status: r.status,
      arrival_time: r.arrival_time, departure_time: r.departure_time,
      hours_worked: toNumber(extraHours[r.id]?.hours_worked), hourly_rate: toNumber(extraHours[r.id]?.hourly_rate),
      event_date: r.quote!.event_date?.slice(0, 10) ?? null, event_type: r.quote!.event_type, client_name: r.quote!.client_name,
    })));
    setError(null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const rows: PayrollRow[] = useMemo(
    () => (month ? payrollByExtra(missions, extras, monthRange(month)) : []),
    [missions, extras, month],
  );
  const total = useMemo(() => ({
    missions: rows.reduce((s, r) => s + r.missions, 0),
    hours: rows.reduce((s, r) => s + r.hours, 0),
    amount: rows.reduce((s, r) => s + r.amount, 0),
    missingRate: rows.reduce((s, r) => s + r.missingRate, 0),
  }), [rows]);

  const exportCsv = () => {
    if (!month || rows.length === 0) return;
    const url = URL.createObjectURL(new Blob([payrollCsv(rows, month)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `heures-extras-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const toggle = (id: string) => setOpen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <div className="px-4 md:px-6 pb-8 max-w-4xl">
      <Link href="/extras" className="inline-flex items-center gap-1.5 min-h-10 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />Extras
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Heures et paie</h1>
          <p className="text-sm text-gray-500 mt-0.5">Les heures des extras confirmés ou présents, à transmettre à votre comptable.</p>
        </div>
        <button onClick={exportCsv} disabled={loading || rows.length === 0} className={cn(btnPrimary, 'w-full sm:w-auto')}>
          <Download className="h-4 w-4" />Exporter pour le comptable
        </button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      <div className="flex items-center gap-1 mb-4">
        <button onClick={() => month && setChosen(shiftMonth(month, -1))} disabled={!month} className={iconBtn} aria-label="Mois précédent"><ChevronLeft className="h-5 w-5" /></button>
        <p className="font-display text-lg font-semibold text-gray-900 min-w-[160px] text-center first-letter:uppercase" aria-live="polite">
          {month ? monthLabel(month) : ' '}
        </p>
        <button onClick={() => month && setChosen(shiftMonth(month, 1))} disabled={!month} className={iconBtn} aria-label="Mois suivant"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {!hoursSupported && (
        <p className="mb-4 rounded-2xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-700">
          Les heures faites et les taux ne sont pas encore disponibles sur votre compte : le récapitulatif utilise les horaires prévus, sans montant.
        </p>
      )}

      {loading || !month ? (
        <div className={cn(cardCls, 'p-5 space-y-3')}>
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-50 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">Aucune mission ce mois-ci</p>
          <p className="text-sm text-gray-500 max-w-sm">Seules les missions confirmées ou présentes comptent. Les heures se corrigent dans l’onglet Extras de chaque événement.</p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 mb-4">
            {[
              ['Missions', String(total.missions)],
              ['Heures', hoursLabel(total.hours)],
              ['Montant brut', euros(total.amount)],
            ].map(([label, value]) => (
              <div key={label} className={cn(cardCls, 'px-3 py-3 sm:px-4')}>
                <dt className="text-sm text-gray-600">{label}</dt>
                <dd className="font-display text-lg sm:text-2xl font-bold text-gray-900 tabular-nums leading-tight mt-0.5 [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
          {total.missingRate > 0 && hoursSupported && (
            <p className="text-sm text-primary-800 mb-3">
              {plural(total.missingRate, 'mission n’a', 'missions n’ont')} pas de taux : {total.missingRate > 1 ? 'leur' : 'son'} montant n’est pas compté. Indiquez le taux habituel sur la fiche de l’extra.
            </p>
          )}

          <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
            {rows.map((r) => {
              const expanded = open.includes(r.extraId);
              return (
                <li key={r.extraId} data-payroll={r.name}>
                  <button onClick={() => toggle(r.extraId)} aria-expanded={expanded} aria-controls={`detail-${r.extraId}`}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-gray-900 truncate">{r.name}</span>
                      <span className="block text-sm text-gray-600">
                        {plural(r.missions, 'mission', 'missions')}, {hoursLabel(r.hours)}
                        {r.mixedRates ? ', taux variable' : r.rate !== null ? `, ${euros(r.rate)}/h` : ''}
                      </span>
                    </span>
                    <span className="font-display font-bold text-gray-900 tabular-nums whitespace-nowrap">
                      {r.missingRate === r.missions ? <span className="text-sm font-normal text-gray-500">Sans taux</span> : euros(r.amount)}
                    </span>
                    <ChevronDown className={cn('h-5 w-5 text-gray-500 flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
                  </button>
                  {expanded && (
                    <ul id={`detail-${r.extraId}`} className="px-4 pb-3 space-y-1.5">
                      {r.lines.map((l) => (
                        <li key={l.missionId} className="flex items-baseline gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                          <span className="flex-1 min-w-0">
                            <span className="block text-gray-900 first-letter:uppercase">{dayLabel(l.date)}</span>
                            <span className="block text-gray-600 truncate">{[l.event, l.client].filter(Boolean).join(', ') || 'Événement'}</span>
                          </span>
                          <span className="text-right tabular-nums whitespace-nowrap">
                            <span className="block text-gray-900">{hoursLabel(l.hours)}{l.rate !== null ? ` à ${euros(l.rate)}` : ''}</span>
                            <span className="block font-semibold text-gray-900">{l.amount === null ? 'Sans taux' : euros(l.amount)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            Montants bruts, hors charges. Le fichier s’ouvre dans Excel : un récapitulatif par extra, puis le détail des missions.
          </p>
        </>
      )}
    </div>
  );
}
