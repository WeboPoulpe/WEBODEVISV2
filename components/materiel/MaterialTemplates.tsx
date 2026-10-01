'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ListChecks, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { EQUIPMENT_BASE, findBaseArticle, formatPerGuest, formatQty, matchesSearch, sameName, UNITS } from '@/lib/equipment';
import PerGuestInput from '@/components/ui/PerGuestInput';
import Modal from '@/components/ui/Modal';
import SearchField, { searchStatus } from '@/components/ui/SearchField';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Modèles de matériel : ce qu'on emporte pour un type de réception (« Cocktail » : 4 chafing dish, 6 caisses
// isothermes, 1 rallonge pour 30 couverts…). Dans un événement, onglet Matériel, on applique un modèle à
// « À préparer » : les quantités par couvert se calculent d'après le nombre de couverts.

export interface Preset { id: string; name: string; unit: string | null; default_qty: number; qty_per_guest: number | null }
interface TemplateSet { id: string; name: string }
interface Item {
  id: string;
  set_id: string;
  name: string;
  unit: string | null;
  default_qty: number;
  qty_per_guest: number | null;
  sort_order: number;
}

/** Article coché dans une liste : quantité fixe (texte saisi) ou par couvert. */
interface Picked { unit: string; qty: string; perGuest: number | null }

const ITEM_SELECT = 'id, set_id, name, unit, default_qty, qty_per_guest, sort_order';
const num = (v: string, fallback: number) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : fallback; };
const asItem = (row: Item): Item => ({ ...row, default_qty: Number(row.default_qty), qty_per_guest: row.qty_per_guest == null ? null : Number(row.qty_per_guest) });
const emptyItem = { id: null as string | null, name: '', unit: 'pièce', perGuest: false, qty: '1', ratio: 1 / 30 };

export const qtyLabel = (i: { default_qty: number; qty_per_guest: number | null; unit: string | null }) =>
  (i.qty_per_guest ? formatPerGuest(i.qty_per_guest, i.unit) : formatQty(i.default_qty, i.unit));

