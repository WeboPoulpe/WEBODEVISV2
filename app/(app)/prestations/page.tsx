'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Wine, UtensilsCrossed, Coffee, Wrench, Users, Package,
  Search, X, Loader2, Check, Pencil, Trash2, UploadCloud, Truck, AlertCircle, Carrot, LayoutTemplate, Copy,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PENDING_STATUSES } from '@/lib/quoteStatus';
import { sanitizeHtml } from '@/lib/sanitize';
import { cn, formatCurrency } from '@/lib/utils';
import { btnPrimary, btnSecondary, cardCls, iconBtn, iconBtnDanger, inputCls, pill } from '@/components/ui/kit';
import { useAuth } from '@/context/AuthContext';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { usePrestationCategories } from '@/hooks/usePrestationCategories';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Prestation {
  id: string;
  name: string;
  unit_price: number;
  category: string | null;
  sub_category: string | null;
  category_id: string | null;
  sub_category_id: string | null;
  description: string | null;
  is_option: boolean;
}

interface IngredientLink {
  id: string;
  ingredient_id: string;
  qty_per_person: number;
  unit: string | null;
  ingredient: { id: string; name: string; unit: string | null };
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',          label: 'Tout',        icon: Package },
  { key: 'cocktail',     label: 'Cocktail',    icon: Wine },
  { key: 'dîner',        label: 'Dîner',       icon: UtensilsCrossed },
  { key: 'boissons',     label: 'Boissons',    icon: Coffee },
  { key: 'matériel',     label: 'Matériel',    icon: Wrench },
  { key: 'personnel',    label: 'Personnel',   icon: Users },
  { key: 'logistique',   label: 'Logistique',  icon: Truck },
];

// Sous-catégories par catégorie (catégorie → liste de sous-catégories)
const SUB_CATEGORIES: Record<string, string[]> = {
  cocktail:    ['Vin d\'honneur', 'Apéritif', 'Bouchées salées', 'Bouchées sucrées', 'Buffet', 'Autre'],
  dîner:       ['Entrée', 'Plat principal', 'Accompagnement', 'Fromage', 'Dessert', 'Menu complet', 'Autre'],
  boissons:    ['Alcoolisées', 'Sans alcool', 'Vins', 'Champagne', 'Café & thé', 'Autre'],
  matériel:    ['Vaisselle', 'Mobilier', 'Nappage', 'Décoration', 'Cuisine', 'Autre'],
  personnel:   ['Serveur', 'Chef à domicile', 'Maître d\'hôtel', 'Plongeur', 'Barman', 'Autre'],
  logistique:  ['Transport', 'Livraison', 'Installation', 'Déménagement', 'Autre'],
};

// Mapping catégories CSV → clés internes
const CSV_CAT_MAP: Record<string, string> = {
  'Personnel':   'personnel',
  'Matériel':    'matériel',
  'Logistique':  'logistique',
  'Cocktail':    'cocktail',
  'Dîner':       'dîner',
  'Boissons':    'boissons',
};

// ── CSV helpers ───────────────────────────────────────────────────────────────
interface CsvRow { name: string; category: string; sub_category: string; }

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCols = lines[0].split(',').length;
  const hasSub = headerCols >= 4;

  return lines.slice(1)
    .map((line) => {
      const parts = line.split(',');
      if (hasSub) {
        const [rawCat = '', rawSub = '', rawName = ''] = parts;
        const category = CSV_CAT_MAP[rawCat.trim()] ?? rawCat.trim().toLowerCase();
        return { name: rawName.trim(), category, sub_category: rawSub.trim() };
      } else {
        const [rawCat = '', rawName = ''] = parts;
        const category = CSV_CAT_MAP[rawCat.trim()] ?? rawCat.trim().toLowerCase();
        return { name: rawName.trim(), category, sub_category: '' };
      }
    })
    .filter((r) => r.name.length > 0);
}

