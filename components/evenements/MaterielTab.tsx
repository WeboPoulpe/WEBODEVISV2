'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ListChecks, Loader2, Pencil, Plus, Printer, Trash2, Wand2 } from 'lucide-react';
import MaterialPicker, { rememberMaterial } from './MaterialPicker';
import ApplyTemplateDialog, { type TemplateChoice } from './ApplyTemplateDialog';
import { createClient } from '@/lib/supabase/client';
import { quantityFor } from '@/lib/equipment';
import type { ApplyPlan } from '@/lib/templateApply';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import {
  Check, EmptyState, ErrorBanner, esc, isMaterielLine, isPersonnelLine, money, printDocument, useActionError,
  type EventQuote, type MaterialItem, type Supplier,
} from './shared';

interface RentalItem {
  id: string;
  material_name: string;
  qty: number;
  unit: string | null;
  supplier_id: string | null;
  price_per_unit: number;
  notes: string | null;
  supplier: Supplier | null;
  source: string | null;
  ordered: boolean | null;
  confirmed_individually: boolean | null;
}

interface RentalTemplateSet { id: string; name: string }

interface RentalTemplate {
  id: string;
  set_id: string | null;
  material_name: string;
  qty_per_guest: number;
  unit: string | null;
  default_supplier_id: string | null;
  default_price_per_unit: number;
}

interface MaterialTemplateSet { id: string; name: string }

interface MaterialTemplate {
  id: string;
  set_id: string;
  name: string;
  unit: string | null;
  default_qty: number;
  qty_per_guest: number | null;
}

type RentalData = { supplierId: string | null; price: number };

const RENTAL_SELECT = '*, supplier:suppliers(id, name)';
const NO_SUPPLIER = 'Sans fournisseur';
const emptyForm = { id: null as string | null, name: '', qty: '1', unit: '', supplierId: '', price: '0', notes: '' };

