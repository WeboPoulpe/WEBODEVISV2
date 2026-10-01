'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Wine, UtensilsCrossed, Coffee, Wrench, Users, Package,
  Search, X, Loader2, Check, Trash2, UploadCloud, Truck, AlertCircle, Copy, Percent, FolderInput,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useUrlAction } from '@/lib/useUrlAction';
import { cn, formatCurrency } from '@/lib/utils';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { useAuth } from '@/context/AuthContext';
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

// ── Ligne du catalogue ────────────────────────────────────────────────────────
/** Texte brut d'une description mise en forme, pour l'aperçu dans la liste. */
const plainText = (html: string | null) =>
  (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&(#39|rsquo|apos);/g, '’')
    .replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const priceText = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Prix HT modifiable sur place : on tape, on quitte le champ (ou Entrée), c'est enregistré. */
function PriceCell({ p, onPrice }: { p: Prestation; onPrice: (price: number) => Promise<boolean> }) {
  const [value, setValue] = useState(priceText(p.unit_price));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => { setValue(priceText(p.unit_price)); }, [p.unit_price]);
  const commit = async () => {
    const n = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) { setValue(priceText(p.unit_price)); return; }
    const rounded = Math.round(n * 100) / 100;
    if (rounded === p.unit_price) { setValue(priceText(rounded)); return; }
    setState('saving');
    const ok = await onPrice(rounded);
    setState(ok ? 'saved' : 'error');
    if (!ok) setValue(priceText(p.unit_price));
    setTimeout(() => setState('idle'), 1500);
  };
  return (
    <span className="flex items-center gap-1 flex-shrink-0">
      <input value={value} inputMode="decimal" aria-label={`Prix HT, ${p.name}`}
        onChange={(e) => setValue(e.target.value)} onBlur={commit} onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setValue(priceText(p.unit_price)); (e.target as HTMLInputElement).blur(); } }}
        className={cn('w-[76px] sm:w-24 h-10 px-1.5 sm:px-2 text-right tabular-nums font-semibold text-gray-900 bg-transparent border rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors',
          state === 'error' ? 'border-danger' : state === 'saved' ? 'border-sage' : 'border-transparent hover:border-gray-200 focus:border-primary')} />
      <span className="hidden sm:inline text-xs text-gray-500 w-9">{state === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === 'saved' ? <Check className="h-4 w-4 text-sage" /> : '€ HT'}</span>
    </span>
  );
}

/** Case à cocher avec une cible tactile de 40 px. */
function SelectBox({ checked, onChange, label, indeterminate }: { checked: boolean; onChange: () => void; label: string; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <span className="w-10 h-10 flex items-center justify-center flex-shrink-0 rounded-xl hover:bg-gray-100">
      <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label}
        className="h-5 w-5 rounded border-gray-300 accent-primary cursor-pointer" />
    </span>
  );
}

