'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cleanRunSheet, normalizeTime, sortRunSheet, type RunSheetStep } from '@/lib/production';
import { btnPrimary, btnSecondary, cardCls, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { ErrorBanner } from './shared';

// Feuille de route de l'événement : déroulé horaire et contact sur place, repris sur la page imprimable.
// La section reste masquée tant que la base n'a pas les colonnes (migration 0023 non appliquée).

type Step = RunSheetStep & { key: number };

let nextKey = 1;
const withKey = (s: RunSheetStep): Step => ({ ...s, key: nextKey++ });

export default function RunSheetSection({ quoteId }: { quoteId: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [contact, setContact] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLabel = useRef<HTMLInputElement | null>(null);
  const [focusNew, setFocusNew] = useState(false);

  useEffect(() => {
    createClient().from('quotes').select('run_sheet, onsite_contact').eq('id', quoteId).maybeSingle().then(({ data, error: err }) => {
      if (err || !data) { setAvailable(false); return; }
      const row = data as { run_sheet: unknown; onsite_contact: string | null };
      setSteps(cleanRunSheet(row.run_sheet).map(withKey));
      setContact(row.onsite_contact ?? '');
      setAvailable(true);
    });
  }, [quoteId]);

  useEffect(() => {
    if (focusNew) { lastLabel.current?.focus(); setFocusNew(false); }
  }, [focusNew]);

  if (!available) return null;

  const change = (next: Step[]) => { setSteps(next); setDirty(true); setSaved(false); };
  const update = (key: number, patch: Partial<RunSheetStep>) => change(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (index: number, delta: number) => {
    const next = [...steps];
    const [s] = next.splice(index, 1);
    next.splice(index + delta, 0, s);
    change(next);
  };
  const add = () => {
    // La nouvelle étape reprend l'heure de la dernière, à ajuster.
    const last = steps[steps.length - 1];
    change([...steps, withKey({ time: last?.time ?? '', label: '', note: '' })]);
    setFocusNew(true);
  };

  const save = async () => {
    const clean = sortRunSheet(steps
      .map((s) => ({ ...s, time: normalizeTime(s.time), label: s.label.trim(), note: s.note.trim() }))
      .filter((s) => s.label || s.note));
    setSaving(true);
    const { error: err } = await createClient().from('quotes')
      .update({ run_sheet: clean.map(({ time, label, note }) => ({ time, label, note })), onsite_contact: contact.trim() || null })
      .eq('id', quoteId);
    setSaving(false);
    if (err) { setError('La feuille de route n’a pas pu être enregistrée. Réessayez.'); return; }
    setError(null);
    setSteps(clean);
    setContact(contact.trim());
    setDirty(false);
    setSaved(true);
  };

  return (
    <section className={cn(cardCls, 'p-4 sm:p-6 space-y-4')} aria-labelledby="run-sheet-title">
      <div>
        <h2 id="run-sheet-title" className="font-display text-xl font-bold text-gray-900">Feuille de route</h2>
        <p className="text-sm text-gray-600 mt-1">Le déroulé de la journée et le contact sur place, repris sur la feuille remise à l’équipe.</p>
      </div>

      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div>
        <label htmlFor="onsite-contact" className={labelCls}>Contact sur place</label>
        <input id="onsite-contact" value={contact} onChange={(e) => { setContact(e.target.value); setDirty(true); setSaved(false); }}
          placeholder="Nom et téléphone" className={inputCls} />
      </div>

      <div>
        <p className={labelCls}>Déroulé</p>
        {steps.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-600 text-center">Aucune étape pour l’instant : arrivée de l’équipe, mise en place, service…</p>
        ) : (
          <ol className="space-y-2.5">
            {steps.map((s, i) => (
              <li key={s.key} className="rounded-2xl bg-gray-50 p-3 space-y-2">
                <div className="flex gap-2">
                  <input type="time" aria-label="Heure" value={s.time} onChange={(e) => update(s.key, { time: e.target.value })}
                    className={cn(inputCls, 'w-[7.5rem] flex-shrink-0 px-3')} />
                  <input aria-label="Étape" value={s.label} onChange={(e) => update(s.key, { label: e.target.value })}
                    ref={i === steps.length - 1 ? lastLabel : undefined} placeholder="Ex. arrivée de l’équipe" className={cn(inputCls, 'min-w-0')} />
                </div>
                <div className="flex items-center gap-1">
                  <input aria-label="Précision" value={s.note} onChange={(e) => update(s.key, { note: e.target.value })}
                    placeholder="Précision (facultatif)" className={cn(inputCls, 'h-10 text-sm min-w-0 mr-1')} />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Monter l’étape"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className={iconBtn} aria-label="Descendre l’étape"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => change(steps.filter((x) => x.key !== s.key))} className={iconBtnDanger} aria-label="Supprimer l’étape"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={add} className={btnSecondary}><Plus className="h-4 w-4" />Ajouter une étape</button>
        {dirty && (
          <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
          </button>
        )}
        {saved && !dirty && <span role="status" className="inline-flex items-center gap-1.5 text-sm text-gray-600"><Check className="h-4 w-4" />Enregistré, étapes triées par heure</span>}
      </div>
    </section>
  );
}
