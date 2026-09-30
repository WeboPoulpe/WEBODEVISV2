'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil, Plus, Printer, RefreshCw, Search, ShoppingBasket, Smartphone, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createSupplierOrders, recalculateCourses } from '@/server/events';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { Check, EmptyState, ErrorBanner, esc, printDocument, Progress, useActionError, type EventQuote, type Supplier } from './shared';

interface Ingredient { id: string; name: string; category: string | null; unit: string | null }

interface CourseLine {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  supplier_id: string | null;
  checked: boolean;
  source: string;
  ingredient: Ingredient | null;
  supplier: Supplier | null;
}

const LINE_SELECT = '*, ingredient:ingredients(id, name, category, unit), supplier:suppliers(id, name)';
const NO_SUPPLIER = 'Sans fournisseur';
const emptyForm = { id: null as string | null, ingredient: null as Ingredient | null, qty: '1', unit: '', supplierId: '', notes: '' };

// Liste de courses de l'événement : lignes calculées depuis les prestations et lignes ajoutées à la main.
export default function CoursesTab({ quote }: { quote: EventQuote }) {
  const { error, setError, check } = useActionError();
  const [lines, setLines] = useState<CourseLine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'recalc' | 'orders' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await createClient().from('event_ingredients').select(LINE_SELECT).eq('quote_id', quote.id).order('created_at');
    check(res, 'La liste de courses n’a pas pu être chargée. Rechargez la page.');
    setLines((res.data ?? []) as CourseLine[]);
    setLoading(false);
  }, [quote.id, check]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    createClient().from('suppliers').select('id, name').order('name').then(({ data }) => setSuppliers((data ?? []) as Supplier[]));
  }, []);

  // Recherche d'ingrédient dans la fenêtre d'ajout
  useEffect(() => {
    if (!form || form.id || form.ingredient) return;
    const timer = setTimeout(async () => {
      let query = createClient().from('ingredients').select('id, name, category, unit').order('name');
      if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
      const { data } = await query.limit(20);
      setResults((data ?? []) as Ingredient[]);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, form]);

  const recalc = async () => {
    const auto = lines.filter((l) => l.source === 'auto').length;
    if (auto > 0 && !confirm('Recalculer les quantités à partir des prestations du devis ?\nLes lignes ajoutées à la main sont conservées.')) return;
    setBusy('recalc'); setNotice(null);
    const res = await recalculateCourses(quote.id);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setError(null);
    const parts: string[] = [];
    parts.push(res.lines > 0 ? `${res.lines} ingrédient${res.lines > 1 ? 's' : ''} calculé${res.lines > 1 ? 's' : ''} pour ${quote.guest_count ?? 0} couverts.` : 'Aucun ingrédient à calculer : la liste n’a pas été modifiée.');
    if (res.withoutIngredients.length) parts.push(`Sans ingrédient renseigné : ${res.withoutIngredients.join(', ')}.`);
    if (res.unmatched.length) parts.push(`Lignes du devis absentes du catalogue : ${res.unmatched.join(', ')}.`);
    setNotice(parts.join(' '));
    await load();
  };

  const makeOrders = async () => {
    setBusy('orders'); setNotice(null);
    const res = await createSupplierOrders(quote.id);
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setError(null);
    setNotice(`${res.created} commande${res.created > 1 ? 's' : ''} en brouillon ${res.created > 1 ? 'créées' : 'créée'}.${res.withoutSupplier ? ` ${res.withoutSupplier} ingrédient${res.withoutSupplier > 1 ? 's' : ''} sans fournisseur ${res.withoutSupplier > 1 ? 'n’y figurent' : 'n’y figure'} pas.` : ''}`);
  };

  const toggle = async (line: CourseLine, checked: boolean) => {
    setLines((list) => list.map((l) => (l.id === line.id ? { ...l, checked } : l)));
    const res = await createClient().from('event_ingredients').update({ checked }).eq('id', line.id);
    if (!check(res, 'La case n’a pas pu être enregistrée. Réessayez.')) setLines((list) => list.map((l) => (l.id === line.id ? { ...l, checked: !checked } : l)));
  };

  const remove = async (line: CourseLine) => {
    const previous = lines;
    setLines((list) => list.filter((l) => l.id !== line.id));
    const res = await createClient().from('event_ingredients').delete().eq('id', line.id);
    if (!check(res, 'La ligne n’a pas pu être supprimée. Réessayez.')) setLines(previous);
  };

  const save = async () => {
    if (!form || (!form.id && !form.ingredient)) return;
    setSaving(true);
    const payload = {
      quantity: parseFloat(form.qty.replace(',', '.')) || 1,
      unit: form.unit.trim() || form.ingredient?.unit || null,
      supplier_id: form.supplierId || null,
      notes: form.notes.trim() || null,
    };
    const supabase = createClient();
    const res = form.id
      ? await supabase.from('event_ingredients').update(payload).eq('id', form.id).select(LINE_SELECT).single()
      : await supabase.from('event_ingredients').insert({ ...payload, quote_id: quote.id, ingredient_id: form.ingredient!.id, source: 'manuelle' }).select(LINE_SELECT).single();
    setSaving(false);
    if (!check(res, 'La ligne n’a pas pu être enregistrée. Réessayez.')) return;
    const saved = res.data as CourseLine;
    setLines((list) => (form.id ? list.map((l) => (l.id === saved.id ? saved : l)) : [...list, saved]));
    setForm(null);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, CourseLine[]>();
    for (const l of lines) {
      const key = l.supplier?.name ?? NO_SUPPLIER;
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b, 'fr')));
  }, [lines]);

  const print = () => {
    const body = grouped.map(([supplier, items]) => `
      <h2>${esc(supplier)}</h2>
      <table><thead><tr><th>Ingrédient</th><th class="r">Quantité</th></tr></thead><tbody>
      ${items.map((l) => `<tr><td>${esc(l.ingredient?.name)}${l.notes ? `<br><span class="muted">${esc(l.notes)}</span>` : ''}</td><td class="r">${l.quantity} ${esc(l.unit ?? l.ingredient?.unit)}</td></tr>`).join('')}
      </tbody></table>`).join('');
    if (!printDocument(`Liste de courses, ${quote.client_name}`, body)) setError('Le navigateur a bloqué l’ouverture du document. Autorisez les fenêtres pour ce site.');
  };

  const openAdd = () => { setSearch(''); setResults([]); setForm({ ...emptyForm }); };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />
      {notice && <p role="status" className="text-sm text-sage bg-sage-100 rounded-xl px-4 py-3">{notice}</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={openAdd} className={btnPrimary}><Plus className="h-4 w-4" />Ajouter un ingrédient</button>
        <button onClick={recalc} disabled={busy !== null} className={btnSecondary}>
          {busy === 'recalc' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Calculer depuis le devis
        </button>
        {lines.length > 0 && (
          <>
            <button onClick={makeOrders} disabled={busy !== null} className={btnSecondary}>
              {busy === 'orders' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBasket className="h-4 w-4" />}Créer les commandes
            </button>
            <Link href={`/evenements/${quote.id}/courses`} className={btnSecondary}><Smartphone className="h-4 w-4" />Mode courses</Link>
            <button onClick={print} className={btnSecondary}><Printer className="h-4 w-4" />Imprimer</button>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
      ) : lines.length === 0 ? (
        <EmptyState
          title="La liste de courses est vide"
          hint="Calculez-la depuis le devis (il faut des ingrédients renseignés sur vos prestations), ou ajoutez des ingrédients à la main."
        />
      ) : (
        <>
          <Progress done={lines.filter((l) => l.checked).length} total={lines.length} label={lines.length > 1 ? 'articles pris' : 'article pris'} />
          {grouped.map(([supplier, items]) => (
            <div key={supplier}>
              <p className="px-1 mb-2 text-sm font-medium text-gray-600">{supplier}</p>
              <ul className="space-y-2">
                {items.map((line) => (
                  <li key={line.id} className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-2xl bg-gray-50">
                    <Check checked={line.checked} onChange={(checked) => toggle(line, checked)} label={line.ingredient?.name ?? 'Ingrédient'} />
                    <div className="flex-1 min-w-0 py-1.5">
                      <p className={cn('text-[15px] font-medium break-words', line.checked ? 'line-through text-gray-400' : 'text-gray-900')}>
                        {line.ingredient?.name ?? 'Ingrédient supprimé'}
                      </p>
                      {line.notes && <p className="text-sm text-gray-600">{line.notes}</p>}
                    </div>
                    {line.source === 'manuelle' && <span className={cn(pill, 'hidden sm:inline-flex bg-white border border-gray-200 text-gray-600')}>Ajout manuel</span>}
                    <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{line.quantity} {line.unit ?? line.ingredient?.unit ?? ''}</span>
                    <button
                      onClick={() => setForm({ id: line.id, ingredient: line.ingredient, qty: String(line.quantity), unit: line.unit ?? '', supplierId: line.supplier_id ?? '', notes: line.notes ?? '' })}
                      className={iconBtn} aria-label={`Modifier ${line.ingredient?.name ?? 'la ligne'}`}
                    ><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(line)} className={iconBtnDanger} aria-label={`Supprimer ${line.ingredient?.name ?? 'la ligne'}`}><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {form && (
        <Modal
          title={form.id ? 'Modifier la ligne' : 'Ajouter un ingrédient'}
          onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
            <button onClick={save} disabled={saving || (!form.id && !form.ingredient)} className={btnPrimary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </button>
          </>}
        >
          {!form.id && !form.ingredient ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un ingrédient" aria-label="Rechercher un ingrédient" className={cn(inputCls, 'pl-11')} />
              </div>
              <ul className="space-y-1 min-h-[200px]">
                {results.map((ing) => (
                  <li key={ing.id}>
                    <button onClick={() => setForm({ ...form, ingredient: ing, unit: ing.unit ?? '' })} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left">
                      <span className="text-[15px] font-medium text-gray-900">{ing.name}</span>
                      {ing.category && <span className="text-sm text-gray-500">{ing.category}</span>}
                    </button>
                  </li>
                ))}
                {results.length === 0 && <li className="px-3 py-6 text-sm text-gray-600 text-center">Aucun ingrédient ne correspond.</li>}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-gray-50">
                <span className="font-medium text-gray-900">{form.ingredient?.name ?? 'Ingrédient'}</span>
                {!form.id && <button onClick={() => setForm({ ...form, ingredient: null })} className="text-sm font-medium text-primary hover:underline">Changer</button>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="course-qty" className={labelCls}>Quantité</label>
                  <input id="course-qty" type="number" inputMode="decimal" min="0" step="0.1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="course-unit" className={labelCls}>Unité</label>
                  <input id="course-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, L, pièce" className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="course-supplier" className={labelCls}>Fournisseur</label>
                <select id="course-supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputCls}>
                  <option value="">Aucun</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="course-notes" className={labelCls}>Note</label>
                <input id="course-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Bien mûres, à prendre le matin même" className={inputCls} />
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