function CsvImportModal({
  rows,
  existingNames,
  onConfirm,
  onClose,
  importing,
}: {
  rows: CsvRow[];
  existingNames: Set<string>;
  onConfirm: () => void;
  onClose: () => void;
  importing: boolean;
}) {
  const toImport  = rows.filter((r) => !existingNames.has(r.name.toLowerCase()));
  const duplicate = rows.filter((r) =>  existingNames.has(r.name.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-gray-900">Import CSV</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex gap-4 text-sm flex-shrink-0">
          <span className="text-green-700 font-semibold">{toImport.length} à importer</span>
          {duplicate.length > 0 && (
            <span className="text-amber-600">{duplicate.length} déjà présentes (ignorées)</span>
          )}
        </div>

        {duplicate.length > 0 && (
          <div className="px-5 py-2 bg-amber-50 flex items-center gap-2 flex-shrink-0 border-b border-amber-100">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">Les doublons ne seront pas importés.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {toImport.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
              <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <span className="text-sm text-gray-800 flex-1">{r.name}</span>
              {r.sub_category && (
                <span className="text-xs text-gray-400">{r.sub_category}</span>
              )}
              <span className="text-xs text-primary font-medium capitalize">{r.category}</span>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={importing || toImport.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-60 transition-colors"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Importer {toImport.length} prestation{toImport.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  cocktail:  { bg: 'bg-rose-50',   text: 'text-rose-600' },
  'dîner':   { bg: 'bg-amber-50',  text: 'text-amber-700' },
  boissons:  { bg: 'bg-blue-50',   text: 'text-blue-600' },
  'matériel':{ bg: 'bg-slate-100', text: 'text-slate-600' },
  personnel: { bg: 'bg-green-50',  text: 'text-green-700' },
};

function categoryColor(cat: string | null) {
  if (!cat) return { bg: 'bg-gray-100', text: 'text-gray-500' };
  return CATEGORY_COLORS[cat.toLowerCase()] ?? { bg: 'bg-primary-50', text: 'text-primary' };
}

// ── Shared field component ────────────────────────────────────────────────────
const Field = ({
  label, value, onChange, placeholder, type = 'text', ref,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
  ref?: React.Ref<HTMLInputElement>;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
    />
  </div>
);

// ── Live preview ──────────────────────────────────────────────────────────────
function DevisLinePreview({ name, price, description }: {
  name: string; price: string; description: string;
}) {
  const priceNum = parseFloat(price) || 0;
  const hasContent = name.trim() || priceNum > 0 || description;

  return (
    <div className="h-full flex flex-col">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Aperçu dans un devis
      </p>
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400 italic text-center">
            Remplissez le formulaire<br />pour voir l&apos;aperçu
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-primary px-4 py-2">
            <p className="text-[8px] tracking-[0.2em] text-white/60 uppercase">Extrait du devis</p>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-baseline gap-0 min-w-0">
              <span className="text-[11px] font-semibold text-gray-900 leading-snug">
                {name.trim() || '(sans nom)'}
              </span>
              <span className="dot-leader" />
              <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 font-medium">
                {formatCurrency(priceNum)}
              </span>
            </div>
            {description && (
              <div className="mt-1 pl-2 border-l-2 border-primary/15">
                <div
                  className="font-menu text-[9.5px] italic text-gray-500 leading-relaxed description-html"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ingredients section (inside modal, editing only) ─────────────────────────
function IngredientsSection({ prestationId, userId }: { prestationId: string; userId: string }) {
  const [links, setLinks] = useState<IngredientLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);

  const loadLinks = useCallback(async () => {
    const { data } = await createClient()
      .from('service_ingredients')
      .select('id, ingredient_id, qty_per_person, unit, ingredient:ingredients(id, name, unit)')
      .eq('service_id', prestationId);
    setLinks((data ?? []) as unknown as IngredientLink[]);
    setLoadingLinks(false);
  }, [prestationId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  useEffect(() => {
    if (!showAdd || search.trim().length < 2) { setOptions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from('ingredients')
        .select('id, name, unit')
        .eq('user_id', userId)
        .ilike('name', `%${search}%`)
        .limit(10);
      setOptions((data ?? []) as IngredientOption[]);
    }, 250);
    return () => clearTimeout(t);
  }, [search, showAdd, userId]);

  const addLink = async () => {
    if (!selected) return;
    setSaving(true);
    const { data, error } = await createClient()
      .from('service_ingredients')
      .insert({ service_id: prestationId, ingredient_id: selected.id, qty_per_person: parseFloat(qty) || 1, unit: selected.unit || null, user_id: userId })
      .select('id, ingredient_id, qty_per_person, unit, ingredient:ingredients(id, name, unit)')
      .single();
    setSaving(false);
    if (error) { alert('Impossible de lier l’ingrédient : ' + error.message); return; }
    if (data) setLinks((p) => [...p, data as unknown as IngredientLink]);
    setSelected(null); setSearch(''); setQty('1'); setShowAdd(false);
  };

  const removeLink = async (id: string) => {
    await createClient().from('service_ingredients').delete().eq('id', id);
    setLinks((p) => p.filter((l) => l.id !== id));
  };

  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Carrot className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-gray-700">Ingrédients (par personne)</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Ajouter
        </button>
      </div>

      {loadingLinks ? (
        <div className="flex justify-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" /></div>
      ) : links.length === 0 && !showAdd ? (
        <p className="text-[10px] text-gray-400 italic text-center py-1">Aucun ingrédient lié</p>
      ) : (
        <div className="space-y-1">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
              <span className="flex-1 text-gray-700 font-medium truncate">{l.ingredient.name}</span>
              <span className="text-primary font-bold tabular-nums">{l.qty_per_person} {l.unit ?? l.ingredient.unit ?? ''}/pers.</span>
              <button type="button" onClick={() => removeLink(l.id)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={selected ? selected.name : search}
              onChange={(e) => { setSelected(null); setSearch(e.target.value); }}
              placeholder="Rechercher un ingrédient…"
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {!selected && options.length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.id} type="button"
                  onClick={() => { setSelected(o); setSearch(o.name); setOptions([]); }}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  {o.name} {o.unit ? <span className="text-gray-400">({o.unit})</span> : null}
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-500 flex-shrink-0">Qté/pers.</label>
              <input
                type="number" min="0" step="0.1" value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="button" onClick={addLink} disabled={saving}
                className="flex items-center gap-1 px-3 py-1 text-[10px] font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                Lier
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add/Edit modal ────────────────────────────────────────────────────────────
interface ModalProps {
  initial?: Prestation | null;
  onClose: () => void;
  onSaved: (p: Prestation) => void;
}

function PrestationModal({ initial, onClose, onSaved }: ModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(String(initial?.unit_price ?? ''));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [costPrice, setCostPrice] = useState(String((initial as any)?.cost_price ?? ''));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [childPrice, setChildPrice] = useState(String((initial as any)?.child_unit_price ?? ''));
  const [category, setCategory] = useState(initial?.category ?? '');
  const [subCategory, setSubCategory] = useState(initial?.sub_category ?? '');
  const [categoryId, setCategoryId] = useState<string>((initial as Prestation & { category_id?: string | null })?.category_id ?? '');
  const [subCategoryId, setSubCategoryId] = useState<string>((initial as Prestation & { sub_category_id?: string | null })?.sub_category_id ?? '');
  const { categories: dbCategories, subcategoriesFor, reload: reloadCategories } = usePrestationCategories();
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingSubCat, setCreatingSubCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isOption, setIsOption] = useState(initial?.is_option ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncDrafts, setSyncDrafts] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Count draft quotes containing this prestation by name
  useEffect(() => {
    if (!initial?.name) return;
    const supabase = createClient();
    supabase
      .from('quotes')
      .select('id, services')
      .in('status', PENDING_STATUSES)
      .then(({ data }) => {
        if (!data) return;
        let count = 0;
        for (const quote of data) {
          if (Array.isArray(quote.services)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (quote.services.some((s: any) => s.name === initial.name)) count++;
          }
        }
        setDraftCount(count);
      });
  }, [initial?.name]);

  const syncDraftQuotes = async (newName: string, newDescription: string) => {
    if (!initial?.name) return;
    const supabase = createClient();
    const { data: drafts } = await supabase
      .from('quotes')
      .select('id, services')
      .in('status', PENDING_STATUSES);
    if (!drafts) return;
    // Prépare les updates puis les exécute en parallèle (au lieu d'un await par devis en série).
    const updates: PromiseLike<unknown>[] = [];
    for (const draft of drafts) {
      if (!Array.isArray(draft.services)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = draft.services.map((s: any) =>
        s.name === initial.name
          ? { ...s, name: newName, description: newDescription || null }
          : s
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changed = updated.some((s: any, i: number) =>
        JSON.stringify(s) !== JSON.stringify(draft.services[i])
      );
      if (changed) {
        updates.push(supabase.from('quotes').update({ services: updated }).eq('id', draft.id));
      }
    }
    await Promise.all(updates);
  };

  const createCategory = async () => {
    if (!user || !newCatName.trim()) return;
    const sb = createClient();
    const { data, error } = await sb.from('prestation_categories').insert({
      user_id: user.id, name: newCatName.trim(),
    }).select().single();
    if (error) { alert('Erreur: ' + error.message); return; }
    if (data) {
      await reloadCategories();
      setCategoryId(data.id);
      setSubCategoryId('');
      setCategory(data.name); // sync legacy string field
    }
    setNewCatName('');
    setCreatingCat(false);
  };

  const createSubCategory = async () => {
    if (!user || !newSubCatName.trim() || !categoryId) return;
    const sb = createClient();
    const { data, error } = await sb.from('prestation_subcategories').insert({
      user_id: user.id, category_id: categoryId, name: newSubCatName.trim(),
    }).select().single();
    if (error) { alert('Erreur: ' + error.message); return; }
    if (data) {
      await reloadCategories();
      setSubCategoryId(data.id);
      setSubCategory(data.name);
    }
    setNewSubCatName('');
    setCreatingSubCat(false);
  };

  const handleSaveAndWebo = async () => {
    if (!name.trim() || !price) { setError('Nom et prix requis.'); return; }
    if (!user) return;
    setLoading(true); setError(null);
    const supabase = createClient();
    const payload = {
      name: name.trim(),
      unit_price: parseFloat(price) || 0,
      cost_price: parseFloat(costPrice) || 0,
      child_unit_price: childPrice ? parseFloat(childPrice) : null,
      category: category.trim() || null,
      sub_category: subCategory.trim() || null,
      category_id: categoryId || null,
      sub_category_id: subCategoryId || null,
      is_option: isOption,
      user_id: user.id,
    };
    let prestationId = initial?.id;
    if (initial) {
      await supabase.from('prestations').update(payload).eq('id', initial.id);
    } else {
      const { data, error: err } = await supabase.from('prestations').insert([payload]).select().single();
      if (err) { setLoading(false); setError(err.message); return; }
      prestationId = data.id;
    }
    setLoading(false);
    window.location.href = `/prestations/${prestationId}/edit-webo`;
  };

  const handleSave = async () => {
    if (!name.trim() || !price) { setError('Nom et prix requis.'); return; }
    if (!user) return;
    setLoading(true); setError(null);

    const supabase = createClient();
    const payload = {
      name: name.trim(),
      unit_price: parseFloat(price) || 0,
      cost_price: parseFloat(costPrice) || 0,
      child_unit_price: childPrice ? parseFloat(childPrice) : null,
      category: category.trim() || null,
      sub_category: subCategory.trim() || null,
      category_id: categoryId || null,
      sub_category_id: subCategoryId || null,
      description: description.trim() || null,
      is_option: isOption,
      user_id: user.id,
    };

    if (initial) {
      const { data, error: err } = await supabase
        .from('prestations').update(payload).eq('id', initial.id).select().single();
      if (err) { setLoading(false); setError(err.message); return; }
      if (syncDrafts) await syncDraftQuotes(name.trim(), description.trim());
      setLoading(false);
      onSaved(data);
    } else {
      const { data, error: err } = await supabase
        .from('prestations').insert([payload]).select().single();
      setLoading(false);
      if (err) { setError(err.message); return; }
      // À la création: ouvre automatiquement le WeboWord pour styler la carte gastro
      window.location.href = `/prestations/${data.id}/edit-webo`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? 'Modifier la prestation' : 'Nouvelle prestation'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          {/* Left: form */}
          <div className="space-y-3">
            <Field
              label="Nom *" value={name} onChange={setName}
              ref={inputRef} placeholder="Plateau cocktail dînatoire"
            />
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Prix unitaire HT *" value={price} onChange={setPrice}
                type="number" placeholder="85.00"
              />
              <Field
                label="Prix enfant" value={childPrice} onChange={setChildPrice}
                type="number" placeholder="40.00"
              />
              <Field
                label="Prix de revient" value={costPrice} onChange={setCostPrice}
                type="number" placeholder="50.00"
              />
            </div>
            <p className="text-[10px] text-gray-400 italic -mt-2">💡 Prix enfant optionnel — utilisé si renseigné, sinon prix adulte appliqué pour tous</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Catégorie dynamique avec création inline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                  Catégorie
                  <button type="button" onClick={() => setCreatingCat((v) => !v)} className="text-[10px] text-primary hover:underline font-normal">
                    {creatingCat ? 'Annuler' : '+ Nouvelle'}
                  </button>
                </label>
                {creatingCat ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createCategory(); if (e.key === 'Escape') setCreatingCat(false); }}
                      placeholder="Nom de la catégorie…"
                      className="flex-1 min-w-0 px-3 py-2.5 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button type="button" onClick={createCategory} className="flex-shrink-0 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubCategoryId('');
                      const cat = dbCategories.find((c) => c.id === e.target.value);
                      setCategory(cat?.name || '');
                      setSubCategory('');
                    }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    <option value="">— Aucune —</option>
                    {dbCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.user_id ? ' ⭐' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sous-catégorie dynamique avec création inline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center justify-between">
                  Sous-catégorie
                  {categoryId && (
                    <button type="button" onClick={() => setCreatingSubCat((v) => !v)} className="text-[10px] text-primary hover:underline font-normal">
                      {creatingSubCat ? 'Annuler' : '+ Nouvelle'}
                    </button>
                  )}
                </label>
                {creatingSubCat ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createSubCategory(); if (e.key === 'Escape') setCreatingSubCat(false); }}
                      placeholder="Nom de la sous-catégorie…"
                      className="flex-1 min-w-0 px-3 py-2.5 border border-primary rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button type="button" onClick={createSubCategory} className="flex-shrink-0 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <select
                    value={subCategoryId}
                    onChange={(e) => {
                      setSubCategoryId(e.target.value);
                      const sub = subcategoriesFor(categoryId).find((s) => s.id === e.target.value);
                      setSubCategory(sub?.name || '');
                    }}
                    disabled={!categoryId}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">— Aucune —</option>
                    {subcategoriesFor(categoryId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.user_id ? ' ⭐' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <RichTextEditor
                initialValue={description}
                onChange={setDescription}
                placeholder="Détails, inclusions, allergènes…"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={isOption}
                onChange={(e) => setIsOption(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded"
              />
              <span className="text-sm text-gray-600">
                Marquer comme{' '}
                <span className="font-semibold text-amber-600">Option</span>
                {' '}(pré-cochée dans les devis)
              </span>
            </label>

            {/* Ingredients — only when editing an existing prestation */}
            {initial && user && (
              <IngredientsSection prestationId={initial.id} userId={user.id} />
            )}

            {/* Sync to drafts — only when editing and matching drafts exist */}
            {initial && draftCount > 0 && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={syncDrafts}
                  onChange={(e) => setSyncDrafts(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span className="text-sm text-gray-600">
                  Mettre à jour{' '}
                  <span className="font-semibold text-primary">
                    {draftCount} devis brouillon{draftCount > 1 ? 's' : ''}
                  </span>{' '}
                  contenant cette prestation
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <div className="flex justify-between gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAndWebo}
                  disabled={loading || !name.trim() || !price}
                  title="Enregistrer et styler dans WeboWord"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/40 rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
                  Styler dans WeboWord
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-60 transition-colors"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {initial ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="hidden lg:block border-l border-gray-100 pl-6">
            <DevisLinePreview name={name} price={price} description={description} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ligne du catalogue ────────────────────────────────────────────────────────
/** Texte brut d'une description mise en forme, pour l'aperçu dans la liste. */
const plainText = (html: string | null) =>
  (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&(#39|rsquo|apos);/g, '’')
    .replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();

function PrestationRow({
  p, onEdit, onDelete, onDuplicate,
}: {
  p: Prestation; onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const excerpt = plainText(p.description);
  return (
    <li className="flex items-center gap-1 pr-2 hover:bg-gray-50 transition-colors">
      <button onClick={onEdit} className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-left pl-4 sm:pl-5 py-3.5">
        <span className="sm:flex-1 min-w-0 w-full">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 line-clamp-2">{p.name}</span>
            {p.is_option && <span className={cn(pill, 'bg-gray-100 text-gray-700')}>Option</span>}
          </span>
          {(excerpt || p.sub_category) && (
            <span className="block text-sm text-gray-500 truncate mt-0.5">
              {p.sub_category && <span className="lg:hidden">{p.sub_category}{excerpt ? ', ' : ''}</span>}
              {excerpt}
            </span>
          )}
        </span>
        {p.sub_category && <span className="hidden lg:block w-44 text-sm text-gray-500 truncate">{p.sub_category}</span>}
        <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">
          {formatCurrency(p.unit_price)}
          <span className="text-xs font-normal text-gray-500 ml-1">HT</span>
        </span>
      </button>
      <button onClick={onDuplicate} className={iconBtn} aria-label={`Dupliquer ${p.name}`}><Copy className="h-4 w-4" /></button>
      <button onClick={onDelete} className={iconBtnDanger} aria-label={`Supprimer ${p.name}`}><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PrestationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Prestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; editing: Prestation | null }>({
    open: false, editing: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const { categories: dbCategories, subcategoriesFor } = usePrestationCategories();

  // Sous-catégories disponibles pour l'onglet actif
  const currentSubList = useMemo(() => {
    if (activeTab === 'all') return [];
    if (activeTab.startsWith('id:')) {
      const catId = activeTab.slice(3);
      return subcategoriesFor(catId).map((s) => ({ key: s.id, label: s.name }));
    }
    return (SUB_CATEGORIES[activeTab] ?? []).map((s) => ({ key: s, label: s }));
  }, [activeTab, subcategoriesFor]);

  // Combine hardcoded categories + DB-fetched custom categories (only those not already in hardcoded)
  const HARDCODED_KEYS = new Set(CATEGORIES.map((c) => c.key));
  const dynamicCategories = dbCategories
    .filter((c) => !HARDCODED_KEYS.has(c.name.toLowerCase()))
    .map((c) => ({ key: `id:${c.id}`, label: c.name, icon: Package, isCustom: true }));
  const allCategories = [
    ...CATEGORIES.map((c) => ({ ...c, isCustom: false })),
    ...dynamicCategories,
  ];

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('prestations')
      .select('id, name, unit_price, cost_price, child_unit_price, category, sub_category, category_id, sub_category_id, description, is_option')
      .order('category')
      .order('name');
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setCsvRows(rows);
      setShowCsvModal(true);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleCsvConfirm = async () => {
    if (!user) return;
    setImporting(true);
    const existingNames = new Set(items.map((i) => i.name.toLowerCase()));
    const toImport = csvRows.filter((r) => !existingNames.has(r.name.toLowerCase()));
    const supabase = createClient();
    const payload = toImport.map((r) => ({
      user_id: user.id,
      name: r.name,
      category: r.category || null,
      sub_category: r.sub_category || null,
      unit_price: 0,
      description: null,
    }));
    if (payload.length > 0) {
      await supabase.from('prestations').insert(payload);
    }
    setImporting(false);
    setShowCsvModal(false);
    setCsvRows([]);
    await load();
  };

  const handleSaved = (p: Prestation) => {
    setItems((prev) =>
      modal.editing
        ? prev.map((x) => (x.id === p.id ? p : x))
        : [p, ...prev],
    );
    setModal({ open: false, editing: null });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette prestation ?')) return;
    const supabase = createClient();
    await supabase.from('prestations').delete().eq('id', id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDuplicate = async (p: Prestation) => {
    if (!user) return;
    const supabase = createClient();
    // Fetch full prestation data including gastro_card_html and cost_price
    const { data: full } = await supabase.from('prestations').select('*').eq('id', p.id).single();
    if (!full) return;
    const { error } = await supabase.from('prestations').insert([{
      user_id: user.id,
      name: `${full.name} (copie)`,
      unit_price: full.unit_price,
      cost_price: full.cost_price,
      child_unit_price: full.child_unit_price,
      category: full.category,
      sub_category: full.sub_category,
      category_id: full.category_id,
      sub_category_id: full.sub_category_id,
      description: full.description,
      is_option: full.is_option,
      gastro_card_html: full.gastro_card_html,
      gastro_card_html_en: full.gastro_card_html_en,
    }]).select().single();
    if (error) { alert('Erreur: ' + error.message); return; }
    // Refetch pour que la copie apparaisse tout de suite, au bon endroit (tri/groupes).
    await load();
  };

  const filtered = items.filter((p) => {
    const matchTab =
      activeTab === 'all' ||
      (activeTab.startsWith('id:')
        ? p.category_id === activeTab.slice(3)
        : p.category?.toLowerCase() === activeTab);
    const matchSub = !activeSub || (
      activeTab.startsWith('id:')
        ? p.sub_category_id === activeSub
        : p.sub_category === activeSub
    );
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSub && matchSearch;
  });

  // Sans filtre, le catalogue est rangé par catégorie ; une catégorie choisie ou une recherche donne une liste simple.
  const groups = useMemo(() => {
    if (activeTab !== 'all' || search) return [{ label: '', items: filtered }];
    const byLabel = new Map<string, Prestation[]>();
    for (const p of filtered) {
      const label = dbCategories.find((c) => c.id === p.category_id)?.name ?? p.category ?? '';
      const key = label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : 'Sans catégorie';
      byLabel.set(key, [...(byLabel.get(key) ?? []), p]);
    }
    return [...byLabel.entries()]
      .sort(([a], [b]) => Number(a === 'Sans catégorie') - Number(b === 'Sans catégorie'))
      .map(([label, items]) => ({ label, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeTab, activeSub, search, dbCategories]);

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Prestations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? ' ' : `${items.length} prestation${items.length !== 1 ? 's' : ''} au catalogue`}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} className={cn(btnSecondary, 'whitespace-nowrap')} aria-label="Importer un CSV">
            <UploadCloud className="h-4 w-4" />
            <span className="sm:hidden">CSV</span><span className="hidden sm:inline">Importer un CSV</span>
          </button>
          <button onClick={() => setModal({ open: true, editing: null })} className={cn(btnPrimary, 'flex-1 sm:flex-none whitespace-nowrap')}>
            <Plus className="h-4 w-4" />
            Nouvelle prestation
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une prestation"
          aria-label="Rechercher une prestation"
          className={cn(inputCls, 'pl-11')}
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-3" role="tablist" aria-label="Catégories">
        {allCategories.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => { setActiveTab(key); setActiveSub(null); }}
            className={cn(
              'flex items-center gap-1.5 flex-shrink-0 h-10 px-3.5 rounded-full text-sm font-medium transition-colors',
              activeTab === key ? 'bg-forest text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {currentSubList.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-3">
          {currentSubList.map(({ key, label }) => (
            <button
              key={key}
              aria-pressed={activeSub === key}
              onClick={() => setActiveSub(activeSub === key ? null : key)}
              className={cn(
                'flex-shrink-0 h-9 px-3 rounded-full text-sm font-medium transition-colors',
                activeSub === key ? 'bg-primary-50 text-primary-700 border border-primary-200' : 'text-gray-600 border border-transparent hover:bg-gray-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden mt-2')}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
              <div className="h-4 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center mt-2')}>
          <p className="font-semibold text-gray-900 mb-1">
            {search || activeTab !== 'all' ? 'Aucune prestation ne correspond' : 'Votre catalogue est vide'}
          </p>
          <p className="text-sm text-gray-500 mb-5 max-w-sm">
            {search || activeTab !== 'all'
              ? 'Essayez un autre mot ou une autre catégorie.'
              : 'Ajoutez vos prestations une fois : elles se glissent ensuite dans chaque devis, avec leur prix.'}
          </p>
          {!search && activeTab === 'all' && (
            <button onClick={() => setModal({ open: true, editing: null })} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Nouvelle prestation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 mt-2">
          {groups.map((g) => (
            <section key={g.label || 'liste'}>
              {g.label && (
                <h2 className="flex items-baseline gap-2 px-1 mb-2 text-[15px] font-semibold text-gray-900">
                  {g.label}
                  <span className="text-sm font-normal text-gray-500">{g.items.length}</span>
                </h2>
              )}
              <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
                {g.items.map((p) => (
                  <PrestationRow
                    key={p.id}
                    p={p}
                    onEdit={() => setModal({ open: true, editing: p })}
                    onDelete={() => handleDelete(p.id)}
                    onDuplicate={() => handleDuplicate(p)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Prestation modal */}
      {modal.open && (
        <PrestationModal
          initial={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={handleSaved}
        />
      )}

      {/* CSV import modal */}
      {showCsvModal && (
        <CsvImportModal
          rows={csvRows}
          existingNames={new Set(items.map((i) => i.name.toLowerCase()))}
          onConfirm={handleCsvConfirm}
          onClose={() => { setShowCsvModal(false); setCsvRows([]); }}
          importing={importing}
        />
      )}
    </div>
  );
}
