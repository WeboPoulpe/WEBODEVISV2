'use client';

// Heures faites, taux appliqué et coût du personnel d'un événement (onglet Extras).
// Les colonnes event_extras.hours_worked / hourly_rate et extras.hourly_rate viennent de la migration 0023 :
// elles sont lues à part, et la section ne s'affiche pas tant que la base ne les a pas.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cardCls, inputCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { MissionStatus } from '@/lib/extras';
import {
  appliedRate, euros, hoursInput, hoursLabel, isPaidStatus, missionCost, parseHours, plannedHours, staffTotals, toNumber,
} from '@/lib/staffCost';

export interface TeamMember {
  id: string;
  extraId: string;
  name: string;
  role: string | null;
  status: MissionStatus;
  arrival_time: string | null;
  departure_time: string | null;
}

interface Stored { hours_worked: number | null; hourly_rate: number | null }

const rateInput = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

export default function StaffCostSection({ quoteId, team, onError }: {
  quoteId: string;
  team: TeamMember[];
  onError: (message: string) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [stored, setStored] = useState<Record<string, Stored>>({});
  const [extraRates, setExtraRates] = useState<Record<string, number | null>>({});
  // Saisie en cours, par champ (« id:hours », « id:rate ») ; enregistrée en quittant le champ.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const extraIds = useMemo(() => [...new Set(team.map((m) => m.extraId))].sort().join(','), [team]);
  const missionIds = useMemo(() => team.map((m) => m.id).sort().join(','), [team]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const ids = extraIds ? extraIds.split(',') : [];
    const [missions, extras] = await Promise.all([
      supabase.from('event_extras').select('id, hours_worked, hourly_rate').eq('quote_id', quoteId),
      ids.length ? supabase.from('extras').select('id, hourly_rate').in('id', ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (missions.error || extras.error) { setSupported(false); return; }
    const map: Record<string, Stored> = {};
    for (const r of (missions.data ?? []) as { id: string; hours_worked: unknown; hourly_rate: unknown }[]) {
      map[r.id] = { hours_worked: toNumber(r.hours_worked), hourly_rate: toNumber(r.hourly_rate) };
    }
    const rates: Record<string, number | null> = {};
    for (const e of (extras.data ?? []) as { id: string; hourly_rate: unknown }[]) rates[e.id] = toNumber(e.hourly_rate);
    setStored(map);
    setExtraRates(rates);
    setSupported(true);
  }, [quoteId, extraIds]);

  // Recharge aussi quand l'équipe change (extra ajouté ou retiré).
  useEffect(() => { load(); }, [load, missionIds]);

  const paid = team.filter((m) => isPaidStatus(m.status));
  const missionOf = (m: TeamMember) => ({ ...m, ...(stored[m.id] ?? { hours_worked: null, hourly_rate: null }) });

  if (supported !== true || paid.length === 0) return null;

  const totals = staffTotals(paid.map((m) => ({ ...missionOf(m), extraRate: extraRates[m.extraId] ?? null })));

  const save = async (m: TeamMember, field: 'hours' | 'rate', text: string) => {
    const key = `${m.id}:${field}`;
    const clear = () => setDrafts((d) => { const rest = { ...d }; delete rest[key]; return rest; });
    const current = stored[m.id] ?? { hours_worked: null, hourly_rate: null };
    const column = field === 'hours' ? 'hours_worked' : 'hourly_rate';
    const fallback = field === 'hours' ? plannedHours(m.arrival_time, m.departure_time) : (extraRates[m.extraId] ?? null);

    let value: number | null;
    if (!text.trim()) value = null;
    else {
      const parsed = field === 'hours' ? parseHours(text) : toNumber(text);
      if (parsed === null || parsed < 0) {
        clear();
        onError(field === 'hours' ? 'Heures non reconnues : écrivez par exemple 7,5 ou 7h30.' : 'Taux non reconnu : écrivez par exemple 13,50.');
        return;
      }
      // La valeur proposée par défaut n'est pas figée : elle suit l'horaire prévu ou le taux de l'extra.
      value = current[column] === null && parsed === fallback ? null : parsed;
    }
    clear();
    if (value === current[column]) return;
    setStored((s) => ({ ...s, [m.id]: { ...current, [column]: value } }));
    const res = await createClient().from('event_extras').update({ [column]: value }).eq('id', m.id);
    if (res.error) {
      setStored((s) => ({ ...s, [m.id]: current }));
      onError(field === 'hours' ? 'Les heures n’ont pas pu être enregistrées. Réessayez.' : 'Le taux n’a pas pu être enregistré. Réessayez.');
    }
  };

  return (
    <section aria-labelledby="staff-cost-title" className={cn(cardCls, 'p-4 sm:p-5')}>
      <h2 id="staff-cost-title" className="font-display text-lg font-semibold text-gray-900">Heures et coût du personnel</h2>
      <p className="text-sm text-gray-600 mt-0.5">Pour les extras confirmés ou présents. Les heures prévues sont reprises : corrigez-les après l’événement.</p>

      <ul className="divide-y divide-gray-100 mt-3">
        {paid.map((m) => {
          const mission = missionOf(m);
          const planned = plannedHours(m.arrival_time, m.departure_time);
          const rate = appliedRate(mission, extraRates[m.extraId]);
          const cost = missionCost(mission, extraRates[m.extraId]);
          const hoursValue = drafts[`${m.id}:hours`] ?? hoursInput(mission.hours_worked ?? planned);
          const rateValue = drafts[`${m.id}:rate`] ?? rateInput(rate);
          return (
            <li key={m.id} data-staff-cost={m.name} className="py-3 first:pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0">
                  <span className="font-semibold text-gray-900 break-words">{m.name}</span>
                  {m.role && <span className="text-sm text-gray-500"> {m.role}</span>}
                </p>
                <p className={cn('text-sm tabular-nums whitespace-nowrap', cost === null ? 'text-gray-500' : 'font-semibold text-gray-900')}>
                  {cost === null ? 'Taux à indiquer' : euros(cost)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label htmlFor={`hours-${m.id}`} className="block text-sm font-medium text-gray-700 mb-1">Heures faites</label>
                  <input id={`hours-${m.id}`} inputMode="decimal" value={hoursValue} placeholder="7h30"
                    onChange={(e) => setDrafts((d) => ({ ...d, [`${m.id}:hours`]: e.target.value }))}
                    onBlur={(e) => save(m, 'hours', e.target.value)}
                    className={cn(inputCls, 'tabular-nums')} />
                  <p className="text-xs text-gray-500 mt-1">{planned === null ? 'Pas d’horaire prévu' : `Prévu : ${hoursLabel(planned)}`}</p>
                </div>
                <div>
                  <label htmlFor={`rate-${m.id}`} className="block text-sm font-medium text-gray-700 mb-1">Taux brut</label>
                  <div className="relative">
                    <input id={`rate-${m.id}`} inputMode="decimal" value={rateValue} placeholder="13,50"
                      onChange={(e) => setDrafts((d) => ({ ...d, [`${m.id}:rate`]: e.target.value }))}
                      onBlur={(e) => save(m, 'rate', e.target.value)}
                      className={cn(inputCls, 'pr-12 tabular-nums')} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">€/h</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{mission.hourly_rate === null ? (extraRates[m.extraId] != null ? 'Taux habituel' : 'Aucun taux habituel') : 'Propre à cette mission'}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-gray-200">
        <div>
          <dt className="text-sm text-gray-600">Total des heures</dt>
          <dd className="text-xl font-bold text-gray-900 tabular-nums">{hoursLabel(totals.hours)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-sm text-gray-600">Coût du personnel</dt>
          <dd className="text-xl font-bold text-gray-900 tabular-nums">{euros(totals.cost)}</dd>
        </div>
      </dl>
      {totals.missingRate > 0 && (
        <p className="text-sm text-primary-800 mt-2">
          {totals.missingRate === 1 ? 'Un extra n’a pas de taux : son coût n’est pas compté.' : `${totals.missingRate} extras n’ont pas de taux : leur coût n’est pas compté.`}
        </p>
      )}
      <p className="text-sm text-gray-500 mt-2">Montants bruts, hors charges. Le récapitulatif du mois pour la paie est dans la page Extras.</p>
    </section>
  );
}