export default function MaterialTemplates({ userId, presets }: { userId: string; presets: Preset[] }) {
  const [sets, setSets] = useState<TemplateSet[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  const [form, setForm] = useState<typeof emptyItem | null>(null);
  // Fenêtre « Depuis une liste » : source affichée, articles cochés, recherche.
  const [picking, setPicking] = useState<Record<string, Picked> | null>(null);
  const [source, setSource] = useState<'mine' | 'base'>('base');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const [s, i] = await Promise.all([
      supabase.from('material_template_sets').select('id, name').eq('user_id', userId).order('created_at'),
      supabase.from('material_templates').select(ITEM_SELECT).eq('user_id', userId).order('sort_order'),
    ]);
    if (s.error || i.error) setError('Vos modèles n’ont pas pu être chargés. Rechargez la page.');
    const loaded = (s.data ?? []) as TemplateSet[];
    setSets(loaded);
    setItems(((i.data ?? []) as Item[]).map(asItem));
    setActiveId((current) => (current && loaded.some((x) => x.id === current) ? current : loaded[0]?.id ?? null));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const active = sets?.find((s) => s.id === activeId) ?? null;
  const activeItems = useMemo(() => items.filter((i) => i.set_id === activeId), [items, activeId]);

  const openPicking = () => { setQuery(''); setSource(presets.length > 0 ? 'mine' : 'base'); setPicking({}); };

  // ── Modèles ──────────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!naming || !naming.name.trim()) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const name = naming.name.trim();
    if (naming.id) {
      const res = await supabase.from('material_template_sets').update({ name }).eq('id', naming.id);
      if (res.error) setError('Le nom n’a pas pu être enregistré. Réessayez.');
      else setSets((list) => (list ?? []).map((s) => (s.id === naming.id ? { ...s, name } : s)));
    } else {
      const res = await supabase.from('material_template_sets').insert({ user_id: userId, name, sort_order: sets?.length ?? 0 }).select('id, name').single();
      if (res.error || !res.data) setError('Le modèle n’a pas pu être créé. Réessayez.');
      else { const created = res.data as TemplateSet; setSets((list) => [...(list ?? []), created]); setActiveId(created.id); openPicking(); }
    }
    setBusy(false);
    setNaming(null);
  };

  const duplicate = async () => {
    if (!active) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const res = await supabase.from('material_template_sets').insert({ user_id: userId, name: `${active.name} (copie)`, sort_order: sets?.length ?? 0 }).select('id, name').single();
    if (res.error || !res.data) { setError('Le modèle n’a pas pu être dupliqué. Réessayez.'); setBusy(false); return; }
    const copy = res.data as TemplateSet;
    if (activeItems.length > 0) {
      const inserted = await supabase.from('material_templates').insert(activeItems.map((i) => ({
        user_id: userId, set_id: copy.id, name: i.name, unit: i.unit, default_qty: i.default_qty, qty_per_guest: i.qty_per_guest, sort_order: i.sort_order,
      }))).select(ITEM_SELECT);
      if (inserted.error) setError('Le modèle est créé, mais ses articles n’ont pas pu être copiés.');
      else setItems((list) => [...list, ...((inserted.data ?? []) as Item[]).map(asItem)]);
    }
    setSets((list) => [...(list ?? []), copy]);
    setActiveId(copy.id);
    setBusy(false);
  };

  const removeSet = async () => {
    if (!active) return;
    if (!confirm(`Supprimer le modèle « ${active.name} » et ses ${activeItems.length} article${activeItems.length > 1 ? 's' : ''} ?\nLe matériel déjà ajouté à vos événements ne change pas.`)) return;
    const res = await createClient().from('material_template_sets').delete().eq('id', active.id);
    if (res.error) { setError('Le modèle n’a pas pu être supprimé. Réessayez.'); return; }
    const rest = (sets ?? []).filter((s) => s.id !== active.id);
    setSets(rest);
    setItems((list) => list.filter((i) => i.set_id !== active.id));
    setActiveId(rest[0]?.id ?? null);
  };

  // ── Articles ─────────────────────────────────────────────────────────────────
  const saveItem = async () => {
    if (!form || !form.name.trim() || !active) return;
    if (!form.id && activeItems.some((i) => sameName(i.name, form.name))) { setError(`« ${form.name.trim()} » est déjà dans ce modèle.`); return; }
    setBusy(true); setError(null);
    const payload = {
      name: form.name.trim(),
      unit: form.unit || 'pièce',
      default_qty: form.perGuest ? 1 : num(form.qty, 1),
      qty_per_guest: form.perGuest ? form.ratio : null,
    };
    const supabase = createClient();
    const res = form.id
      ? await supabase.from('material_templates').update(payload).eq('id', form.id).select(ITEM_SELECT).single()
      : await supabase.from('material_templates').insert({ ...payload, user_id: userId, set_id: active.id, sort_order: activeItems.length }).select(ITEM_SELECT).single();
    setBusy(false);
    if (res.error || !res.data) { setError('L’article n’a pas pu être enregistré. Réessayez.'); return; }
    const saved = asItem(res.data as Item);
    setItems((list) => (form.id ? list.map((i) => (i.id === saved.id ? saved : i)) : [...list, saved]));
    setForm(null);
  };

  const removeItem = async (item: Item) => {
    if (!confirm(`Retirer « ${item.name} » du modèle ?`)) return;
    const previous = items;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const res = await createClient().from('material_templates').delete().eq('id', item.id);
    if (res.error) { setItems(previous); setError('L’article n’a pas pu être retiré. Réessayez.'); }
  };

  const addPicked = async () => {
    if (!picking || !active) return;
    const chosen = Object.entries(picking);
    if (chosen.length === 0) { setPicking(null); return; }
    setBusy(true); setError(null);
    const res = await createClient().from('material_templates').insert(chosen.map(([name, p], i) => ({
      user_id: userId, set_id: active.id, name, unit: p.unit,
      default_qty: p.perGuest ? 1 : num(p.qty, 1), qty_per_guest: p.perGuest, sort_order: activeItems.length + i,
    }))).select(ITEM_SELECT);
    setBusy(false);
    if (res.error) { setError('Les articles n’ont pas pu être ajoutés. Réessayez.'); return; }
    setItems((list) => [...list, ...((res.data ?? []) as Item[]).map(asItem)]);
    setPicking(null);
  };

  // Article introuvable dans les listes : formulaire prérempli avec le texte cherché.
  const addTyped = (text: string) => {
    if (picking && Object.keys(picking).length === 0) setPicking(null);
    setQuery('');
    setForm({ ...emptyItem, name: text });
  };

  /** Nom saisi dans le formulaire : un article connu (ma liste, liste de base) apporte son unité et sa quantité. */
  const typeName = (value: string) => {
    if (!form) return;
    if (form.id) { setForm({ ...form, name: value }); return; }
    const mine = findBaseArticle(presets, value);
    const base = findBaseArticle(EQUIPMENT_BASE, value);
    if (mine) setForm({ ...form, name: mine.name, unit: mine.unit || 'pièce', perGuest: !!mine.qty_per_guest, qty: String(mine.default_qty), ratio: mine.qty_per_guest || form.ratio });
    else if (base) setForm({ ...form, name: base.name, unit: base.unit, perGuest: false, qty: String(base.qty) });
    else setForm({ ...form, name: value });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-4">
        <p className="text-sm text-gray-500 max-w-2xl">Un modèle par type de réception. Dans un événement, onglet Matériel, vous l’appliquez à « À préparer » : les quantités par couvert se calculent d’après le nombre de couverts.</p>
        <button onClick={() => setNaming({ id: null, name: '' })} className={btnPrimary}><Plus className="h-4 w-4" />Nouveau modèle</button>
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      {sets === null ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1].map((i) => <div key={i} className="px-5 py-4 animate-pulse"><div className="h-4 bg-gray-100 rounded w-1/3" /></div>)}
        </div>
      ) : sets.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">Aucun modèle de matériel</p>
          <p className="text-sm text-gray-500 mb-5 max-w-md">Créez par exemple « Cocktail » avec 4 chafing dish, 6 caisses isothermes et une rallonge pour 30 couverts, puis « Dîner assis » avec ce qu’il lui faut.</p>
          <button onClick={() => setNaming({ id: null, name: '' })} className={btnPrimary}><Plus className="h-4 w-4" />Nouveau modèle</button>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-4" role="tablist" aria-label="Modèles de matériel">
            {sets.map((s) => (
              <button key={s.id} role="tab" aria-selected={s.id === activeId} onClick={() => setActiveId(s.id)}
                className={cn('flex-shrink-0 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  s.id === activeId ? 'bg-forest text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300')}>
                {s.name}
                <span className={cn('ml-2 tabular-nums', s.id === activeId ? 'text-white/60' : 'text-gray-400')}>{items.filter((i) => i.set_id === s.id).length}</span>
              </button>
            ))}
          </div>

          {active && (
            <section className={cn(cardCls, 'overflow-hidden')}>
              <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-5 pt-4 pb-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 break-words">{active.name}</h2>
                  <p className="text-sm text-gray-500">{activeItems.length} article{activeItems.length > 1 ? 's' : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button onClick={() => setNaming({ id: active.id, name: active.name })} className={iconBtn} aria-label="Renommer le modèle"><Pencil className="h-4 w-4" /></button>
                  <button onClick={duplicate} disabled={busy} className={iconBtn} aria-label="Dupliquer le modèle"><Copy className="h-4 w-4" /></button>
                  <button onClick={removeSet} className={iconBtnDanger} aria-label="Supprimer le modèle"><Trash2 className="h-4 w-4" /></button>
                  <button onClick={openPicking} className={cn(btnSecondary, 'ml-1')}><ListChecks className="h-4 w-4" />Depuis une liste</button>
                  <button onClick={() => setForm({ ...emptyItem })} className={btnSecondary}><Plus className="h-4 w-4" />Ajouter un article</button>
                </div>
              </header>

              {activeItems.length === 0 ? (
                <p className="px-5 pb-6 text-[15px] text-gray-600">Ce modèle est vide. « Depuis une liste » propose votre matériel et la liste de base (chafing dish, caisses isothermes, rallonges…) : il suffit de cocher.</p>
              ) : (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {activeItems.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 pl-4 sm:pl-5 pr-2 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 break-words">{i.name}</p>
                        <p className="text-sm text-gray-500">{qtyLabel(i)}</p>
                      </div>
                      <button onClick={() => setForm({ id: i.id, name: i.name, unit: i.unit ?? 'pièce', perGuest: !!i.qty_per_guest, qty: String(i.default_qty), ratio: i.qty_per_guest ?? emptyItem.ratio })}
                        className={iconBtn} aria-label={`Modifier ${i.name}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => removeItem(i)} className={iconBtnDanger} aria-label={`Retirer ${i.name}`}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {naming && (
        <Modal
          title={naming.id ? 'Renommer le modèle' : 'Nouveau modèle de matériel'}
          onClose={() => setNaming(null)}
          footer={<>
            <button onClick={() => setNaming(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveName} disabled={!naming.name.trim() || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{naming.id ? 'Enregistrer' : 'Créer le modèle'}</button>
          </>}
        >
          <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className="pb-3">
            <label htmlFor="mset-name" className={labelCls}>Nom du modèle</label>
            <input id="mset-name" autoFocus value={naming.name} onChange={(e) => setNaming({ ...naming, name: e.target.value })} placeholder="Cocktail, Dîner assis, Buffet" className={inputCls} />
          </form>
        </Modal>
      )}

      {picking && active && (() => {
        const inSet = (name: string) => activeItems.some((i) => sameName(i.name, name));
        const mine = presets.filter((p) => !inSet(p.name));
        const base = EQUIPMENT_BASE.filter((a) => !inSet(a.name) && !mine.some((p) => sameName(p.name, a.name)));
        const foundMine = mine.filter((p) => matchesSearch(query, p.name));
        const foundBase = base.filter((a) => matchesSearch(query, a.name, a.group));
        const shownNames = source === 'mine' ? foundMine.map((p) => p.name) : foundBase.map((a) => a.name);
        const count = Object.keys(picking).length;
        const hiddenOn = Object.keys(picking).filter((n) => !shownNames.includes(n)).length;
        const typed = query.trim();
        const available = source === 'mine' ? mine.length : base.length;
        const toggle = (name: string, on: boolean, value: Picked) => setPicking((p) => {
          const next = { ...p };
          if (on) next[name] = value; else delete next[name];
          return next;
        });
        const row = (name: string, unit: string, defaults: Picked, hint: string) => {
          const on = name in picking;
          const p = picking[name];
          return (
            <li key={name} className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 pr-2 py-1 rounded-2xl bg-gray-50">
              <input type="checkbox" checked={on} aria-label={name} className="h-6 w-6 rounded-md accent-sage flex-shrink-0"
                onChange={(e) => toggle(name, e.target.checked, defaults)} />
              <span className="flex-1 min-w-[8rem] py-2 text-[15px] text-gray-900 break-words">{name}</span>
              {on && p.perGuest ? (
                <div className="pb-1 sm:pb-0">
                  <PerGuestInput compact id={`pick-${name}`} value={p.perGuest} unit={unit} onChange={(q) => toggle(name, true, { ...p, perGuest: q })} />
                </div>
              ) : on ? (
                <span className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" min="0" step="any" value={p.qty} aria-label={`Quantité, ${name}`}
                    onChange={(e) => toggle(name, true, { ...p, qty: e.target.value })} className={cn(inputCls, 'w-20 h-10 px-2 text-center')} />
                  <span className="text-sm text-gray-500">{unit}</span>
                </span>
              ) : (
                <span className="text-sm text-gray-500">{hint}</span>
              )}
            </li>
          );
        };
        return (
          <Modal
            title={`Ajouter à « ${active.name} »`}
            onClose={() => setPicking(null)}
            toolbar={presets.length > 0 ? (
              <div className="flex gap-1 p-1 mb-1 rounded-xl bg-gray-100" role="tablist" aria-label="Liste">
                {([['mine', 'Mon matériel'], ['base', 'Liste de base']] as const).map(([key, label]) => (
                  <button key={key} role="tab" aria-selected={source === key} onClick={() => setSource(key)}
                    className={cn('flex-1 h-10 rounded-lg text-sm font-medium transition-colors', source === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                    {label}
                  </button>
                ))}
              </div>
            ) : undefined}
            footer={<>
              <button onClick={() => setPicking(null)} className={btnGhost}>Fermer</button>
              <button onClick={addPicked} disabled={count === 0 || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{count > 0 ? `Ajouter ${count} article${count > 1 ? 's' : ''}` : 'Ajouter'}</button>
            </>}
          >
            <div className="pb-3 space-y-5">
              <SearchField sticky autoFocus value={query} onChange={setQuery} label={source === 'mine' ? 'Rechercher dans mon matériel' : 'Rechercher dans la liste de base'}
                placeholder="Rechercher : chafing, glacière, rallonge…" status={searchStatus(query, shownNames.length, hiddenOn)} />
              {(!typed || shownNames.length > 0) && available > 0 && (
                <p className="text-sm text-gray-600">Cochez ce que ce modèle contient. Une quantité est fixe, ou se lit « 1 pour 30 couverts ».</p>
              )}
              {available === 0 && <p className="text-[15px] text-gray-700">{source === 'mine' ? 'Tout votre matériel est déjà dans ce modèle.' : 'Tous les articles de la liste de base sont déjà dans ce modèle.'}</p>}
              {typed && shownNames.length === 0 && (
                <div className="rounded-2xl bg-gray-50 px-4 py-4 space-y-3">
                  <p className="text-[15px] text-gray-700">{source === 'mine' ? 'Cet article n’est pas dans votre matériel.' : 'Cet article n’est pas dans la liste de base.'} Ajoutez-le vous-même à ce modèle.</p>
                  <button onClick={() => addTyped(typed)} className={cn(btnSecondary, 'h-auto min-h-11 py-2 max-w-full text-left')}>
                    <Plus className="h-4 w-4 flex-shrink-0" /><span className="min-w-0 break-words">Ajouter « {typed} »</span>
                  </button>
                </div>
              )}
              {source === 'mine' ? (
                foundMine.length > 0 && (
                  <ul className="space-y-1.5">
                    {foundMine.map((p) => row(p.name, p.unit || 'pièce',
                      { unit: p.unit || 'pièce', qty: String(p.default_qty), perGuest: p.qty_per_guest ? Number(p.qty_per_guest) : null },
                      qtyLabel({ default_qty: Number(p.default_qty), qty_per_guest: p.qty_per_guest ? Number(p.qty_per_guest) : null, unit: p.unit })))}
                  </ul>
                )
              ) : (
                [...new Set(foundBase.map((a) => a.group))].map((g) => {
                  const rows = foundBase.filter((a) => a.group === g);
                  const allOn = rows.every((a) => a.name in picking);
                  return (
                    <section key={g}>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-[15px] font-semibold text-gray-900">{g}</h3>
                        <button onClick={() => setPicking((p) => { const next = { ...p }; rows.forEach((a) => { if (allOn) delete next[a.name]; else next[a.name] = next[a.name] ?? { unit: a.unit, qty: String(a.qty), perGuest: null }; }); return next; })}
                          className="h-10 px-2 text-sm font-medium text-primary hover:text-primary-dark">{allOn ? 'Tout décocher' : 'Tout cocher'}</button>
                      </div>
                      <ul className="space-y-1.5">
                        {rows.map((a) => row(a.name, a.unit, { unit: a.unit, qty: String(a.qty), perGuest: null }, formatQty(a.qty, a.unit)))}
                      </ul>
                    </section>
                  );
                })
              )}
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
            <button onClick={saveItem} disabled={!form.name.trim() || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          </>}
        >
          <form onSubmit={(e) => { e.preventDefault(); saveItem(); }} className="space-y-4 pb-3">
            <div>
              <label htmlFor="mtpl-name" className={labelCls}>Article</label>
              <input id="mtpl-name" autoFocus list="mtpl-known" value={form.name} placeholder="Commencez à taper : chafing, caisse, rallonge…" className={inputCls}
                onChange={(e) => typeName(e.target.value)} />
              <datalist id="mtpl-known">
                {[...presets.map((p) => p.name), ...EQUIPMENT_BASE.map((a) => a.name).filter((n) => !presets.some((p) => sameName(p.name, n)))].map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <p className={labelCls} id="mtpl-mode-label">Quantité</p>
              <div className="flex gap-1 p-1 rounded-xl bg-gray-100" role="radiogroup" aria-labelledby="mtpl-mode-label">
                {([[false, 'Fixe'], [true, 'Selon les couverts']] as const).map(([perGuest, label]) => (
                  <button key={label} type="button" role="radio" aria-checked={form.perGuest === perGuest} onClick={() => setForm({ ...form, perGuest })}
                    className={cn('flex-1 h-10 rounded-lg text-sm font-medium transition-colors', form.perGuest === perGuest ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {form.perGuest ? (
              <PerGuestInput id="mtpl-ratio" value={form.ratio} unit={form.unit} example={50} onChange={(ratio) => setForm({ ...form, ratio })} />
            ) : (
              <div>
                <label htmlFor="mtpl-qty" className="sr-only">Quantité fixe</label>
                <input id="mtpl-qty" type="number" inputMode="decimal" min="0" step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={cn(inputCls, 'w-32')} />
              </div>
            )}
            <div>
              <label htmlFor="mtpl-unit" className={labelCls}>Unité</label>
              <select id="mtpl-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                {[...UNITS, ...(form.unit && !(UNITS as readonly string[]).includes(form.unit) ? [form.unit] : [])].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
