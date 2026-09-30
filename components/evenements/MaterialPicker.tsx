'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, iconBtnDanger, inputCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { Check } from './shared';

// Liste de matériel du traiteur : on coche ce qu'on emporte à l'événement au lieu de tout retaper.
// La quantité proposée est fixe, ou calculée d'après le nombre de couverts.

interface Preset {
  id: string;
  name: string;
  unit: string | null;
  default_qty: number;
  qty_per_guest: number | null;
}

export interface PickedMaterial { name: string; qty: number; unit: string }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Ajoute à la liste un matériel saisi à la main dans un événement, s'il n'y est pas déjà. */
export async function rememberMaterial(userId: string, name: string, qty: number, unit: string) {
  const supabase = createClient();
  const { data } = await supabase.from('material_presets').select('id').eq('user_id', userId).ilike('name', name.trim()).limit(1);
  if (data && data.length > 0) return;
  await supabase.from('material_presets').insert({ user_id: userId, name: name.trim(), unit: unit || null, default_qty: qty });
}

export default function MaterialPicker({ userId, guests, already, onClose, onAdd }: {
  userId: string;
  guests: number;
  /** Noms déjà présents dans « À préparer » de l'événement. */
  already: string[];
  onClose: () => void;
  onAdd: (items: PickedMaterial[]) => void;
}) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [perGuest, setPerGuest] = useState(false);
  const [saving, setSaving] = useState(false);

  const suggested = (p: Preset) => (p.qty_per_guest && guests > 0 ? Math.ceil(Number(p.qty_per_guest) * guests) : Number(p.default_qty));

  useEffect(() => {
    createClient().from('material_presets').select('id, name, unit, default_qty, qty_per_guest').eq('user_id', userId).order('name')
      .then(({ data, error: err }) => {
        if (err) setError('Votre liste de matériel n’a pas pu être chargée. Fermez et rouvrez cette fenêtre.');
        setPresets((data ?? []) as Preset[]);
      });
  }, [userId]);

  const available = useMemo(() => (presets ?? []).filter((p) => !already.some((n) => same(n, p.name))), [presets, already]);
  const count = Object.keys(picked).length;
  const allPicked = available.length > 0 && available.every((p) => p.id in picked);

  const toggle = (p: Preset, on: boolean) => setPicked((prev) => {
    const next = { ...prev };
    if (on) next[p.id] = String(suggested(p)); else delete next[p.id];
    return next;
  });
  const toggleAll = () => setPicked(allPicked ? {} : Object.fromEntries(available.map((p) => [p.id, picked[p.id] ?? String(suggested(p))])));

  const addPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value || !presets) return;
    if (presets.some((p) => same(p.name, value))) { setError(`« ${value} » est déjà dans votre liste.`); return; }
    setSaving(true); setError(null);
    const amount = parseFloat(qty.replace(',', '.')) || 1;
    const res = await createClient().from('material_presets')
      .insert({ user_id: userId, name: value, unit: unit.trim() || null, default_qty: perGuest ? 1 : amount, qty_per_guest: perGuest ? amount : null })
      .select('id, name, unit, default_qty, qty_per_guest').single();
    setSaving(false);
    if (res.error || !res.data) { setError('L’article n’a pas pu être ajouté à votre liste. Réessayez.'); return; }
    const created = res.data as Preset;
    setPresets([...presets, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    setPicked((prev) => ({ ...prev, [created.id]: String(suggested(created)) }));
    setName(''); setQty('1'); setUnit(''); setPerGuest(false);
  };

  const removePreset = async (p: Preset) => {
    if (!confirm(`Retirer « ${p.name} » de votre liste de matériel ?`)) return;
    const previous = presets;
    setPresets((list) => (list ?? []).filter((x) => x.id !== p.id));
    setPicked((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
    const res = await createClient().from('material_presets').delete().eq('id', p.id);
    if (res.error) { setPresets(previous); setError('L’article n’a pas pu être retiré. Réessayez.'); }
  };

  const submit = () => {
    const items = (presets ?? []).filter((p) => p.id in picked)
      .map((p) => ({ name: p.name, qty: parseFloat(picked[p.id].replace(',', '.')) || suggested(p), unit: p.unit ?? '' }));
    if (items.length > 0) onAdd(items);
    onClose();
  };

  return (
    <Modal
      title="Ma liste de matériel"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={submit} disabled={count === 0} className={btnPrimary}>
          {count > 0 ? `Ajouter ${count} article${count > 1 ? 's' : ''}` : 'Ajouter'}
        </button>
      </>}
    >
      <div className="space-y-4 pb-3">
        {error && <p role="alert" className="text-sm text-danger bg-white border border-danger/30 rounded-xl px-4 py-3">{error}</p>}

        {!presets ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
        ) : presets.length === 0 ? (
          <p className="text-[15px] text-gray-600">
            Votre liste est vide. Ajoutez ci-dessous ce que vous emportez d’habitude : il suffira ensuite de cocher, événement après événement.
          </p>
        ) : (
          <>
            {available.length > 1 && (
              <button onClick={toggleAll} className={cn(btnSecondary, 'h-10')}>{allPicked ? 'Tout décocher' : 'Tout cocher'}</button>
            )}
            <ul className="space-y-2">
              {presets.map((p) => {
                const present = already.some((n) => same(n, p.name));
                const on = p.id in picked;
                return (
                  <li key={p.id} className={cn('flex items-center gap-3 pl-3 pr-1 py-1 rounded-2xl bg-gray-50', present && 'opacity-60')}>
                    {present
                      ? <span className="w-6" aria-hidden />
                      : <Check checked={on} onChange={(next) => toggle(p, next)} label={p.name} />}
                    <span className="flex-1 min-w-0 py-2">
                      <span className="block text-[15px] text-gray-900 break-words">{p.name}</span>
                      {p.qty_per_guest && <span className="block text-sm text-gray-500">{Number(p.qty_per_guest).toLocaleString('fr-FR')} par couvert</span>}
                    </span>
                    {present ? (
                      <span className={cn(pill, 'bg-white border border-gray-200 text-gray-600')}>Déjà ajouté</span>
                    ) : on ? (
                      <input type="number" inputMode="decimal" min="0" value={picked[p.id]} aria-label={`Quantité de ${p.name}`}
                        onChange={(e) => setPicked((prev) => ({ ...prev, [p.id]: e.target.value }))} className={cn(inputCls, 'w-20 h-10 px-2 text-center')} />
                    ) : (
                      <span className="text-sm text-gray-600 tabular-nums whitespace-nowrap">{suggested(p)}</span>
                    )}
                    <span className="w-14 text-sm text-gray-600 truncate">{p.unit}</span>
                    <button onClick={() => removePreset(p)} className={iconBtnDanger} aria-label={`Retirer ${p.name} de ma liste`}><Trash2 className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <form onSubmit={addPreset} className="pt-4 border-t border-gray-200 space-y-2">
          <p className="text-sm font-medium text-gray-700">Ajouter à ma liste</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chafing dish, nappe blanche, caisse isotherme" aria-label="Nom du matériel" className={inputCls} />
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantité" className={cn(inputCls, 'w-24 text-center')} />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unité" aria-label="Unité" className={cn(inputCls, 'flex-1 min-w-0')} />
            <button type="submit" disabled={!name.trim() || saving} className={cn(btnSecondary, 'h-12')} aria-label="Ajouter à ma liste">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <label className="flex items-center gap-2.5 py-1 text-[15px] text-gray-700">
            <input type="checkbox" checked={perGuest} onChange={(e) => setPerGuest(e.target.checked)} className="w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
            Cette quantité est par couvert
          </label>
        </form>
      </div>
    </Modal>
  );
}