export default function MaterielTab({ quote, onChange }: { quote: EventQuote; onChange: (patch: Partial<EventQuote>) => void }) {
  const { user } = useAuth();
  const { error, setError, check } = useActionError();

  // ── À préparer : matériel ajouté à la main + lignes matériel / personnel du devis ──
  const materials = quote.event_materials ?? [];
  const lineChecks = quote.event_material_checks ?? [];
  const quoteLines = (quote.services ?? []).filter((l) => !l.isPageBreak && !l.removed && (isMaterielLine(l) || isPersonnelLine(l)));
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [picking, setPicking] = useState(false);

  const saveMaterials = async (next: MaterialItem[]) => {
    const previous = materials;
    onChange({ event_materials: next });
    const res = await createClient().from('quotes').update({ event_materials: next }).eq('id', quote.id);
    if (!check(res, 'Le matériel n’a pas pu être enregistré. Réessayez.')) onChange({ event_materials: previous });
  };

  const toggleLine = async (lineId: string, checked: boolean) => {
    const previous = lineChecks;
    const next = checked ? [...lineChecks, lineId] : lineChecks.filter((id) => id !== lineId);
    onChange({ event_material_checks: next });
    const res = await createClient().from('quotes').update({ event_material_checks: next }).eq('id', quote.id);
    if (!check(res, 'La case n’a pas pu être enregistrée. Réessayez.')) onChange({ event_material_checks: previous });
  };

  const addMaterial = () => {
    const value = name.trim();
    if (!value) return;
    setName(''); setQty('1'); setUnit('');
    saveMaterials([...materials, { id: crypto.randomUUID(), name: value, qty: parseFloat(qty) || 1, unit: unit.trim(), checked: false }]);
    // Ce qui est saisi à la main rejoint la liste de matériel : la prochaine fois, il suffira de le cocher.
    if (user) rememberMaterial(user.id, value, parseFloat(qty) || 1, unit.trim());
  };

  // ── Modèles de matériel (cocktail, dîner assis…), appliqués à « À préparer » ─────
  const guests = quote.guest_count ?? 0;
  const [materialSets, setMaterialSets] = useState<MaterialTemplateSet[]>([]);
  const [materialTemplates, setMaterialTemplates] = useState<MaterialTemplate[]>([]);
  const [choosingMaterialSet, setChoosingMaterialSet] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('material_template_sets').select('id, name').eq('user_id', user.id).order('created_at')
      .then(({ data }) => setMaterialSets((data ?? []) as MaterialTemplateSet[]));
    supabase.from('material_templates').select('id, set_id, name, unit, default_qty, qty_per_guest').eq('user_id', user.id).order('sort_order')
      .then(({ data }) => setMaterialTemplates((data ?? []) as MaterialTemplate[]));
  }, [user]);

  const materialChoices: TemplateChoice<null>[] = materialSets
    .map((s) => ({
      id: s.id,
      name: s.name,
      lines: materialTemplates.filter((t) => t.set_id === s.id).map((t) => ({
        name: t.name,
        unit: t.unit,
        qty: t.qty_per_guest != null ? quantityFor(Number(t.qty_per_guest), guests) : Number(t.default_qty),
        data: null,
      })),
    }))
    .filter((c) => c.lines.length > 0);

  const applyMaterials = (plan: ApplyPlan<null>) => {
    setChoosingMaterialSet(false);
    const removed = new Set(plan.remove.map((r) => r.id));
    const updated = new Map(plan.update.map((u) => [u.line.id, u.qty]));
    saveMaterials([
      // Une quantité qui augmente est à préparer de nouveau : la case se décoche.
      ...materials.filter((m) => !removed.has(m.id)).map((m) => (updated.has(m.id) ? { ...m, qty: updated.get(m.id)!, checked: false } : m)),
      ...plan.add.map((a) => ({ id: crypto.randomUUID(), name: a.name, qty: a.qty, unit: a.unit ?? '', checked: false })),
    ]);
  };

  // ── Location ───────────────────────────────────────────────────────────────
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [templates, setTemplates] = useState<RentalTemplate[]>([]);
  const [templateSets, setTemplateSets] = useState<RentalTemplateSet[]>([]);
  const [choosingSet, setChoosingSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('rental_items').select(RENTAL_SELECT).eq('quote_id', quote.id).order('created_at'),
      supabase.from('suppliers').select('id, name').order('name'),
    ]).then(([items, sups]) => {
      check(items, 'La location n’a pas pu être chargée. Rechargez la page.');
      setRentals((items.data ?? []) as RentalItem[]);
      setSuppliers((sups.data ?? []) as Supplier[]);
      setLoading(false);
    });
  }, [quote.id, check]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('rental_templates').select('*').eq('user_id', user.id).order('sort_order')
      .then(({ data }) => setTemplates((data ?? []) as RentalTemplate[]));
    supabase.from('rental_template_sets').select('id, name').eq('user_id', user.id).order('created_at')
      .then(({ data }) => setTemplateSets((data ?? []) as RentalTemplateSet[]));
  }, [user]);

  const saveRental = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      material_name: form.name.trim(),
      qty: parseFloat(form.qty) || 1,
      unit: form.unit.trim() || null,
      supplier_id: form.supplierId || null,
      price_per_unit: parseFloat(form.price.replace(',', '.')) || 0,
      notes: form.notes.trim() || null,
    };
    const supabase = createClient();
    const res = form.id
      ? await supabase.from('rental_items').update(payload).eq('id', form.id).select(RENTAL_SELECT).single()
      : await supabase.from('rental_items').insert({ ...payload, quote_id: quote.id, source: 'manual' }).select(RENTAL_SELECT).single();
    setSaving(false);
    if (!check(res, 'L’article n’a pas pu être enregistré. Réessayez.')) return;
    const saved = res.data as RentalItem;
    setRentals((list) => (form.id ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved]));
    setForm(null);
  };

  const patchRental = async (id: string, patch: Partial<RentalItem> & { confirmed_at?: string | null }, message: string) => {
    const previous = rentals;
    setRentals((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const res = await createClient().from('rental_items').update(patch).eq('id', id);
    if (!check(res, message)) setRentals(previous);
  };

  const removeRental = async (item: RentalItem) => {
    if (!confirm(`Supprimer « ${item.material_name} » de la location ?`)) return;
    const previous = rentals;
    setRentals((list) => list.filter((r) => r.id !== item.id));
    const res = await createClient().from('rental_items').delete().eq('id', item.id);
    if (!check(res, 'L’article n’a pas pu être supprimé. Réessayez.')) setRentals(previous);
  };

  // Les modèles qui ont au moins un article, avec leurs quantités calculées pour les couverts de l'événement.
  const rentalChoices: TemplateChoice<RentalData>[] = templateSets
    .map((s) => {
      const lines = templates.filter((t) => t.set_id === s.id).map((t) => ({
        name: t.material_name,
        unit: t.unit,
        qty: quantityFor(Number(t.qty_per_guest), guests),
        data: { supplierId: t.default_supplier_id, price: Number(t.default_price_per_unit) },
      }));
      return { id: s.id, name: s.name, lines, total: lines.reduce((sum, l) => sum + l.qty * l.data.price, 0) };
    })
    .filter((c) => c.lines.length > 0);

  // Ajouter ou remplacer (voir lib/templateApply.ts) : les lignes déjà commandées ne sont jamais modifiées en silence.
  const applyRental = async (plan: ApplyPlan<RentalData>) => {
    setChoosingSet(false);
    setGenerating(true);
    const supabase = createClient();
    const failed = 'La location n’a pas pu être mise à jour entièrement. Vérifiez la liste et réessayez.';
    let ok = true;
    if (plan.remove.length) ok = check(await supabase.from('rental_items').delete().in('id', plan.remove.map((r) => r.id)), failed);
    if (ok && plan.update.length) {
      const results = await Promise.all(plan.update.map((u) => supabase.from('rental_items').update({ qty: u.qty }).eq('id', u.line.id)));
      ok = check(results.find((r) => r.error) ?? { error: null }, failed);
    }
    if (ok && plan.add.length) {
      ok = check(await supabase.from('rental_items').insert(plan.add.map((a) => ({
        quote_id: quote.id,
        material_name: a.name,
        qty: a.qty,
        unit: a.unit,
        supplier_id: a.data.supplierId,
        price_per_unit: a.data.price,
        notes: a.complementOf ? 'Complément : une partie est déjà commandée' : null,
        source: 'template',
      }))), failed);
    }
    const fresh = await supabase.from('rental_items').select(RENTAL_SELECT).eq('quote_id', quote.id).order('created_at');
    if (!fresh.error) setRentals((fresh.data ?? []) as RentalItem[]);
    setGenerating(false);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, RentalItem[]>();
    for (const r of rentals) {
      const key = r.supplier?.name ?? NO_SUPPLIER;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === NO_SUPPLIER ? 1 : b === NO_SUPPLIER ? -1 : a.localeCompare(b, 'fr')));
  }, [rentals]);
  const total = rentals.reduce((s, r) => s + r.qty * r.price_per_unit, 0);

  const print = () => {
    const body = grouped.map(([supplier, items]) => `
      <h2>${esc(supplier)}</h2>
      <table><thead><tr><th>Article</th><th class="r">Quantité</th><th class="r">Prix unitaire</th><th class="r">Total</th></tr></thead><tbody>
      ${items.map((i) => `<tr><td>${esc(i.material_name)}${i.notes ? `<br><span class="muted">${esc(i.notes)}</span>` : ''}</td>
        <td class="r">${i.qty}${i.unit ? ` ${esc(i.unit)}` : ''}</td><td class="r">${money(i.price_per_unit)}</td><td class="r">${money(i.qty * i.price_per_unit)}</td></tr>`).join('')}
      </tbody></table>`).join('') + `<p class="r" style="margin-top:16px;font-weight:bold">Total : ${money(total)}</p>`;
    if (!printDocument(`Location de matériel, ${quote.client_name}`, body)) setError('Le navigateur a bloqué l’ouverture du document. Autorisez les fenêtres pour ce site.');
  };

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      {/* ── À préparer ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">À préparer</h3>
          <div className="flex flex-wrap gap-2">
            {materialChoices.length > 0 && (
              <button onClick={() => setChoosingMaterialSet(true)} className={btnSecondary}><Wand2 className="h-4 w-4" />Appliquer un modèle de matériel</button>
            )}
            <button onClick={() => setPicking(true)} className={btnSecondary}><ListChecks className="h-4 w-4" />Choisir dans ma liste</button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); addMaterial(); }} className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Matériel à emporter" aria-label="Nom du matériel" className={cn(inputCls, 'flex-1 min-w-[200px]')} />
          <input type="number" inputMode="decimal" min="0" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantité" className={cn(inputCls, 'w-24 text-center')} />
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unité" aria-label="Unité" className={cn(inputCls, 'w-28')} />
          <button type="submit" disabled={!name.trim()} className={cn(btnPrimary, 'h-12')}><Plus className="h-4 w-4" />Ajouter</button>
        </form>

        {materials.length === 0 && quoteLines.length === 0 ? (
          <EmptyState title="Rien à préparer pour l’instant" hint="Cochez ce que vous emportez dans votre liste de matériel, ou ajoutez un article ci-dessus : il rejoindra la liste." />
        ) : (
          <ul className="space-y-2">
            {materials.map((item) => (
              <li key={item.id} className="flex items-center gap-3 pl-3 pr-1 py-1 rounded-2xl bg-gray-50">
                <Check checked={!!item.checked} onChange={(checked) => saveMaterials(materials.map((m) => (m.id === item.id ? { ...m, checked } : m)))} label={item.name} />
                <span className={cn('flex-1 min-w-0 py-2 text-[15px] break-words', item.checked ? 'line-through text-gray-400' : 'text-gray-900')}>{item.name}</span>
                <span className="text-sm font-medium text-gray-700 tabular-nums whitespace-nowrap">{item.qty} {item.unit}</span>
                <button onClick={() => saveMaterials(materials.filter((m) => m.id !== item.id))} className={iconBtnDanger} aria-label={`Supprimer ${item.name}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {quoteLines.map((line) => {
              const checked = lineChecks.includes(line.id);
              return (
                <li key={line.id} className="flex items-center gap-3 px-3 py-1 rounded-2xl bg-gray-50">
                  <Check checked={checked} onChange={(next) => toggleLine(line.id, next)} label={line.name} />
                  <span className={cn('flex-1 min-w-0 py-2 text-[15px] break-words', checked ? 'line-through text-gray-400' : 'text-gray-900')}>{line.name}</span>
                  <span className={cn(pill, 'bg-white border border-gray-200 text-gray-600')}>du devis</span>
                  <span className="text-sm font-medium text-gray-700 tabular-nums whitespace-nowrap pr-2">× {line.quantity}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-sm text-gray-500">
          Le matériel qu’il faut pour un cocktail, un dîner assis… se prépare dans <Link href="/materiel?action=modeles" className="font-medium text-primary hover:underline">vos modèles de matériel</Link>.
        </p>
      </section>

      {/* ── Location ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Location</h3>
          <div className="flex flex-wrap gap-2">
            {rentalChoices.length > 0 && (
              <button onClick={() => setChoosingSet(true)} disabled={generating || loading} className={btnSecondary}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Appliquer un modèle de location
              </button>
            )}
            {rentals.length > 0 && <button onClick={print} className={btnSecondary}><Printer className="h-4 w-4" />Imprimer</button>}
            <button onClick={() => setForm({ ...emptyForm })} className={btnPrimary}><Plus className="h-4 w-4" />Ajouter un article</button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-50 animate-pulse" />)}</div>
        ) : rentals.length === 0 ? (
          <EmptyState
            title="Aucun matériel à louer"
            hint={rentalChoices.length === 0 ? 'Créez vos modèles de location (dîner assis, cocktail…) pour générer la liste selon le nombre de couverts.' : undefined}
          />
        ) : (
          <>
            {grouped.map(([supplier, items]) => (
              <div key={supplier}>
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <p className="text-sm font-medium text-gray-600">{supplier}</p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{money(items.reduce((s, i) => s + i.qty * i.price_per_unit, 0))}</p>
                </div>
                <ul className="space-y-2">
                  {items.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 pl-3 pr-1 py-1.5 rounded-2xl bg-gray-50">
                      <Check checked={!!r.ordered} onChange={(ordered) => patchRental(r.id, { ordered }, 'Le statut de commande n’a pas pu être enregistré.')} label={`${r.material_name} commandé`} />
                      <div className="flex-1 min-w-0 py-1">
                        <p className="text-[15px] font-medium text-gray-900 break-words">{r.material_name}</p>
                        <p className="text-sm text-gray-600 tabular-nums">{r.qty}{r.unit ? ` ${r.unit}` : ''} × {money(r.price_per_unit)}{r.notes ? `, ${r.notes}` : ''}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1 empty:hidden">
                          {r.ordered && <span className={cn(pill, 'bg-sage-100 text-sage')}>Commandé</span>}
                          {r.confirmed_individually && <span className={cn(pill, 'bg-primary-100 text-primary')}>Commandé à part</span>}
                        </div>
                      </div>
                      <p className="hidden sm:block font-display font-bold text-gray-900 tabular-nums">{money(r.qty * r.price_per_unit)}</p>
                      <button onClick={() => setForm({ id: r.id, name: r.material_name, qty: String(r.qty), unit: r.unit ?? '', supplierId: r.supplier_id ?? '', price: String(r.price_per_unit), notes: r.notes ?? '' })}
                        className={iconBtn} aria-label={`Modifier ${r.material_name}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => removeRental(r)} className={iconBtnDanger} aria-label={`Supprimer ${r.material_name}`}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="flex items-baseline justify-between px-1 pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Total de la location</span>
              <span className="font-display text-xl font-bold text-gray-900 tabular-nums">{money(total)}</span>
            </p>
          </>
        )}
        <p className="text-sm text-gray-500">
          Les modèles et la quantité par couvert de chaque article se règlent dans <Link href="/location-templates" className="font-medium text-primary hover:underline">vos modèles de location</Link>.
        </p>
      </section>

      {choosingSet && (
        <ApplyTemplateDialog
          sets={rentalChoices}
          guests={guests}
          current={rentals.map((r) => ({ id: r.id, name: r.material_name, qty: Number(r.qty), unit: r.unit, locked: !!(r.ordered || r.confirmed_individually) }))}
          labels={{
            add: 'Ajouter à la location actuelle',
            replace: 'Remplacer la location actuelle',
            current: (n) => `${n} article${n > 1 ? 's' : ''} de location`,
          }}
          onApply={(_, plan) => applyRental(plan)}
          onClose={() => setChoosingSet(false)}
        />
      )}

      {choosingMaterialSet && (
        <ApplyTemplateDialog
          sets={materialChoices}
          guests={guests}
          current={materials.map((m) => ({ id: m.id, name: m.name, qty: Number(m.qty), unit: m.unit || null }))}
          labels={{
            add: 'Ajouter au matériel à préparer',
            replace: 'Remplacer le matériel à préparer',
            current: (n) => `${n} article${n > 1 ? 's' : ''} à préparer`,
          }}
          onApply={(_, plan) => applyMaterials(plan)}
          onClose={() => setChoosingMaterialSet(false)}
        />
      )}

      {picking && user && (
        <MaterialPicker
          userId={user.id}
          guests={quote.guest_count ?? 0}
          already={materials.map((m) => m.name)}
          onClose={() => setPicking(false)}
          onAdd={(items) => saveMaterials([...materials, ...items.map((i) => ({ id: crypto.randomUUID(), name: i.name, qty: i.qty, unit: i.unit, checked: false }))])}
        />
      )}

      {form && (
        <Modal
          title={form.id ? 'Modifier l’article' : 'Nouvel article de location'}
          onClose={() => setForm(null)}
          footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>Annuler</button>
            <button onClick={saveRental} disabled={!form.name.trim() || saving} className={btnPrimary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </button>
          </>}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="rent-name" className={labelCls}>Article</label>
              <input id="rent-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Assiette plate 27 cm" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="rent-qty" className={labelCls}>Quantité</label>
                <input id="rent-qty" type="number" inputMode="decimal" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="rent-unit" className={labelCls}>Unité</label>
                <input id="rent-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pièce" className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="rent-price" className={labelCls}>Prix unitaire HT</label>
              <input id="rent-price" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="rent-supplier" className={labelCls}>Fournisseur</label>
              <select id="rent-supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={inputCls}>
                <option value="">Aucun</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rent-notes" className={labelCls}>Note</label>
              <input id="rent-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Livraison la veille" className={inputCls} />
            </div>
            {form.id && (() => {
              const current = rentals.find((r) => r.id === form.id);
              if (!current) return null;
              return (
                <label className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50 cursor-pointer">
                  <Check
                    checked={!!current.confirmed_individually}
                    onChange={(value) => patchRental(current.id, { confirmed_individually: value, confirmed_at: value ? new Date().toISOString() : null }, 'Le réglage n’a pas pu être enregistré.')}
                    label="Commandé à part"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="block font-medium text-gray-900">Commandé à part</span>
                    Cet article ne sera plus compté dans la page Location, qui regroupe les besoins de la saison.
                  </span>
                </label>
              );
            })()}
          </div>
        </Modal>
      )}
    </div>
  );
}
