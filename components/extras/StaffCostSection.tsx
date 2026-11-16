'use client';

// Heures faites, rémunération (à l'heure ou au forfait) et coût du personnel d'un événement (onglet Extras).
// Les colonnes event_extras.hours_worked / hourly_rate / flat_fee et extras.hourly_rate / flat_fee viennent des
// migrations 0023 et 0055 : elles sont lues à part, et la section ne s'affiche pas tant que la base ne les a pas.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cardCls, inputCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { MissionStatus } from '@/lib/extras';
import {
  euros, hoursInput, hoursLabel, isPaidStatus, missionPay, parseHours, payAmount, plannedHours, retainedHours, staffTotals, toNumber,
  type ExtraPay,
} from '@/lib/staffCost';
import PayModeToggle, { type PayMode } from './PayModeToggle';

export interface TeamMember {
  id: string;
  extraId: string;
  name: string;
  role: string | null;
  status: MissionStatus;
  arrival_time: string | null;
  departure_time: string | null;
}

interface Stored { hours_worked: number | null; hourly_rate: number | null; flat_fee: number | null }
interface Habit { hourly_rate: number | null; flat_fee: number | null }

const EMPTY: Stored = { hours_worked: null, hourly_rate: null, flat_fee: null };
const NO_HABIT: Habit = { hourly_rate: null, flat_fee: null };
const amountInput = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

