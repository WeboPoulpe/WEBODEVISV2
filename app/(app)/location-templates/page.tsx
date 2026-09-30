'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Modèles de location : un par type de réception (dîner assis, cocktail, séminaire…). Chaque modèle liste
// ses articles avec une quantité par couvert ; dans un événement, on choisit le modèle à appliquer.

interface TemplateSet { id: string; name: string }
interface Item {
  id: string;
  set_id: string | null;
  material_name: string;
  qty_per_guest: number;
  unit: string | null;
  default_supplier_id: string | null;
  default_price_per_unit: number;
  sort_order: number;
}
interface Supplier { id: string; name: string }

const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const num = (v: string, fallback: number) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : fallback; };
const EXAMPLE_GUESTS = 100;
const emptyItem = { id: null as string | null, name: '', qty: '1', unit: '', supplierId: '', price: '0' };

export default function LocationTemplatesPage() {
  const { user } = useAuth();
  const [sets, setSets] = useState<TemplateSet[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  const [form, setForm] = useState<typeof emptyItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [s, i, sup] = await Promise.all([
      supabase.from('rental_template_sets').select('id, name').eq('user_id', user.id).order('created_at'),
      supabase.from('rental_templates').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('suppliers').select('id, name').order('name'),
    ]);
    if (s.error || i.error) setError('Vos modèles n’ont pas pu être chargés. Rechargez la page.');
    const loaded = (s.data ?? []) as TemplateSet[];
    setSets(loaded);
    setItems(((i.data ?? []) as Item[]).map((it) => ({ ...it, qty_per_guest: Number(it.qty_per_guest), default_price_per_unit: Number(it.default_price_per_unit) })));
    setSuppliers((sup.data ?? []) as Supplier[]);
    setActiveId((current) => (current && loaded.some((x) => x.id === current) ? current : loaded[0]?.id ?? null));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const active = sets?.find((s) => s.id === activeId) ?? null;
  const activeItems = useMemo(() => items.filter((i) => i.set_id === activeId), [items, activeId]);
  const example = activeItems.reduce((sum, i) => sum + Math.ceil(i.qty_per_guest * EXAMPLE_GUESTS) * i.default_price_per_unit, 0);
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name;

  // ── Modèles ──────────────────────────────────────────────────────────────────
  const saveName = async () => {
    if (!naming || !naming.name.trim() || !user) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const name = naming.name.trim();
    if (naming.id) {
      const res = await supabase.from('rental_template_sets').update({ name }).eq('id', naming.id);
      if (res.error) setError('Le nom n’a pas pu être enregistré. Réessayez.');
      else setSets((list) => (list ?? []).map((s) => (s.id === naming.id ? { ...s, name } : s)));
    } else {
      const res = await supabase.from('rental_template_sets').insert({ user_id: user.id, name }).select('id, name').single();
      if (res.error || !res.data) setError('Le modèle n’a pas pu être créé. Réessayez.');
      else { const created = res.data as TemplateSet; setSets((list) => [...(list ?? []), created]); setActiveId(created.id); }
    }
    setBusy(false);
    setNaming(null);
  };

  const duplicate = async () => {
    if (!active || !user) return;
    setBusy(true); setError(null);
    const supabase = createClient();
    const res = await supabase.from('rental_template_sets').insert({ user_id: user.id, name: `${active.name} (copie)` }).select('id, name').single();
    if (res.error || !res.data) { setError('Le modèle n’a pas pu être dupliqué. Réessayez.'); setBusy(false); return; }
    const copy = res.data as TemplateSet;
    if (activeItems.length > 0) {
      const inserted = await supabase.from('rental_templates').insert(activeItems.map((i) => ({
        user_id: user.id, set_id: copy.id, material_name: i.material_name, qty_per_guest: i.qty_per_guest, unit: i.unit,
        default_supplier_id: i.default_supplier_id, default_price_per_unit: i.default_price_per_unit, sort_order: i.sort_order,
      }))).select('*');
      if (inserted.error) setError('Le modèle est créé, mais ses articles n’ont pas pu être copiés.');
      else setItems((list) => [...list, ...((inserted.data ?? []) as Item[]).map((it) => ({ ...it, qty_per_guest: Number(it.qty_per_guest), default_price_per_unit: Number(it.default_price_per_unit) }))]);
    }
    setSets((list) => [...(list ?? []), copy]);
    setActiveId(copy.id);
    setBusy(false);
  };

  const removeSet = async () => {
    if (!active) return;
    if (!confirm(`Supprimer le modèle « ${active.name} » et ses ${activeItems.length} article${activeItems.length > 1 ? 's' : ''} ?\nLes locations déjà générées dans vos événements ne changent pas.`)) return;
    const res = await createClient().from('rental_template_sets').delete().eq('id', active.id);
    if (res.error) { setError('Le modèle n’a pas pu être supprimé. Réessayez.'); return; }
    const rest = (sets ?? []).filter((s) => s.id !== active.id);
    setSets(rest);
    setItems((list) => list.filter((i) => i.set_id !== active.id));
    setActiveId(rest[0]?.id ?? null);
  };

  // ── Articles ─────────────────────────────────────────────────────────────────
  const saveItem = async () => {
    if (!form || !form.name.trim() || !user || !active) return;
    setBusy(true); setError(null);
    const payload = {
      material_name: form.name.trim(),
      qty_per_guest: num(form.qty, 1),
      unit: form.unit.trim() || null,
      default_supplier_id: form.supplierId || null,
      default_price_per_unit: num(form.price, 0),
    };
    const supabase = createClient();
    const res = form.id
      ? await supabase.from('rental_templates').update(payload).eq('id', form.id).select('*').single()
      : await supabase.from('rental_templates').insert({ ...payload, user_id: user.id, set_id: active.id, sort_order: activeItems.length }).select('*').single();
    setBusy(false);
    if (res.error || !res.data) { setError('L’article n’a pas pu être enregistré. Réessayez.'); return; }
    const saved = { ...(res.data as Item), qty_per_guest: Number(res.data.qty_per_guest), default_price_per_unit: Number(res.data.default_price_per_unit) };
    setItems((list) => (form.id ? list.map((i) => (i.id === saved.id ? saved : i)) : [...list, saved]));
    setForm(null);
  };

  const removeItem = async (item: Item) => {
    if (!confirm(`Retirer « ${item.material_name} » du modèle ?`)) return;
    const previous = items;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const res = await createClient().from('rental_templates').delete().eq('id', item.id);
    if (res.error) { setItems(previous); setError('L’article n’a pas pu être retiré. Réessayez.'); }
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Modèles de location</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">Un modèle par type de réception. Dans un événement, vous choisissez le modèle et la location se calcule d’après le nombre de couverts.</p>
        </div>
        <button onClick={() => setNaming({ id: null, name: '' })} className={btnPrimary}><Plus className="h-4 w-4" />Nouveau modèle</button>
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      {sets === null ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1, 2].map((i) => <div key={i} className="px-5 py-4 animate-pulse"><div className="h-4 bg-gray-100 rounded w-1/3" /></div>)}
        </div>
      ) : sets.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">Aucun modèle de location</p>
          <p className="text-sm text-gray-500 mb-5 max-w-md">Créez par exemple « Dîner assis » avec une assiette, deux verres et trois couverts par personne, puis « Cocktail » avec ce qu’il lui faut.</p>
          <button onClick={() => setNaming({ id: null, name: '' })} className={btnPrimary}><Plus className="h-4 w-4" />Nouveau modèle</button>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-4" role="tablist" aria-label="Modèles de location">
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
                  <p className="text-sm text-gray-500">
                    {activeItems.length} article{activeItems.length > 1 ? 's' : ''}
                    {example > 0 && `, environ ${money(example)} pour ${EXAMPLE_GUESTS} couverts`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setNaming({ id: active.id, name: active.name })} className={iconBtn} aria-label="Renommer le modèle"><Pencil className="h-4 w-4" /></button>
                  <button onClick={duplicate} disabled={busy} className={iconBtn} aria-label="Dupliquer le modèle"><Copy className="h-4 w-4" /></button>
                  <button onClick={removeSet} className={iconBtnDanger} aria-label="Supprimer le modèle"><Trash2 className="h-4 w-4" /></button>
                  <button onClick={() => setForm({ ...emptyItem })} className={cn(btnSecondary, 'ml-1')}><Plus className="h-4 w-4" />Ajouter un article</button>
                </div>
              </header>

              {activeItems.length === 0 ? (
                <p className="px-5 pb-6 text-[15px] text-gray-600">Ce modèle est vide. Ajoutez ses articles : assiettes, verres, couverts, nappes, mobilier.</p>
              ) : (
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {activeItems.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 pl-4 sm:pl-5 pr-2 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 break-words">{i.material_name}</p>
                        <p className="text-sm text-gray-500">
                          {i.qty_per_guest.toLocaleString('fr-FR')} {i.unit || 'pièce'} par couvert
                          {supplierName(i.default_supplier_id) && `, ${supplierName(i.default_supplier_id)}`}
                          {i.default_price_per_unit > 0 && <span className="sm:hidden">, {money(i.default_price_per_unit)} l’unité</span>}
                        </p>
                      </div>
                      <p className="hidden sm:block text-sm font-medium text-gray-700 tabular-nums whitespace-nowrap">{i.default_price_per_unit > 0 ? `${money(i.default_price_per_unit)} l’unité` : ''}</p>
                      <button onClick={() => setForm({ id: i.id, name: i.material_name, qty: String(i.qty_per_guest), unit: i.unit ?? '', supplierId: i.default_supplier_id ?? '', price: String(i.default_price_per_unit) })}
                        className={iconBtn} aria-label={`Modifier ${i.material_name}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => removeItem(i)} className={iconBtnDanger} aria-label={`Retirer ${i.material_name}`}><Trash2 className="h-4 w-4" /></button>
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
          title={naming.id ? 'Renommer le modèle' : 'Nouveau modèle de location'}
          onClose={() => setNaming(null)}
          footer={<>
            <button onClick={() => setNaming(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveName} disabled={!naming.name.trim() || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{naming.id ? 'Enregistrer' : 'Créer le modèle'}</button>
          </>}
        >
          <form onSubmit={(e) => { e.preventDefault(); saveName(); }} className="pb-3">
            <label htmlFor="set-name" className={labelCls}>Nom du modèle</label>
            <input id="set-name" autoFocus value={naming.name} onChange={(e) => setNaming({ ...naming, name: e.target.value })} placeholder="Dîner assis, Cocktail, Séminaire" className={inputCls} />
          </form>
        </Modal>
      )}

      {form && (
        <Modal
          title={form.id ? 'Modifier l’article' : 'Nouvel article'}
          onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveItem} disabled={!form.name.trim() || busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
          </>}
        >
          <div className="space-y-4 pb-3">
            <div>
              <label htmlFor="tpl-name" className={labelCls}>Article</label>
              <input id="tpl-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Assiette plate 27 cm" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tpl-qty" className={labelCls}>Quantité par couvert</label>
                <input id="tpl-qty" type="number" inputMode="decimal" min="0" step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="tpl-unit" className={labelCls}>Unité</label>
                <input id="tpl-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pièce" className={inputCls} />
              </div>
            </div>
            <p className="text-sm text-gray-500 -mt-2">Pour une table de dix, indiquez 0,1 : la quantité est arrondie à l’unité supérieure.</p>
            <div>
              <label htmlFor="tpl-price" className={labelCls}>Prix unitaire HT</label>
              <input id="tpl-price" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="tpl-supplier" className={labelCls}>Fournisseur habituel</label>
              <select id="tpl-supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputCls}>
                <option value="">Aucun</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