function PrestationRow({
  p, onOpen, onDelete, onDuplicate, onPrice, selected, onToggle, highlighted,
}: {
  p: Prestation; onOpen: () => void; onDelete: () => void; onDuplicate: () => void; onPrice: (price: number) => Promise<boolean>;
  selected: boolean; onToggle: () => void; highlighted: boolean;
}) {
  const excerpt = plainText(p.description);
  return (
    <li data-prestation-id={p.id} className={cn('flex items-center gap-1 pr-2 transition-colors duration-700', selected ? 'bg-primary-50' : highlighted ? 'bg-sage-100' : 'hover:bg-gray-50')}>
      <label className="pl-1 sm:pl-2 cursor-pointer"><SelectBox checked={selected} onChange={onToggle} label={`Sélectionner ${p.name}`} /></label>
      <Link href={`/prestations/${p.id}`} onClick={onOpen} className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-left pl-1 py-3.5">
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
      </Link>
      <PriceCell p={p} onPrice={onPrice} />
      <button onClick={onDuplicate} className={cn(iconBtn, 'hidden sm:inline-flex')} aria-label={`Dupliquer ${p.name}`}><Copy className="h-4 w-4" /></button>
      <button onClick={onDelete} className={iconBtnDanger} aria-label={`Supprimer ${p.name}`}><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
/** Filtre et position de la liste, gardés le temps d'ouvrir une prestation. */
const LIST_STATE = 'prestations:liste';

export default function PrestationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Prestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [activeSub, setActiveSub] = useState<string | null>(null);
  // Retour depuis la page d'une prestation : filtre, position et prestation enregistrée mise en évidence.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const restoredScroll = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const { categories: dbCategories, subcategoriesFor } = usePrestationCategories();

  // ── Sélection (actions groupées) ───────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<{ categoryId: string; subCategoryId: string; saving: boolean; error: string | null } | null>(null);
  const [bulkDelete, setBulkDelete] = useState<{ saving: boolean; error: string | null } | null>(null);

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

  // Ouvrir une prestation : on note le filtre et la position de la liste pour les retrouver au retour.
  const rememberList = () => {
    try {
      sessionStorage.setItem(LIST_STATE, JSON.stringify({
        scroll: document.querySelector('main')?.scrollTop ?? 0, tab: activeTab, sub: activeSub, search,
      }));
    } catch { /* stockage indisponible : la liste repartira du haut */ }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = params.get('maj');
    if (!params.has('retour') && !saved) return;
    try {
      const state = JSON.parse(sessionStorage.getItem(LIST_STATE) ?? 'null') as { scroll: number; tab: string; sub: string | null; search: string } | null;
      if (state) {
        setActiveTab(state.tab || 'all');
        setActiveSub(state.sub ?? null);
        setSearch(state.search ?? '');
        restoredScroll.current = state.scroll ?? 0;
      }
    } catch { /* état illisible : liste par défaut */ }
    if (saved) setFocusId(saved);
    window.history.replaceState(null, '', '/prestations');
  }, []);

  // Une fois la liste chargée : même position qu'au départ, et la prestation enregistrée en vue, surlignée.
  useEffect(() => {
    if (loading) return;
    const main = document.querySelector('main');
    if (restoredScroll.current != null && main) {
      main.scrollTop = restoredScroll.current;
      restoredScroll.current = null;
    }
    if (!focusId) return;
    const item = items.find((p) => p.id === focusId);
    if (!item) { setFocusId(null); return; }
    const row = document.querySelector<HTMLElement>(`[data-prestation-id="${focusId}"]`);
    if (!row) {
      // Masquée par le filtre retrouvé (nouvelle prestation d'une autre catégorie) : on montre tout.
      setActiveTab('all'); setActiveSub(null); setSearch('');
      return;
    }
    const box = row.getBoundingClientRect();
    if (box.top < 80 || box.bottom > window.innerHeight - 100) row.scrollIntoView({ block: 'center' });
    setHighlightId(focusId);
    setSavedName(item.name);
    setFocusId(null);
    const t1 = setTimeout(() => setHighlightId(null), 2500);
    const t2 = setTimeout(() => setSavedName(null), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading, focusId, items, activeTab, activeSub, search]);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette prestation ?')) return;
    const { error } = await createClient().from('prestations').delete().eq('id', id);
    if (error) { alert('La prestation n’a pas pu être supprimée. Réessayez.'); return; }
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePrice = async (id: string, price: number) => {
    const { error } = await createClient().from('prestations').update({ unit_price: price }).eq('id', id);
    if (error) return false;
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, unit_price: price } : p)));
    return true;
  };

  // Révision des prix : un pourcentage appliqué aux prestations affichées (catégorie, recherche).
  const [raise, setRaise] = useState<{ percent: string; rounding: 'cent' | 'dime' | 'half'; saving: boolean; error: string | null } | null>(null);
  // Actions rapides du menu (lib/navMega.ts). Le sélecteur de fichier s'ouvre grâce au clic fait dans le menu.
  useUrlAction({
    reviser: () => { if (items.length > 0) setRaise({ percent: '', rounding: 'dime', saving: false, error: null }); },
    importer: () => fileInputRef.current?.click(),
  }, !loading);
  const roundPrice = (n: number, mode: 'cent' | 'dime' | 'half') =>
    mode === 'half' ? Math.round(n * 2) / 2 : mode === 'dime' ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
  const applyRaise = async (targets: Prestation[]) => {
    if (!raise) return;
    const pct = parseFloat(raise.percent.replace(',', '.'));
    if (!Number.isFinite(pct) || pct === 0) return;
    setRaise({ ...raise, saving: true, error: null });
    const supabase = createClient();
    const updates = targets.filter((p) => p.unit_price > 0).map((p) => ({ id: p.id, price: roundPrice(p.unit_price * (1 + pct / 100), raise.rounding) }));
    const results = await Promise.all(updates.map((u) => supabase.from('prestations').update({ unit_price: u.price }).eq('id', u.id)));
    const done = new Map(updates.filter((_, i) => !results[i].error).map((u) => [u.id, u.price]));
    setItems((prev) => prev.map((p) => (done.has(p.id) ? { ...p, unit_price: done.get(p.id)! } : p)));
    if (done.size < updates.length) setRaise({ ...raise, saving: false, error: `${updates.length - done.size} prix n’ont pas pu être modifiés. Réessayez.` });
    else setRaise(null);
  };

  // Changer de catégorie : identifiants et libellés texte restent cohérents, comme dans la fiche prestation.
  const applyBulkCategory = async (targets: Prestation[]) => {
    if (!bulkCat || targets.length === 0) return;
    setBulkCat({ ...bulkCat, saving: true, error: null });
    const cat = dbCategories.find((c) => c.id === bulkCat.categoryId);
    const sub = subcategoriesFor(bulkCat.categoryId).find((x) => x.id === bulkCat.subCategoryId);
    const patch = {
      category_id: cat?.id ?? null,
      category: cat?.name ?? null,
      sub_category_id: cat && sub ? sub.id : null,
      sub_category: cat && sub ? sub.name : null,
    };
    const ids = targets.map((p) => p.id);
    const { error } = await createClient().from('prestations').update(patch).in('id', ids);
    if (error) { setBulkCat({ ...bulkCat, saving: false, error: 'La catégorie n’a pas pu être changée. Vérifiez votre connexion et réessayez.' }); return; }
    const idSet = new Set(ids);
    setItems((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, ...patch } : p)));
    setBulkCat(null);
    setSelectedIds(new Set());
  };

  const applyBulkDelete = async (targets: Prestation[]) => {
    if (targets.length === 0) return;
    setBulkDelete({ saving: true, error: null });
    const ids = targets.map((p) => p.id);
    const { error } = await createClient().from('prestations').delete().in('id', ids);
    if (error) { setBulkDelete({ saving: false, error: 'Les prestations n’ont pas pu être supprimées. Réessayez.' }); return; }
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((p) => !idSet.has(p.id)));
    setBulkDelete(null);
    setSelectedIds(new Set());
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
    if (error) { alert('La copie n’a pas pu être créée. Réessayez.'); return; }
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

  // Seules les prestations affichées comptent : un filtre ou une recherche ne laisse pas d'action cachée.
  const selected = filtered.filter((p) => selectedIds.has(p.id));
  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const toggleOne = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));

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
          {items.length > 0 && (
            <button onClick={() => setRaise({ percent: '', rounding: 'dime', saving: false, error: null })} className={cn(btnSecondary, 'whitespace-nowrap')} aria-label="Réviser les prix">
              <Percent className="h-4 w-4" /><span className="hidden sm:inline">Réviser les prix</span>
            </button>
          )}
          <Link href="/prestations/nouvelle" onClick={rememberList} className={cn(btnPrimary, 'flex-1 sm:flex-none whitespace-nowrap')}>
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">Ajouter</span><span className="hidden sm:inline">Nouvelle prestation</span>
          </Link>
        </div>
      </div>

      {savedName && (
        <p role="status" className="flex items-center gap-2 text-sm text-gray-900 bg-sage-100 rounded-xl px-4 py-3 mb-3">
          <Check className="h-4 w-4 text-sage flex-shrink-0" />
          <span className="min-w-0 break-words">« {savedName} » est enregistrée.</span>
        </p>
      )}

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
            onClick={() => { setActiveTab(key); setActiveSub(null); setSelectedIds(new Set()); }}
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
            <Link href="/prestations/nouvelle" onClick={rememberList} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Nouvelle prestation
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6 mt-2">
          {/* Sélection : tout cocher, puis actions sur les prestations cochées */}
          <div className={cn('flex flex-wrap items-center gap-2 rounded-2xl', selected.length > 0 ? 'p-2 bg-white border border-primary-200' : 'pl-1 sm:pl-2')}
            role="toolbar" aria-label="Actions sur la sélection">
            <label className="flex items-center gap-1 pr-2 text-sm text-gray-700 cursor-pointer select-none">
              <SelectBox checked={allSelected} indeterminate={selected.length > 0 && !allSelected} onChange={toggleAll}
                label={allSelected ? 'Tout décocher' : 'Tout cocher'} />
              {selected.length > 0
                ? <span className="font-semibold text-gray-900">{selected.length} sélectionnée{selected.length > 1 ? 's' : ''}</span>
                : <span>Tout cocher ({filtered.length})</span>}
            </label>
            {selected.length > 0 && (
              <>
                <button onClick={() => setBulkCat({ categoryId: '', subCategoryId: '', saving: false, error: null })} className={btnSecondary}>
                  <FolderInput className="h-4 w-4" />Changer de catégorie
                </button>
                <button onClick={() => setBulkDelete({ saving: false, error: null })} className={cn(btnSecondary, 'text-danger')}>
                  <Trash2 className="h-4 w-4" />Supprimer
                </button>
                <button onClick={() => setSelectedIds(new Set())} className={btnGhost}>Annuler</button>
              </>
            )}
          </div>
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
                    onOpen={rememberList}
                    highlighted={highlightId === p.id}
                    onDelete={() => handleDelete(p.id)}
                    onDuplicate={() => handleDuplicate(p)}
                    onPrice={(price) => handlePrice(p.id, price)}
                    selected={selectedIds.has(p.id)}
                    onToggle={() => toggleOne(p.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {raise && (() => {
        const targets = filtered.filter((p) => p.unit_price > 0);
        const pct = parseFloat(raise.percent.replace(',', '.'));
        const valid = Number.isFinite(pct) && pct !== 0 && pct > -100;
        const sample = targets.slice(0, 3);
        const scope = search || activeTab !== 'all' ? 'affichées' : 'du catalogue';
        return (
          <Modal
            title="Réviser les prix"
            onClose={() => !raise.saving && setRaise(null)}
            footer={<>
              <button onClick={() => setRaise(null)} disabled={raise.saving} className={btnGhost}>Annuler</button>
              <button onClick={() => applyRaise(targets)} disabled={!valid || raise.saving || targets.length === 0} className={btnPrimary}>
                {raise.saving && <Loader2 className="h-4 w-4 animate-spin" />}Appliquer à {targets.length} prestation{targets.length > 1 ? 's' : ''}
              </button>
            </>}
          >
            <div className="space-y-4 pb-3">
              <p className="text-sm text-gray-600">Le pourcentage s’applique aux {targets.length} prestations {scope} qui ont un prix. Pour une seule catégorie, choisissez-la avant d’ouvrir cette fenêtre. Les devis déjà faits ne changent pas.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="raise-pct" className={labelCls}>Variation en %</label>
                  <input id="raise-pct" autoFocus inputMode="decimal" value={raise.percent} placeholder="4" onChange={(e) => setRaise({ ...raise, percent: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="raise-round" className={labelCls}>Arrondi</label>
                  <select id="raise-round" value={raise.rounding} onChange={(e) => setRaise({ ...raise, rounding: e.target.value as 'cent' | 'dime' | 'half' })} className={inputCls}>
                    <option value="cent">Au centime</option>
                    <option value="dime">Aux 10 centimes</option>
                    <option value="half">Aux 50 centimes</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray-500">Mettez un nombre négatif pour baisser les prix.</p>
              {valid && sample.length > 0 && (
                <ul className="rounded-2xl bg-gray-50 divide-y divide-gray-200 text-sm">
                  {sample.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="truncate text-gray-700">{p.name}</span>
                      <span className="tabular-nums whitespace-nowrap text-gray-900">{formatCurrency(p.unit_price)} → <strong>{formatCurrency(roundPrice(p.unit_price * (1 + pct / 100), raise.rounding))}</strong></span>
                    </li>
                  ))}
                </ul>
              )}
              {raise.error && <p role="alert" className={errorCls}>{raise.error}</p>}
            </div>
          </Modal>
        );
      })()}

      {bulkCat && (() => {
        const subs = subcategoriesFor(bulkCat.categoryId);
        return (
          <Modal
            title="Changer de catégorie"
            onClose={() => !bulkCat.saving && setBulkCat(null)}
            footer={<>
              <button onClick={() => setBulkCat(null)} disabled={bulkCat.saving} className={btnGhost}>Annuler</button>
              <button onClick={() => applyBulkCategory(selected)} disabled={bulkCat.saving || selected.length === 0} className={btnPrimary}>
                {bulkCat.saving && <Loader2 className="h-4 w-4 animate-spin" />}Appliquer à {selected.length} prestation{selected.length > 1 ? 's' : ''}
              </button>
            </>}
          >
            <div className="space-y-4 pb-3">
              <p className="text-sm text-gray-600">
                {selected.length > 1 ? `Les ${selected.length} prestations cochées passent` : 'La prestation cochée passe'} dans la catégorie choisie. Les devis déjà faits ne changent pas.
              </p>
              <div>
                <label htmlFor="bulk-cat" className={labelCls}>Catégorie</label>
                <select id="bulk-cat" value={bulkCat.categoryId} onChange={(e) => setBulkCat({ ...bulkCat, categoryId: e.target.value, subCategoryId: '' })} className={inputCls}>
                  <option value="">Sans catégorie</option>
                  {dbCategories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.user_id ? ' (la vôtre)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="bulk-subcat" className={labelCls}>Sous-catégorie</label>
                <select id="bulk-subcat" value={bulkCat.subCategoryId} disabled={!bulkCat.categoryId || subs.length === 0}
                  onChange={(e) => setBulkCat({ ...bulkCat, subCategoryId: e.target.value })} className={cn(inputCls, 'disabled:bg-gray-50 disabled:text-gray-400')}>
                  <option value="">Sans sous-catégorie</option>
                  {subs.map((x) => <option key={x.id} value={x.id}>{x.name}{x.user_id ? ' (la vôtre)' : ''}</option>)}
                </select>
              </div>
              {bulkCat.error && <p role="alert" className={errorCls}>{bulkCat.error}</p>}
            </div>
          </Modal>
        );
      })()}

      {bulkDelete && (
        <Modal
          title={`Supprimer ${selected.length} prestation${selected.length > 1 ? 's' : ''} ?`}
          onClose={() => !bulkDelete.saving && setBulkDelete(null)}
          footer={<>
            <button onClick={() => setBulkDelete(null)} disabled={bulkDelete.saving} className={btnGhost}>Annuler</button>
            <button onClick={() => applyBulkDelete(selected)} disabled={bulkDelete.saving || selected.length === 0} className={cn(btnPrimary, 'bg-danger hover:bg-danger/90')}>
              {bulkDelete.saving && <Loader2 className="h-4 w-4 animate-spin" />}Supprimer {selected.length} prestation{selected.length > 1 ? 's' : ''}
            </button>
          </>}
        >
          <div className="space-y-3 pb-3 text-[15px] text-gray-700">
            <p>{selected.length > 1 ? `Les ${selected.length} prestations cochées seront retirées` : 'La prestation cochée sera retirée'} de votre catalogue. Les devis où elles figurent déjà ne changent pas.</p>
            {selected.length <= 5 && (
              <ul className="rounded-2xl bg-gray-50 divide-y divide-gray-200 text-sm">
                {selected.map((p) => <li key={p.id} className="px-4 py-2.5 truncate">{p.name}</li>)}
              </ul>
            )}
            <p>La suppression est définitive.</p>
            {bulkDelete.error && <p role="alert" className={errorCls}>{bulkDelete.error}</p>}
          </div>
        </Modal>
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
