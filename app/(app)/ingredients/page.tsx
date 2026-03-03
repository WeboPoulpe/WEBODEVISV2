'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Carrot, Plus, Pencil, Trash2, Search, Loader2, Check,
  ChevronDown, ChevronUp, Truck, X, UploadCloud, AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ingredient {
  id: string;
  user_id: string | null;
  name: string;
  category: string | null;
  sub_category: string | null;
  unit: string | null;
  image_url: string | null;
  off_product_id: string | null;
}

interface Supplier {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

interface OFFResult {
  product_name: string;
  image_url?: string;
  id?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Crèmerie', 'Épicerie', 'Viandes', 'Charcuterie',
  'Poissons', 'Fruits & Légumes', 'Herbes & Épices',
  'Pâtisserie', 'Boissons', 'Boulangerie', 'Surgelés Pro', 'Divers',
];
const UNITS = ['kg', 'L', 'g', 'cl', 'Unité', 'boîte', 'pack', 'bouquet', 'tranche', 'portion', 'Botte', 'Bouteille', 'Rouleau', 'Douzaine', 'Pot', 'Barquette', 'Tube', 'Paquet'];

const CAT_COLORS: Record<string, string> = {
  'Crèmerie':         'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Épicerie':         'bg-orange-50 text-orange-700 border-orange-200',
  'Viandes':          'bg-red-50 text-red-700 border-red-200',
  'Charcuterie':      'bg-rose-50 text-rose-700 border-rose-200',
  'Poissons':         'bg-blue-50 text-blue-700 border-blue-200',
  'Fruits & Légumes': 'bg-green-50 text-green-700 border-green-200',
  'Herbes & Épices':  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pâtisserie':       'bg-pink-50 text-pink-700 border-pink-200',
  'Boissons':         'bg-purple-50 text-purple-700 border-purple-200',
  'Boulangerie':      'bg-amber-50 text-amber-700 border-amber-200',
  'Surgelés Pro':     'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Divers':           'bg-gray-100 text-gray-600 border-gray-200',
  // Rétrocompatibilité pour données existantes
  'Herbes':           'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Mapping des catégories CSV → catégories internes
const CSV_CAT_MAP: Record<string, string> = {
  'Crémerie':        'Crèmerie',
  'Boucherie':       'Viandes',
  'Poissonnerie':    'Poissons',
  'Herbes':          'Herbes & Épices',
  'Herbes & Épices': 'Herbes & Épices',
};

// ── CSV helpers ───────────────────────────────────────────────────────────────
interface CsvRow { name: string; category: string; sub_category: string; unit: string; }

/**
 * Parse CSV avec auto-détection du format :
 *  - 3 colonnes : Catégorie, Nom, Unité
 *  - 4 colonnes : Catégorie, Sous-Catégorie, Nom, Unité
 */
function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCols = lines[0].split(',').length;
  const hasSub = headerCols >= 4;

  return lines.slice(1)
    .map((line) => {
      const parts = line.split(',');
      if (hasSub) {
        const [rawCat = '', rawSub = '', rawName = '', rawUnit = ''] = parts;
        const category = CSV_CAT_MAP[rawCat.trim()] ?? rawCat.trim();
        return { name: rawName.trim(), category, sub_category: rawSub.trim(), unit: rawUnit.trim() || 'Unité' };
      } else {
        const [rawCat = '', rawName = '', rawUnit = ''] = parts;
        const category = CSV_CAT_MAP[rawCat.trim()] ?? rawCat.trim();
        return { name: rawName.trim(), category, sub_category: '', unit: rawUnit.trim() || 'Unité' };
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-[#9c27b0]" />
            <h2 className="font-semibold text-gray-900">Import CSV</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-0 border-b border-gray-100">
          <div className="flex-1 py-3 text-center">
            <p className="text-2xl font-bold text-[#9c27b0]">{toImport.length}</p>
            <p className="text-xs text-gray-500">à importer</p>
          </div>
          <div className="w-px bg-gray-100" />
          <div className="flex-1 py-3 text-center">
            <p className="text-2xl font-bold text-gray-300">{duplicate.length}</p>
            <p className="text-xs text-gray-400">déjà existants</p>
          </div>
          <div className="w-px bg-gray-100" />
          <div className="flex-1 py-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{rows.length}</p>
            <p className="text-xs text-gray-500">total CSV</p>
          </div>
        </div>

        {/* Warning si tous doublons */}
        {toImport.length === 0 && (
          <div className="flex items-center gap-2 mx-5 mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Tous les ingrédients du fichier existent déjà.
          </div>
        )}

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {rows.map((r, i) => {
            const isDup = existingNames.has(r.name.toLowerCase());
            return (
              <div key={i} className={['flex items-center gap-2 px-2 py-1.5 rounded-lg', isDup ? 'opacity-40' : 'hover:bg-gray-50'].join(' ')}>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CAT_COLORS[r.category] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {r.category || '—'}
                  </span>
                  {r.sub_category && (
                    <span className="text-[9px] text-gray-400 px-1.5">{r.sub_category}</span>
                  )}
                </div>
                <span className={`text-sm flex-1 min-w-0 truncate ${isDup ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {r.name}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">{r.unit}</span>
                {isDup && <span className="text-[10px] text-gray-400 italic flex-shrink-0">doublon</span>}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={toImport.length === 0 || importing}
            className="flex items-center gap-2 px-5 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Importer {toImport.length} ingrédient{toImport.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Open Food Facts search ─────────────────────────────────────────────────────
async function searchOFF(query: string): Promise<OFFResult[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,image_url,code`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products ?? [])
      .filter((p: OFFResult) => p.product_name?.trim())
      .slice(0, 8);
  } catch {
    return [];
  }
}

// ── Ingredient Modal ───────────────────────────────────────────────────────────
function IngredientModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Partial<Ingredient> | null;
  onSave: (data: Partial<Ingredient>) => Promise<void>;
  onClose: () => void;
}) {
  const [name,        setName]        = useState(initial?.name         ?? '');
  const [category,    setCategory]    = useState(initial?.category     ?? '');
  const [subCategory, setSubCategory] = useState(initial?.sub_category ?? '');
  const [unit,        setUnit]        = useState(initial?.unit         ?? 'Unité');
  const [imageUrl,    setImageUrl]    = useState(initial?.image_url    ?? '');
  const [offId,       setOffId]       = useState(initial?.off_product_id ?? '');
  const [saving,      setSaving]      = useState(false);

  // OFF autocomplete
  const [offQuery,   setOffQuery]   = useState('');
  const [offResults, setOffResults] = useState<OFFResult[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [showOff,    setShowOff]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
    setOffQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) { setOffResults([]); setShowOff(false); return; }
    debounceRef.current = setTimeout(async () => {
      setOffLoading(true);
      const results = await searchOFF(v);
      setOffResults(results);
      setShowOff(results.length > 0);
      setOffLoading(false);
    }, 400);
  };

  const selectOFF = (r: OFFResult) => {
    setName(r.product_name);
    setImageUrl(r.image_url ?? '');
    setOffId(r.id ?? '');
    setShowOff(false);
    setOffResults([]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      category: category || null,
      sub_category: subCategory || null,
      unit: unit || 'Unité',
      image_url: imageUrl || null,
      off_product_id: offId || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {initial?.id ? 'Modifier' : 'Ajouter'} un ingrédient
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Nom + autocomplete OFF */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowOff(false), 200)}
              placeholder="Ex. : Crème fraîche épaisse…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
              autoFocus
            />
            {offLoading && (
              <div className="absolute right-3 top-9">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
            {/* OFF dropdown */}
            {showOff && offResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden max-h-64 overflow-y-auto">
                <p className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wide border-b border-gray-100 font-semibold">
                  Open Food Facts
                </p>
                {offResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => selectOFF(r)}
                    className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="h-8 w-8 object-contain rounded flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 bg-gray-100 rounded flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-800 truncate">{r.product_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aperçu image si importée */}
          {imageUrl && (
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="h-12 w-12 object-contain rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate">Photo importée depuis Open Food Facts</p>
              </div>
              <button onClick={() => { setImageUrl(''); setOffId(''); }} className="text-gray-400 hover:text-red-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Catégorie + Unité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors bg-white"
              >
                <option value="">— Choisir —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unité</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors bg-white"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Sous-catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Sous-catégorie <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              placeholder="Ex. : Volaille, Fromage, Champignons…"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex items-center gap-2 px-5 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {initial?.id ? 'Modifier' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Supplier Row (inline edit) ─────────────────────────────────────────────────
function SupplierRow({
  supplier,
  onUpdate,
  onDelete,
}: {
  supplier: Supplier;
  onUpdate: (id: string, data: Partial<Supplier>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name,  setName]  = useState(supplier.name);
  const [email, setEmail] = useState(supplier.email ?? '');
  const [phone, setPhone] = useState(supplier.phone ?? '');
  const [notes, setNotes] = useState(supplier.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onUpdate(supplier.id, { name: name.trim(), email: email || null, phone: phone || null, notes: notes || null });
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
          <p className="text-xs text-gray-400 truncate">
            {[supplier.email, supplier.phone].filter(Boolean).join(' · ') || 'Aucune coordonnée'}
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-[#9c27b0] transition-colors rounded-lg hover:bg-gray-50">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(supplier.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#9c27b0]/30 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom *"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
        <button onClick={save} disabled={!name.trim() || saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#9c27b0] text-white font-medium rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IngredientsPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers,   setSuppliers]   = useState<Supplier[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('Tous');
  const [modal,       setModal]       = useState<{ open: boolean; item: Partial<Ingredient> | null }>({ open: false, item: null });
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [newSupplier,   setNewSupplier]   = useState(false);
  const [csvRows,       setCsvRows]       = useState<CsvRow[]>([]);
  const [showCsvModal,  setShowCsvModal]  = useState(false);
  const [importing,     setImporting]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nsName,  setNsName]  = useState('');
  const [nsEmail, setNsEmail] = useState('');
  const [nsPhone, setNsPhone] = useState('');
  const [nsNotes, setNsNotes] = useState('');
  const [nsSaving, setNsSaving] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const [{ data: ings }, { data: sups }] = await Promise.all([
      supabase.from('ingredients').select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('category', { nullsFirst: false })
        .order('name'),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
    ]);
    setIngredients((ings as Ingredient[]) ?? []);
    setSuppliers((sups as Supplier[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── CRUD Ingredients ────────────────────────────────────────────────────────
  const saveIngredient = async (data: Partial<Ingredient>) => {
    if (!user) return;
    const supabase = createClient();
    if (modal.item?.id) {
      const { data: updated } = await supabase.from('ingredients').update(data).eq('id', modal.item.id).select().single();
      if (updated) setIngredients((prev) => prev.map((i) => i.id === updated.id ? (updated as Ingredient) : i));
    } else {
      const { data: inserted } = await supabase.from('ingredients').insert([{ ...data, user_id: user.id }]).select().single();
      if (inserted) setIngredients((prev) => [...prev, inserted as Ingredient]);
    }
    setModal({ open: false, item: null });
  };

  const deleteIngredient = async (id: string) => {
    if (!confirm('Supprimer cet ingrédient ?')) return;
    await createClient().from('ingredients').delete().eq('id', id);
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  // ── CSV import ──────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCsvRows(parsed);
      setShowCsvModal(true);
    };
    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCsvConfirm = async () => {
    if (!user || csvRows.length === 0) return;
    setImporting(true);
    const existingNames = new Set(ingredients.map((i) => i.name.toLowerCase()));
    const toInsert = csvRows.filter((r) => !existingNames.has(r.name.toLowerCase()));
    if (toInsert.length > 0) {
      const supabase = createClient();
      const { data: inserted } = await supabase.from('ingredients').insert(
        toInsert.map((r) => ({
          user_id: user.id,
          name: r.name,
          category: r.category || null,
          sub_category: r.sub_category || null,
          unit: r.unit || 'Unité',
        }))
      ).select();
      if (inserted) setIngredients((prev) => [...prev, ...(inserted as Ingredient[])]);
    }
    setImporting(false);
    setShowCsvModal(false);
    setCsvRows([]);
  };

  // ── CRUD Suppliers ──────────────────────────────────────────────────────────
  const addSupplier = async () => {
    if (!user || !nsName.trim()) return;
    setNsSaving(true);
    const { data } = await createClient().from('suppliers').insert([{
      user_id: user.id, name: nsName.trim(),
      email: nsEmail || null, phone: nsPhone || null, notes: nsNotes || null,
    }]).select().single();
    if (data) setSuppliers((prev) => [...prev, data as Supplier]);
    setNsName(''); setNsEmail(''); setNsPhone(''); setNsNotes('');
    setNewSupplier(false);
    setNsSaving(false);
  };

  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    const { data: updated } = await createClient().from('suppliers').update(data).eq('id', id).select().single();
    if (updated) setSuppliers((prev) => prev.map((s) => s.id === id ? (updated as Supplier) : s));
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    await createClient().from('suppliers').delete().eq('id', id);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = ingredients.filter((i) => {
    const matchCat = catFilter === 'Tous' || i.category === catFilter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Carrot className="h-5 w-5 text-[#9c27b0]" />
            <h1 className="text-lg font-bold text-gray-900">Ingrédients</h1>
            {!loading && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {filtered.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] w-48 transition-all"
              />
            </div>
            {/* Hidden CSV file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Importer depuis un fichier CSV (Catégorie, Nom, Unité)"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <UploadCloud className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => setModal({ open: true, item: null })}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-lg hover:bg-[#7b1fa2] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {['Tous', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                catFilter === cat
                  ? 'bg-[#9c27b0] text-white border-[#9c27b0]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        ) : (
          <>
            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <Carrot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">
                  {search ? `Aucun résultat pour "${search}"` : 'Aucun ingrédient dans cette catégorie'}
                </p>
                <button
                  onClick={() => setModal({ open: true, item: null })}
                  className="mt-3 text-xs text-[#9c27b0] hover:underline font-medium"
                >
                  + Ajouter le premier ingrédient
                </button>
              </div>
            )}

            {/* Ingredients grid */}
            {filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filtered.map((ing) => (
                  <div
                    key={ing.id}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-[#9c27b0]/30 hover:shadow-sm transition-all group"
                  >
                    {/* Photo */}
                    <div className="h-28 bg-gray-50 flex items-center justify-center overflow-hidden">
                      {ing.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ing.image_url} alt={ing.name} className="h-full w-full object-contain p-2" />
                      ) : (
                        <Carrot className="h-8 w-8 text-gray-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{ing.name}</p>
                      {ing.sub_category && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{ing.sub_category}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {ing.category && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${CAT_COLORS[ing.category] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {ing.category}
                          </span>
                        )}
                        {ing.unit && (
                          <span className="text-[10px] text-gray-400">{ing.unit}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions (shown on hover, hidden for global ingredients) */}
                    {ing.user_id !== null && (
                      <div className="border-t border-gray-100 flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ open: true, item: ing })}
                          className="flex-1 flex items-center justify-center py-2 text-gray-400 hover:text-[#9c27b0] hover:bg-gray-50 transition-colors text-xs gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteIngredient(ing.id)}
                          className="flex-1 flex items-center justify-center py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {ing.user_id === null && (
                      <div className="border-t border-gray-100 px-3 py-1.5">
                        <span className="text-[9px] text-gray-400 italic">Bibliothèque globale</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Suppliers section (accordéon) ──────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowSuppliers((v) => !v)}
            className="flex items-center justify-between w-full px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[#9c27b0]" />
              <span className="font-semibold text-gray-900 text-sm">
                Fournisseurs
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {suppliers.length}
              </span>
            </div>
            {showSuppliers
              ? <ChevronUp className="h-4 w-4 text-gray-400" />
              : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {showSuppliers && (
            <div className="border-t border-gray-100 p-5 space-y-3">
              {suppliers.length === 0 && !newSupplier && (
                <p className="text-sm text-gray-400 italic text-center py-2">
                  Aucun fournisseur — ajoutez-en un pour pouvoir les lier à vos ingrédients d&apos;événement.
                </p>
              )}

              {suppliers.map((s) => (
                <SupplierRow key={s.id} supplier={s} onUpdate={updateSupplier} onDelete={deleteSupplier} />
              ))}

              {/* Add new supplier form */}
              {newSupplier ? (
                <div className="bg-[#f3e5f5]/20 border border-[#9c27b0]/20 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={nsName} onChange={(e) => setNsName(e.target.value)} placeholder="Nom du fournisseur *"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" autoFocus />
                    <input value={nsEmail} onChange={(e) => setNsEmail(e.target.value)} placeholder="Email"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
                    <input value={nsPhone} onChange={(e) => setNsPhone(e.target.value)} placeholder="Téléphone"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
                    <input value={nsNotes} onChange={(e) => setNsNotes(e.target.value)} placeholder="Notes (optionnel)"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setNewSupplier(false); setNsName(''); setNsEmail(''); setNsPhone(''); setNsNotes(''); }}
                      className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                      Annuler
                    </button>
                    <button onClick={addSupplier} disabled={!nsName.trim() || nsSaving}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs bg-[#9c27b0] text-white font-medium rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60">
                      {nsSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Ajouter
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewSupplier(true)}
                  className="flex items-center gap-2 text-sm text-[#9c27b0] hover:text-[#7b1fa2] font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un fournisseur
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Ingredient modal ──────────────────────────────────────────────── */}
      {modal.open && (
        <IngredientModal
          initial={modal.item}
          onSave={saveIngredient}
          onClose={() => setModal({ open: false, item: null })}
        />
      )}

      {/* ── CSV import modal ───────────────────────────────────────────────── */}
      {showCsvModal && (
        <CsvImportModal
          rows={csvRows}
          existingNames={new Set(ingredients.map((i) => i.name.toLowerCase()))}
          onConfirm={handleCsvConfirm}
          onClose={() => { setShowCsvModal(false); setCsvRows([]); }}
          importing={importing}
        />
      )}
    </div>
  );
}