export default function StaffCostSection({ quoteId, team, onError }: {
  quoteId: string;
  team: TeamMember[];
  onError: (message: string) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [stored, setStored] = useState<Record<string, Stored>>({});
  // Ce que chaque extra a d'habitude : un taux horaire ou un forfait par mission.
  const [habits, setHabits] = useState<Record<string, Habit>>({});
  // Saisie en cours, par champ (« id:hours », « id:pay ») ; enregistrée en quittant le champ.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // « À l'heure » ou « Au forfait » choisi à l'écran, tant que le montant n'est pas saisi.
  const [modes, setModes] = useState<Record<string, PayMode>>({});

  const extraIds = useMemo(() => [...new Set(team.map((m) => m.extraId))].sort().join(','), [team]);
  const missionIds = useMemo(() => team.map((m) => m.id).sort().join(','), [team]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const ids = extraIds ? extraIds.split(',') : [];
    const [missions, extras] = await Promise.all([
      supabase.from('event_extras').select('id, hours_worked, hourly_rate, flat_fee').eq('quote_id', quoteId),
      ids.length ? supabase.from('extras').select('id, hourly_rate, flat_fee').in('id', ids) : Promise.resolve({ data: [], error: null }),
    ]);
    if (missions.error || extras.error) { setSupported(false); return; }
    const map: Record<string, Stored> = {};
    for (const r of (missions.data ?? []) as ({ id: string } & Record<keyof Stored, unknown>)[]) {
      map[r.id] = { hours_worked: toNumber(r.hours_worked), hourly_rate: toNumber(r.hourly_rate), flat_fee: toNumber(r.flat_fee) };
    }
    const byExtra: Record<string, Habit> = {};
    for (const e of (extras.data ?? []) as ({ id: string } & Record<keyof Habit, unknown>)[]) {
      byExtra[e.id] = { hourly_rate: toNumber(e.hourly_rate), flat_fee: toNumber(e.flat_fee) };
    }
    setStored(map);
    setHabits(byExtra);
    setSupported(true);
  }, [quoteId, extraIds]);

  // Recharge aussi quand l'équipe change (extra ajouté ou retiré).
  useEffect(() => { load(); }, [load, missionIds]);

  const paid = team.filter((m) => isPaidStatus(m.status));
  const missionOf = (m: TeamMember) => ({ ...m, ...(stored[m.id] ?? EMPTY) });
  const habitOf = (m: TeamMember): Habit => habits[m.extraId] ?? NO_HABIT;

  if (supported !== true || paid.length === 0) return null;

  const totals = staffTotals(paid.map((m) => ({ ...missionOf(m), extraRate: habitOf(m).hourly_rate, extraFlat: habitOf(m).flat_fee })));

  const clearDraft = (key: string) => setDrafts((d) => { const rest = { ...d }; delete rest[key]; return rest; });
  const clearMode = (id: string) => setModes((all) => { const rest = { ...all }; delete rest[id]; return rest; });

  const persist = async (m: TeamMember, current: Stored, patch: Partial<Stored>, failure: string) => {
    if ((Object.keys(patch) as (keyof Stored)[]).every((k) => patch[k] === current[k])) return;
    setStored((s) => ({ ...s, [m.id]: { ...current, ...patch } }));
    const res = await createClient().from('event_extras').update(patch).eq('id', m.id);
    if (res.error) {
      setStored((s) => ({ ...s, [m.id]: current }));
      onError(failure);
    }
  };

  const saveHours = async (m: TeamMember, text: string) => {
    const current = stored[m.id] ?? EMPTY;
    let value: number | null = null;
    if (text.trim()) {
      const parsed = parseHours(text);
      if (parsed === null || parsed < 0) {
        clearDraft(`${m.id}:hours`);
        onError('Heures non reconnues : écrivez par exemple 7,5 ou 7h30.');
        return;
      }
      // Les heures prévues ne sont pas figées : elles suivent l'horaire de la mission.
      value = current.hours_worked === null && parsed === plannedHours(m.arrival_time, m.departure_time) ? null : parsed;
    }
    clearDraft(`${m.id}:hours`);
    await persist(m, current, { hours_worked: value }, 'Les heures n’ont pas pu être enregistrées. Réessayez.');
  };

  const savePay = async (m: TeamMember, mode: PayMode, text: string) => {
    const current = stored[m.id] ?? EMPTY;
    // Champ vidé : la mission reprend l'habitude de l'extra.
    let patch: Pick<Stored, 'hourly_rate' | 'flat_fee'> = { hourly_rate: null, flat_fee: null };
    if (text.trim()) {
      const parsed = toNumber(text);
      if (parsed === null || parsed < 0) {
        clearDraft(`${m.id}:pay`);
        onError(mode === 'forfait' ? 'Forfait non reconnu : écrivez par exemple 120.' : 'Taux non reconnu : écrivez par exemple 13,50.');
        return;
      }
      // La valeur habituelle n'est pas figée sur la mission : elle suit la fiche de l'extra.
      const usual = missionPay({}, habitOf(m));
      const isUsual = usual?.mode === mode && (usual.mode === 'forfait' ? usual.amount : usual.rate) === parsed;
      if (!isUsual) patch = mode === 'forfait' ? { hourly_rate: null, flat_fee: parsed } : { hourly_rate: parsed, flat_fee: null };
    }
    clearDraft(`${m.id}:pay`);
    clearMode(m.id);
    await persist(m, current, patch, mode === 'forfait' ? 'Le forfait n’a pas pu être enregistré. Réessayez.' : 'Le taux n’a pas pu être enregistré. Réessayez.');
  };

  return (
    <section aria-labelledby="staff-cost-title" className={cn(cardCls, 'p-4 sm:p-5')}>
      <h2 id="staff-cost-title" className="font-display text-lg font-semibold text-gray-900">Heures et coût du personnel</h2>
      <p className="text-sm text-gray-600 mt-0.5">Pour les extras confirmés ou présents, payés à l’heure ou au forfait. Les heures prévues sont reprises : corrigez-les après l’événement.</p>

      <ul className="divide-y divide-gray-100 mt-3">
        {paid.map((m) => {
          const mission = missionOf(m);
          const planned = plannedHours(m.arrival_time, m.departure_time);
          const pay = missionPay(mission, habitOf(m));
          const cost = payAmount(pay, retainedHours(mission));
          const mode: PayMode = modes[m.id] ?? pay?.mode ?? 'heure';
          const flat = mode === 'forfait';
          // Le montant affiché est celui du mode choisi ; vide juste après avoir changé de mode.
          const shown = pay?.mode === mode ? (pay.mode === 'forfait' ? pay.amount : pay.rate) : null;
          const own = flat ? mission.flat_fee !== null : mission.flat_fee === null && mission.hourly_rate !== null;
          const hint = pay?.mode !== mode
            ? (flat ? 'Indiquez le forfait de cette mission' : pay ? 'Indiquez le taux de cette mission' : 'Aucun taux habituel')
            : own ? 'Propre à cette mission' : flat ? 'Forfait habituel' : 'Taux habituel';
          const hoursValue = drafts[`${m.id}:hours`] ?? hoursInput(mission.hours_worked ?? planned);
          const payValue = drafts[`${m.id}:pay`] ?? amountInput(shown);
          return (
            <li key={m.id} data-staff-cost={m.name} className="py-3 first:pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0">
                  <span className="font-semibold text-gray-900 break-words">{m.name}</span>
                  {m.role && <span className="text-sm text-gray-500"> {m.role}</span>}
                </p>
                <p className={cn('text-sm tabular-nums whitespace-nowrap', cost === null ? 'text-gray-500' : 'font-semibold text-gray-900')}>
                  {cost === null ? 'Taux ou forfait à indiquer' : euros(cost)}
                </p>
              </div>
              <PayModeToggle value={mode} label={`Rémunération de ${m.name}`} className="mt-2"
                onChange={(next) => { clearDraft(`${m.id}:pay`); setModes((all) => ({ ...all, [m.id]: next })); }} />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label htmlFor={`hours-${m.id}`} className="block text-sm font-medium text-gray-700 mb-1">Heures faites</label>
                  <input id={`hours-${m.id}`} inputMode="decimal" value={hoursValue} placeholder="7h30"
                    onChange={(e) => setDrafts((d) => ({ ...d, [`${m.id}:hours`]: e.target.value }))}
                    onBlur={(e) => saveHours(m, e.target.value)}
                    className={cn(inputCls, 'tabular-nums')} />
                  <p className="text-xs text-gray-500 mt-1">{planned === null ? 'Pas d’horaire prévu' : `Prévu : ${hoursLabel(planned)}`}</p>
                </div>
                <div>
                  <label htmlFor={`pay-${m.id}`} className="block text-sm font-medium text-gray-700 mb-1">{flat ? 'Forfait brut' : 'Taux brut'}</label>
                  <div className="relative">
                    <input id={`pay-${m.id}`} inputMode="decimal" value={payValue} placeholder={flat ? '120' : '13,50'}
                      onChange={(e) => setDrafts((d) => ({ ...d, [`${m.id}:pay`]: e.target.value }))}
                      onBlur={(e) => savePay(m, mode, e.target.value)}
                      className={cn(inputCls, 'pr-12 tabular-nums')} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">{flat ? '€' : '€/h'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{hint}</p>
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
          {totals.missingRate === 1 ? 'Un extra n’a ni taux ni forfait : son coût n’est pas compté.' : `${totals.missingRate} extras n’ont ni taux ni forfait : leur coût n’est pas compté.`}
        </p>
      )}
      <p className="text-sm text-gray-500 mt-2">Montants bruts, hors charges. Le récapitulatif du mois pour la paie est dans la page Extras.</p>
    </section>
  );
}
