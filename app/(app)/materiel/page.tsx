'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { EQUIPMENT_BASE, findBaseArticle, sameName, UNITS } from '@/lib/equipment';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Mon matériel : ce que le traiteur possède et emporte sur ses événements. Dans la fiche d'un événement,
// onglet Matériel, « Choisir dans ma liste » propose cette liste : on coche au lieu de retaper.

interface Preset {
  id: string;
  name: string;
  unit: string | null;
  default_qty: number;
  qty_per_guest: number | null;
}

const num = (v: string, fallback: number) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : fallback; };
const emptyForm = { id: null as string | null, name: '', qty: '1', unit: 'pièce', perGuest: false };

export default function MaterielPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Preset[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [picking, setPicking] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: err } = await createClient().from('material_presets').select('id, name, unit, default_qty, qty_per_guest').eq('user_id', user.id).order('name');
    if (err) setError('Votre liste n’a pas pu être chargée. Rechargez la page.');
    setItems(((data ?? []) as Preset[]).map((p) => ({ ...p, default_qty: Number(p.default_qty), qty_per_guest: p.qty_per_guest == null ? null : Number(p.qty_per_guest) })));
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (items ?? []).filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase())), [items, search]);

  const save = async () => {
    if (!form || !form.name.trim() || !user) return;
    if (!form.id && (items ?? []).some((i) => sameName(i.name, form.name))) { setError(`« ${form.name.trim()} » est déjà dans votre liste.`); return; }
    setBusy(true); setError(null);
    const amount = num(form.qty, 1);
    const payload = { name: form.name.trim(), unit: form.unit || 'pièce', default_qty: form.perGuest ? 1 : amount, qty_per_guest: form.perGuest ? amount : null };
    const supabase = createClient();
    const res = form.id
      ? await supabase.from('material_presets').update(payload).eq('id', form.id).select('id, name, unit, default_qty, qty_per_guest').single()
      : await supabase.from('material_presets').insert({ ...payload, user_id: user.id }).select('id, name, unit, default_qty, qty_per_guest').single();
    setBusy(false);
    if (res.error || !res.data) { setError('L’article n’a pas pu être enregistré. Réessayez.'); return; }
    const saved = { ...(res.data as Preset), default_qty: Number(res.data.default_qty), qty_per_guest: res.data.qty_per_guest == null ? null : Number(res.data.qty_per_guest) };
    setItems((list) => [...(list ?? []).filter((i) => i.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    setForm(null);
  };

  const remove = async (item: Preset) => {
    if (!confirm(`Retirer « ${item.name} » de votre liste ?`)) return;
    const previous = items;
    setItems((list) => (list ?? []).filter((i) => i.id !== item.id));
    const res = await createClient().from('material_presets').delete().eq('id', item.id);
    if (res.error) { setItems(previous); setError('L’article n’a pas pu être retiré. Réessayez.'); }
  };

  const addFromBase = async () => {
    if (!picking || !user) return;
    const chosen = EQUIPMENT_BASE.filter((a) => a.name in picking);
    if (chosen.length === 0) { setPicking(null); return; }
    setBusy(true); setError(null);
    const res = await createClient().from('material_presets')
      .insert(chosen.map((a) => ({ user_id: user.id, name: a.name, unit: a.unit, default_qty: num(picking[a.name], a.qty), qty_per_guest: null })))
      .select('id, name, unit, default_qty, qty_per_guest');
    setBusy(false);
    if (res.error) { setError('Les articles n’ont pas pu être ajoutés. Réessayez.'); return; }
    setItems((list) => [...(list ?? []), ...((res.data ?? []) as Preset[]).map((p) => ({ ...p, default_qty: Number(p.default_qty), qty_per_guest: null }))]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    setPicking(null);
  };

  const qtyLabel = (i: Preset) => (i.qty_per_guest ? `${i.qty_per_guest.toLocaleString('fr-FR')} ${i.unit ?? 'pièce'} par couvert` : `${i.default_qty.toLocaleString('fr-FR')} ${i.unit ?? 'pièce'}`);

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Matériel</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">Ce que vous emportez sur vos événements. Dans un événement, onglet Matériel, vous le cochez au lieu de le retaper.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setPicking({})} className={cn(btnSecondary, 'whitespace-nowrap')}><ListChecks className="h-4 w-4" />Depuis la liste</button>
          <button onClick={() => setForm({ ...emptyForm })} className={cn(btnPrimary, 'flex-1 sm:flex-none whitespace-nowrap')}><Plus className="h-4 w-4" />Nouvel article</button>
        </div>
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      {items && items.length > 6 && (
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans mon matériel" aria-label="Rechercher dans mon matériel" className={cn(inputCls, 'pl-11')} />
        </div>
      )}

      {items === null ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1, 2].map((i) => <div key={i} className="px-5 py-4 animate-pulse"><div className="h-4 bg-gray-100 rounded w-1/3" /></div>)}
        </div>
      ) : items.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">Votre liste de matériel est vide</p>
          <p className="text-sm text-gray-500 mb-5 max-w-md">Partez de la liste de base (chafing dish, caisses isothermes, bacs gastro, rallonges…) : vous cochez ce que vous avez, et la quantité habituelle est déjà remplie.</p>
          <button onClick={() => setPicking({})} className={btnPrimary}><ListChecks className="h-4 w-4" />Partir de la liste de base</button>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {shown.map((i) => (
            <li key={i.id} className="flex items-center gap-1 pr-2">
              <button onClick={() => setForm({ id: i.id, name: i.name, qty: String(i.qty_per_guest ?? i.default_qty), unit: i.unit ?? 'pièce', perGuest: !!i.qty_per_guest })}
                className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left pl-4 sm:pl-5 py-3.5">
                <span className="font-medium text-gray-900 break-words">{i.name}</span>
                <span className="text-sm text-gray-600 tabular-nums whitespace-nowrap">{qtyLabel(i)}</span>
              </button>
              <button onClick={() => setForm({ id: i.id, name: i.name, qty: String(i.qty_per_guest ?? i.default_qty), unit: i.unit ?? 'pièce', perGuest: !!i.qty_per_guest })} className={iconBtn} aria-label={`Modifier ${i.name}`}><Pencil className="h-4 w-4" /></button>
              <button onClick={() => remove(i)} className={iconBtnDanger} aria-label={`Retirer ${i.name}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-5 py-6 text-sm text-gray-500">Aucun article ne correspond à « {search} ».</li>}
        </ul>
      )}

      {picking && (() => {
        const available = EQUIPMENT_BASE.filter((a) => !(items ?? []).some((i) => sameName(i.name, a.name)));
        const groups = [...new Set(available.map((a) => a.group))];
        const count = Object.keys(picking).length;
        return (
          <Modal
            title="Liste de base"
            onClose={() => setPicking(null)}
            footer={<>
              <button onClick={() => setPicking(null)} className={btnGhost}>Fermer</button>
              <button onClick={addFromBase} disabled={count === 0 || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{count > 0 ? `Ajouter ${count} article${count > 1 ? 's' : ''}` : 'Ajouter'}</button>
            </>}
          >
            <div className="pb-3 space-y-5">
              <p className="text-sm text-gray-600">Cochez ce que vous possédez ; ajustez la quantité que vous emportez d’habitude.</p>
              {available.length === 0 && <p className="text-[15px] text-gray-700">Toute la liste de base est déjà dans votre matériel.</p>}
              {groups.map((g) => {
                const rows = available.filter((a) => a.group === g);
                const allOn = rows.every((a) => a.name in picking);
                return (
                  <section key={g}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[15px] font-semibold text-gray-900">{g}</h3>
                      <button onClick={() => setPicking((p) => { const next = { ...p }; rows.forEach((a) => { if (allOn) delete next[a.name]; else next[a.name] = next[a.name] ?? String(a.qty); }); return next; })}
                        className="h-9 px-2 text-sm font-medium text-primary hover:text-primary-dark">{allOn ? 'Tout décocher' : 'Tout cocher'}</button>
                    </div>
                    <ul className="space-y-1.5">
                      {rows.map((a) => {
                        const on = a.name in picking;
                        return (
                          <li key={a.name} className="flex items-center gap-3 pl-3 pr-2 py-1 rounded-2xl bg-gray-50">
                            <input type="checkbox" checked={on} aria-label={a.name} className="h-6 w-6 rounded-md accent-sage flex-shrink-0"
                              onChange={(e) => setPicking((p) => { const next = { ...p }; if (e.target.checked) next[a.name] = String(a.qty); else delete next[a.name]; return next; })} />
                            <span className="flex-1 min-w-0 py-2 text-[15px] text-gray-900">{a.name}</span>
                            {on ? (
                              <input type="number" inputMode="decimal" min="0" step="any" value={picking[a.name]} aria-label={`Quantité, ${a.name}`}
                                onChange={(e) => setPicking((p) => ({ ...p, [a.name]: e.target.value }))} className={cn(inputCls, 'w-20 h-10 px-2 text-center')} />
                            ) : (
                              <span className="text-sm text-gray-500 tabular-nums">{a.qty}</span>
                            )}
                            <span className="w-16 text-sm text-gray-500">{a.unit}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </Modal>
        );
      })()}

      {form && (
        <Modal
          title={form.id ? 'Modifier l’article' : 'Nouvel article'}
          onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
            <button onClick={save} disabled={!form.name.trim() || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          </>}
        >
          <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4 pb-3">
            <div>
              <label htmlFor="mat-name" className={labelCls}>Article</label>
              <input id="mat-name" autoFocus list="equipment-base" value={form.name} placeholder="Commencez à taper : chafing, caisse, rallonge…" className={inputCls}
                onChange={(e) => {
                  const base = findBaseArticle(EQUIPMENT_BASE, e.target.value);
                  setForm(base && !form.id ? { ...form, name: base.name, unit: base.unit, qty: String(base.qty), perGuest: false } : { ...form, name: e.target.value });
                }} />
              <datalist id="equipment-base">{EQUIPMENT_BASE.map((a) => <option key={a.name} value={a.name} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mat-qty" className={labelCls}>Quantité</label>
                <input id="mat-qty" type="number" inputMode="decimal" min="0" step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="mat-unit" className={labelCls}>Unité</label>
                <select id="mat-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                  {[...UNITS, ...(form.unit && !(UNITS as readonly string[]).includes(form.unit) ? [form.unit] : [])].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-[15px] text-gray-700">
              <input type="checkbox" checked={form.perGuest} onChange={(e) => setForm({ ...form, perGuest: e.target.checked })} className="w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
              Cette quantité est par couvert
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
