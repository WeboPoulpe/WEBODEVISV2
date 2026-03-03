'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Plus, Wine, UtensilsCrossed, Coffee, Wrench, Users, Package,
  Search, X, Loader2, Check, Pencil, Trash2, UploadCloud, Truck, AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import RichTextEditor from '@/components/ui/RichTextEditor';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Prestation {
  id: string;
  name: string;
  unit_price: number;
  category: string | null;
  sub_category: string | null;
  description: string | null;
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
            <UploadCloud className="h-4 w-4 text-[#9c27b0]" />
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
              <span className="text-xs text-[#9c27b0] font-medium capitalize">{r.category}</span>
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
            className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
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
  return CATEGORY_COLORS[cat.toLowerCase()] ?? { bg: 'bg-[#f3e5f5]', text: 'text-[#9c27b0]' };
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
      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
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
          <div className="bg-[#9c27b0] px-4 py-2">
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
              <div className="mt-1 pl-2 border-l-2 border-[#9c27b0]/15">
                <div
                  className="font-menu text-[9.5px] italic text-gray-500 leading-relaxed description-html"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              </div>
            )}
          </div>
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
  const [category, setCategory] = useState(initial?.category ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
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
      .eq('status', 'draft')
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
      .eq('status', 'draft');
    if (!drafts) return;
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
        await supabase.from('quotes').update({ services: updated }).eq('id', draft.id);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !price) { setError('Nom et prix requis.'); return; }
    if (!user) return;
    setLoading(true); setError(null);

    const supabase = createClient();
    const payload = {
      name: name.trim(),
      unit_price: parseFloat(price) || 0,
      category: category.trim() || null,
      description: description.trim() || null,
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
      onSaved(data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6">
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
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Prix unitaire HT *" value={price} onChange={setPrice}
                type="number" placeholder="85.00"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
                >
                  <option value="">— Aucune —</option>
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
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

            {/* Sync to drafts — only when editing and matching drafts exist */}
            {initial && draftCount > 0 && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={syncDrafts}
                  onChange={(e) => setSyncDrafts(e.target.checked)}
                  className="w-4 h-4 accent-[#9c27b0] rounded"
                />
                <span className="text-sm text-gray-600">
                  Mettre à jour{' '}
                  <span className="font-semibold text-[#9c27b0]">
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

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {initial ? 'Enregistrer' : 'Ajouter au catalogue'}
              </button>
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

// ── Prestation card ───────────────────────────────────────────────────────────
function PrestationCard({
  p, onEdit, onDelete,
}: {
  p: Prestation; onEdit: () => void; onDelete: () => void;
}) {
  const colors = categoryColor(p.category);
  return (
    <div className="group bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#9c27b0]/30 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{p.name}</p>
          {p.description && (
            <div
              className="text-xs text-gray-500 mt-0.5 line-clamp-2 description-html"
              dangerouslySetInnerHTML={{ __html: p.description }}
            />
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded-lg transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {p.category ? (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${colors.bg} ${colors.text}`}>
            {p.category}
          </span>
        ) : (
          <span />
        )}
        <p className="font-bold text-gray-900 tabular-nums">
          {formatCurrency(p.unit_price)}
          <span className="text-xs font-normal text-gray-400 ml-1">HT</span>
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PrestationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Prestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [modal, setModal] = useState<{ open: boolean; editing: Prestation | null }>({
    open: false, editing: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('prestations')
      .select('id, name, unit_price, category, sub_category, description')
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

  const filtered = items.filter((p) => {
    const matchTab = activeTab === 'all' || p.category?.toLowerCase() === activeTab;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Catalogue de prestations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? '…' : `${items.length} prestation${items.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle prestation
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
        {CATEGORIES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-1.5 flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-[#9c27b0] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-[#9c27b0]/30 hover:bg-[#f3e5f5]/50',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une prestation…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <div className="h-5 bg-gray-100 rounded-full w-16" />
                <div className="h-5 bg-gray-100 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Aucune prestation</p>
          <p className="text-sm text-gray-400 mb-4">
            {search ? 'Aucun résultat pour cette recherche.' : 'Commencez à construire votre catalogue.'}
          </p>
          {!search && (
            <button
              onClick={() => setModal({ open: true, editing: null })}
              className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Ajouter une prestation
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <PrestationCard
              key={p.id}
              p={p}
              onEdit={() => setModal({ open: true, editing: p })}
              onDelete={() => handleDelete(p.id)}
            />
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
