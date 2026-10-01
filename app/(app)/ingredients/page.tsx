'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Carrot, Plus, Pencil, Trash2, Search, Loader2, Check,
  ChevronDown, ChevronRight, X, UploadCloud, ImagePlus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUrlAction } from '@/lib/useUrlAction';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/evenements/shared';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ingredient {
  id: string;
  user_id: string | null;
  name: string;
  category: string | null;
  sub_category: string | null;
  unit: string | null;
  image_url: string | null;
  /** Auteur et licence de la photo, quand elle vient d'une banque d'images libres. */
  image_credit?: string | null;
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

// ── Constantes ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Crèmerie', 'Épicerie', 'Viandes', 'Charcuterie',
  'Poissons', 'Fruits & Légumes', 'Herbes & Épices',
  'Pâtisserie', 'Boissons', 'Boulangerie', 'Surgelés Pro', 'Divers',
];
const UNITS = ['kg', 'L', 'g', 'cl', 'Unité', 'boîte', 'pack', 'bouquet', 'tranche', 'portion', 'Botte', 'Bouteille', 'Rouleau', 'Douzaine', 'Pot', 'Barquette', 'Tube', 'Paquet'];

// Correspondance des catégories d'un fichier CSV avec celles de l'app
const CSV_CAT_MAP: Record<string, string> = {
  'Crémerie':        'Crèmerie',
  'Boucherie':       'Viandes',
  'Poissonnerie':    'Poissons',
  'Herbes':          'Herbes & Épices',
  'Herbes & Épices': 'Herbes & Épices',
};

// ── CSV ───────────────────────────────────────────────────────────────────────
interface CsvRow { name: string; category: string; sub_category: string; unit: string; }

/**
 * Lecture d'un CSV, format détecté d'après l'en-tête :
 *  - 3 colonnes : Catégorie, Nom, Unité
 *  - 4 colonnes : Catégorie, Sous-catégorie, Nom, Unité
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
  rows, existingNames, onConfirm, onClose, importing,
}: {
  rows: CsvRow[];
  existingNames: Set<string>;
  onConfirm: () => void;
  onClose: () => void;
  importing: boolean;
}) {
  const toImport  = rows.filter((r) => !existingNames.has(r.name.toLowerCase()));
  const duplicate = rows.length - toImport.length;

  return (
    <Modal
      title="Importer un CSV"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={onConfirm} disabled={toImport.length === 0 || importing} className={btnPrimary}>
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Importer {toImport.length} ingrédient{toImport.length > 1 ? 's' : ''}
        </button>
      </>}
    >
      <div className="pb-3">
        <p className="text-[15px] text-gray-700 mb-3">
          {rows.length} ligne{rows.length > 1 ? 's' : ''} dans le fichier : {toImport.length} à importer
          {duplicate > 0 && `, ${duplicate} déjà présente${duplicate > 1 ? 's' : ''} et laissée${duplicate > 1 ? 's' : ''} de côté`}.
        </p>
        {toImport.length === 0 && <p className={cn(errorCls, 'mb-3')}>Tous les ingrédients du fichier existent déjà.</p>}
        <ul className="divide-y divide-gray-100 border-y border-gray-100">
          {rows.map((r, i) => {
            const isDup = existingNames.has(r.name.toLowerCase());
            return (
              <li key={i} className={cn('flex items-center gap-3 py-2.5', isDup && 'opacity-50')}>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-[15px] truncate', isDup ? 'line-through text-gray-500' : 'text-gray-900')}>{r.name}</span>
                  <span className="block text-sm text-gray-500 truncate">{[r.category, r.sub_category].filter(Boolean).join(', ') || 'Sans catégorie'}</span>
                </span>
                <span className="text-sm text-gray-500 flex-shrink-0">{isDup ? 'déjà présent' : r.unit}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

// ── Recherche Open Food Facts ─────────────────────────────────────────────────
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

// ── Fiche d'un ingrédient ─────────────────────────────────────────────────────
function IngredientModal({
  initial, onSave, onClose,
}: {
  initial: Partial<Ingredient> | null;
  /** Renvoie un message d'erreur, ou null si l'enregistrement a réussi. */
  onSave: (data: Partial<Ingredient>) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name,        setName]        = useState(initial?.name         ?? '');
  const [category,    setCategory]    = useState(initial?.category     ?? '');
  const [subCategory, setSubCategory] = useState(initial?.sub_category ?? '');
  const [unit,        setUnit]        = useState(initial?.unit         ?? 'Unité');
  const [imageUrl,    setImageUrl]    = useState(initial?.image_url    ?? '');
  const [offId,       setOffId]       = useState(initial?.off_product_id ?? '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [minStockAlert, setMinStockAlert] = useState(String((initial as any)?.min_stock_alert ?? ''));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [volumeUnitPrice, setVolumeUnitPrice] = useState(String((initial as any)?.volume_unit_price ?? ''));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [preferredSupplierId, setPreferredSupplierId] = useState((initial as any)?.preferred_supplier_id ?? '');
  const [suppliersList, setSuppliersList] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    createClient().from('suppliers').select('id, name').order('name').then(({ data }) => {
      setSuppliersList((data as { id: string; name: string }[]) ?? []);
    });
  }, []);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Suggestions Open Food Facts pendant la saisie du nom
  const [offResults, setOffResults] = useState<OFFResult[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  const [showOff,    setShowOff]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
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

  const photoChanged = imageUrl !== (initial?.image_url ?? '');

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    const err = await onSave({
      name: name.trim(),
      category: category || null,
      sub_category: subCategory || null,
      unit: unit || 'Unité',
      image_url: imageUrl || null,
      // Une photo remplacée perd le crédit de l'ancienne.
      ...(photoChanged ? { image_credit: null } : {}),
      off_product_id: offId || null,
      min_stock_alert: parseFloat(minStockAlert) || 0,
      volume_unit_price: parseFloat(volumeUnitPrice) || 0,
      preferred_supplier_id: preferredSupplierId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <Modal
      title={initial?.id ? 'Modifier l’ingrédient' : 'Nouvel ingrédient'}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={handleSave} disabled={!name.trim() || saving} className={btnPrimary}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{initial?.id ? 'Enregistrer' : 'Ajouter'}
        </button>
      </>}
    >
      <div className="space-y-4 pb-3">
        <div className="relative">
          <label htmlFor="ing-name" className={labelCls}>Nom</label>
          <input
            id="ing-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowOff(false), 200)}
            placeholder="Crème fraîche épaisse"
            className={cn(inputCls, 'pr-10')}
            autoFocus
            autoComplete="off"
          />
          {offLoading && <Loader2 className="absolute right-4 top-[46px] h-4 w-4 animate-spin text-gray-400" />}
          {showOff && offResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-float overflow-hidden max-h-64 overflow-y-auto">
              <p className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">Suggestions d’Open Food Facts</p>
              {offResults.map((r, i) => (
                <button key={i} type="button" onMouseDown={() => selectOFF(r)}
                  className="flex items-center gap-3 w-full px-4 min-h-12 py-2 hover:bg-gray-50 transition-colors text-left">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="h-9 w-9 object-contain rounded-lg flex-shrink-0" />
                  ) : (
                    <span className="h-9 w-9 bg-gray-100 rounded-lg flex-shrink-0" />
                  )}
                  <span className="text-[15px] text-gray-900 truncate">{r.product_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {imageUrl && (
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="h-14 w-14 object-contain rounded-xl bg-white" />
            <p className="flex-1 min-w-0 text-sm text-gray-600 truncate">
              {!photoChanged && initial?.image_credit ? `Photo : ${initial.image_credit}` : 'Photo de l’ingrédient'}
            </p>
            <button type="button" onClick={() => { setImageUrl(''); setOffId(''); }} className={iconBtnDanger} aria-label="Retirer la photo"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ing-cat" className={labelCls}>Catégorie</label>
            <select id="ing-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={cn(inputCls, 'px-3')}>
              <option value="">Aucune</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ing-unit" className={labelCls}>Unité</label>
            <select id="ing-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={cn(inputCls, 'px-3')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ing-sub" className={labelCls}>Sous-catégorie (facultatif)</label>
          <input id="ing-sub" type="text" value={subCategory} onChange={(e) => setSubCategory(e.target.value)}
            placeholder="Volaille, Fromage, Champignons" className={inputCls} />
        </div>

        <div>
          <label htmlFor="ing-supplier" className={labelCls}>Fournisseur préféré</label>
          <select id="ing-supplier" value={preferredSupplierId} onChange={(e) => setPreferredSupplierId(e.target.value)} className={inputCls}>
            <option value="">Aucun</option>
            {suppliersList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <p className="text-sm text-gray-500 mt-2">Repris dans les listes de courses et les commandes.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ing-alert" className={labelCls}>Seuil d’alerte</label>
            <input id="ing-alert" type="number" inputMode="decimal" min={0} step={0.01} value={minStockAlert}
              onChange={(e) => setMinStockAlert(e.target.value)} placeholder="10" className={inputCls} />
            <p className="text-sm text-gray-500 mt-2">Stock bas à partir de ce seuil</p>
          </div>
          <div>
            <label htmlFor="ing-price" className={labelCls}>Prix unitaire</label>
            <input id="ing-price" type="number" inputMode="decimal" min={0} step={0.01} value={volumeUnitPrice}
              onChange={(e) => setVolumeUnitPrice(e.target.value)} placeholder="2,50" className={inputCls} />
            <p className="text-sm text-gray-500 mt-2">En euros, par {unit || 'unité'}</p>
          </div>
        </div>

        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </Modal>
  );
}

// ── Fournisseur (modifiable sur place) ────────────────────────────────────────
const smallInput = cn(inputCls, 'h-11');

function SupplierRow({
  supplier, onUpdate, onDelete,
}: {
  supplier: Supplier;
  onUpdate: (id: string, data: Partial<Supplier>) => Promise<boolean>;
  onDelete: (s: Supplier) => Promise<void>;
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
    const ok = await onUpdate(supplier.id, { name: name.trim(), email: email || null, phone: phone || null, notes: notes || null });
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <li className="flex items-center gap-1 pl-4 sm:pl-5 pr-2 py-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{supplier.name}</p>
          <p className="text-sm text-gray-500 truncate">{[supplier.phone, supplier.email].filter(Boolean).join(', ') || 'Aucune coordonnée'}</p>
        </div>
        <button onClick={() => setEditing(true)} className={iconBtn} aria-label={`Modifier ${supplier.name}`}><Pencil className="h-4 w-4" /></button>
        <button onClick={() => onDelete(supplier)} className={iconBtnDanger} aria-label={`Supprimer ${supplier.name}`}><Trash2 className="h-4 w-4" /></button>
      </li>
    );
  }

  return (
    <li className="px-4 sm:px-5 py-4 space-y-3 bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" aria-label="Nom du fournisseur" className={smallInput} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" type="email" className={smallInput} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" aria-label="Téléphone" type="tel" className={smallInput} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" className={smallInput} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className={btnGhost}>Annuler</button>
        <button onClick={save} disabled={!name.trim() || saving} className={btnPrimary}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
        </button>
      </div>
    </li>
  );
}

// ── Ligne d'un ingrédient ─────────────────────────────────────────────────────
function IngredientRow({ ing, onEdit, onDelete }: { ing: Ingredient; onEdit: () => void; onDelete: () => void }) {
  const mine = ing.user_id !== null;
  const meta = [ing.sub_category, ing.unit].filter(Boolean).join(', ');
  const content = (
    <>
      <span className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
        {ing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ing.image_url} alt="" loading="lazy" title={ing.image_credit ? `Photo : ${ing.image_credit}` : undefined}
            className={ing.image_credit ? 'h-full w-full object-cover' : 'h-full w-full object-contain p-1'} />
        ) : (
          <Carrot className="h-5 w-5 text-gray-400" />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 truncate">{ing.name}</span>
          {!mine && <span className={cn(pill, 'bg-gray-100 text-gray-600')}>Bibliothèque</span>}
        </span>
        {meta && <span className="block text-sm text-gray-500 truncate">{meta}</span>}
      </span>
      {ing.category && <span className="hidden lg:block w-40 text-sm text-gray-500 truncate">{ing.category}</span>}
    </>
  );
  return (
    <li className="flex items-center gap-1 pr-2">
      <div className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 pl-4 sm:pl-5 py-2.5">{content}</div>
      {mine && (
        <>
          <button onClick={onEdit} className={iconBtn} aria-label={`Modifier ${ing.name}`} title="Modifier"><Pencil className="h-4 w-4" /></button>
          <button onClick={onDelete} className={iconBtnDanger} aria-label={`Supprimer ${ing.name}`} title="Supprimer"><Trash2 className="h-4 w-4" /></button>
        </>
      )}
    </li>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function IngredientsPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers,   setSuppliers]   = useState<Supplier[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('Tous');
  const [modal,       setModal]       = useState<{ open: boolean; item: Partial<Ingredient> | null }>({ open: false, item: null });
  // Actions rapides du menu (lib/navMega.ts). Le sélecteur de fichier s'ouvre grâce au clic fait dans le menu.
  useUrlAction({
    nouveau: () => setModal({ open: true, item: null }),
    importer: () => fileInputRef.current?.click(),
  });
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
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState({ done: 0, total: 0, found: 0 });

  // ── Photos manquantes, cherchées sur Open Food Facts ────────────────────────
  const seedImages = async () => {
    if (!user) return;
    const missing = ingredients.filter((i) => !i.image_url && i.user_id === user.id);
    setNotice(null);
    if (missing.length === 0) { setNotice('Tous vos ingrédients ont déjà une photo.'); return; }
    setSeeding(true);
    setSeedProgress({ done: 0, total: missing.length, found: 0 });
    const supabase = createClient();
    let found = 0;

    for (let idx = 0; idx < missing.length; idx++) {
      const ing = missing[idx];
      try {
        const results = await searchOFF(ing.name);
        const withImg = results.find((r) => r.image_url);
        if (withImg?.image_url) {
          const { error: err } = await supabase.from('ingredients').update({ image_url: withImg.image_url }).eq('id', ing.id);
          if (!err) {
            setIngredients((prev) => prev.map((i) => i.id === ing.id ? { ...i, image_url: withImg.image_url! } : i));
            found++;
          }
        }
      } catch { /* on passe à l'ingrédient suivant */ }
      setSeedProgress({ done: idx + 1, total: missing.length, found });
      // Petite pause pour ne pas saturer Open Food Facts
      if (idx < missing.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setSeeding(false);
    setNotice(`${found} photo${found > 1 ? 's' : ''} trouvée${found > 1 ? 's' : ''} pour ${missing.length} ingrédient${missing.length > 1 ? 's' : ''} sans photo.`);
  };

  // ── Chargement ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const [ings, sups] = await Promise.all([
      supabase.from('ingredients').select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('category', { nullsFirst: false })
        .order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    if (ings.error || sups.error) setError('Vos ingrédients n’ont pas pu être chargés. Rechargez la page.');
    setIngredients((ings.data as Ingredient[]) ?? []);
    setSuppliers((sups.data as Supplier[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Ingrédients ─────────────────────────────────────────────────────────────
  const saveIngredient = async (data: Partial<Ingredient>): Promise<string | null> => {
    if (!user) return 'Votre session a expiré. Reconnectez-vous.';
    const supabase = createClient();
    if (modal.item?.id) {
      const { data: updated, error: err } = await supabase.from('ingredients').update(data).eq('id', modal.item.id).select().single();
      if (err || !updated) return 'L’ingrédient n’a pas pu être enregistré. Réessayez.';
      setIngredients((prev) => prev.map((i) => i.id === updated.id ? (updated as Ingredient) : i));
    } else {
      const { data: inserted, error: err } = await supabase.from('ingredients').insert([{ ...data, user_id: user.id }]).select().single();
      if (err || !inserted) return 'L’ingrédient n’a pas pu être ajouté. Réessayez.';
      setIngredients((prev) => [...prev, inserted as Ingredient]);
    }
    setModal({ open: false, item: null });
    return null;
  };

  const deleteIngredient = async (ing: Ingredient) => {
    if (!confirm(`Supprimer « ${ing.name} » ?`)) return;
    const { error: err } = await createClient().from('ingredients').delete().eq('id', ing.id);
    if (err) { setError('L’ingrédient n’a pas pu être supprimé. Il est peut-être utilisé dans une prestation ou une commande.'); return; }
    setError(null);
    setIngredients((prev) => prev.filter((i) => i.id !== ing.id));
  };

  // ── Import CSV ──────────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
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
      const { data: inserted, error: err } = await createClient().from('ingredients').insert(
        toInsert.map((r) => ({
          user_id: user.id,
          name: r.name,
          category: r.category || null,
          sub_category: r.sub_category || null,
          unit: r.unit || 'Unité',
        }))
      ).select();
      if (err) setError('L’import n’a pas pu être enregistré. Vérifiez le fichier, puis réessayez.');
      if (inserted) {
        setIngredients((prev) => [...prev, ...(inserted as Ingredient[])]);
        setNotice(`${inserted.length} ingrédient${inserted.length > 1 ? 's' : ''} importé${inserted.length > 1 ? 's' : ''}.`);
      }
    }
    setImporting(false);
    setShowCsvModal(false);
    setCsvRows([]);
  };

  // ── Fournisseurs ────────────────────────────────────────────────────────────
  const addSupplier = async () => {
    if (!user || !nsName.trim()) return;
    setNsSaving(true);
    const { data, error: err } = await createClient().from('suppliers').insert([{
      user_id: user.id, owner_user_id: user.id, name: nsName.trim(),
      email: nsEmail || null, phone: nsPhone || null, notes: nsNotes || null,
    }]).select().single();
    setNsSaving(false);
    if (err || !data) { setError('Le fournisseur n’a pas pu être ajouté. Réessayez.'); return; }
    setError(null);
    setSuppliers((prev) => [...prev, data as Supplier]);
    setNsName(''); setNsEmail(''); setNsPhone(''); setNsNotes('');
    setNewSupplier(false);
  };

  const updateSupplier = async (id: string, data: Partial<Supplier>) => {
    const { data: updated, error: err } = await createClient().from('suppliers').update(data).eq('id', id).select().single();
    if (err || !updated) { setError('Le fournisseur n’a pas pu être enregistré. Réessayez.'); return false; }
    setError(null);
    setSuppliers((prev) => prev.map((s) => s.id === id ? (updated as Supplier) : s));
    return true;
  };

  const deleteSupplier = async (s: Supplier) => {
    if (!confirm(`Supprimer le fournisseur « ${s.name} » ?`)) return;
    const { error: err } = await createClient().from('suppliers').delete().eq('id', s.id);
    if (err) { setError('Le fournisseur n’a pas pu être supprimé. Réessayez.'); return; }
    setError(null);
    setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
  };

  // ── Liste filtrée, rangée par catégorie ─────────────────────────────────────
  const filtered = ingredients.filter((i) => {
    const matchCat = catFilter === 'Tous' || i.category === catFilter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const groups = useMemo(() => {
    if (catFilter !== 'Tous' || search) return [{ label: '', items: filtered }];
    const byLabel = new Map<string, Ingredient[]>();
    for (const i of filtered) {
      const key = i.category || 'Sans catégorie';
      byLabel.set(key, [...(byLabel.get(key) ?? []), i]);
    }
    return [...byLabel.entries()]
      .sort(([a], [b]) => Number(a === 'Sans catégorie') - Number(b === 'Sans catégorie') || a.localeCompare(b, 'fr'))
      .map(([label, items]) => ({ label, items }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, catFilter, search]);

  const resetNewSupplier = () => { setNewSupplier(false); setNsName(''); setNsEmail(''); setNsPhone(''); setNsNotes(''); };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Ingrédients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? ' ' : `${ingredients.length} ingrédient${ingredients.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} className={cn(btnSecondary, 'flex-1 sm:flex-none whitespace-nowrap px-3.5')}
            title="Fichier à trois colonnes : catégorie, nom, unité" aria-label="Importer un CSV">
            <UploadCloud className="h-4 w-4" />
            <span className="sm:hidden">CSV</span><span className="hidden sm:inline">Importer un CSV</span>
          </button>
          <button onClick={seedImages} disabled={seeding} className={cn(btnSecondary, 'flex-1 sm:flex-none whitespace-nowrap px-3.5')}
            title="Cherche sur Open Food Facts une photo pour vos ingrédients qui n’en ont pas" aria-label="Trouver les photos">
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {seeding ? `${seedProgress.done} sur ${seedProgress.total}` : <><span className="sm:hidden">Photos</span><span className="hidden sm:inline">Trouver les photos</span></>}
          </button>
          <button onClick={() => setModal({ open: true, item: null })} className={cn(btnPrimary, 'w-full sm:w-auto order-first sm:order-none whitespace-nowrap px-4')}>
            <Plus className="h-4 w-4" />Nouvel ingrédient
          </button>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}
      {notice && <p role="status" className="text-sm text-sage bg-sage-100 rounded-xl px-4 py-3 mb-4">{notice}</p>}

      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un ingrédient"
          aria-label="Rechercher un ingrédient" className={cn(inputCls, 'pl-11')} />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 pb-1 mb-3" role="tablist" aria-label="Catégories">
        {['Tous', ...CATEGORIES].map((cat) => (
          <button key={cat} role="tab" aria-selected={catFilter === cat} onClick={() => setCatFilter(cat)}
            className={cn('flex-shrink-0 h-10 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              catFilter === cat ? 'bg-forest text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300')}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden mt-2')}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/5" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center mt-2')}>
          <p className="font-semibold text-gray-900 mb-1">
            {search ? `Aucun ingrédient ne correspond à « ${search} »` : catFilter !== 'Tous' ? 'Aucun ingrédient dans cette catégorie' : 'Aucun ingrédient pour le moment'}
          </p>
          <p className="text-sm text-gray-500 max-w-sm">
            {search || catFilter !== 'Tous' ? 'Essayez un autre mot ou une autre catégorie.' : 'Vos ingrédients servent aux prestations, aux listes de courses, au stock et aux commandes.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6 mt-2">
          {groups.map((g) => (
            <section key={g.label || 'liste'}>
              {g.label && (
                <h2 className="flex items-baseline gap-2 px-1 mb-2 text-[15px] font-semibold text-gray-900">
                  {g.label}<span className="text-sm font-normal text-gray-500">{g.items.length}</span>
                </h2>
              )}
              <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
                {g.items.map((ing) => (
                  <IngredientRow key={ing.id} ing={ing} onEdit={() => setModal({ open: true, item: ing })} onDelete={() => deleteIngredient(ing)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Fournisseurs, dépliables en bas de page */}
      <section className={cn(cardCls, 'overflow-hidden mt-8')}>
        <h2>
          <button onClick={() => setShowSuppliers((v) => !v)} aria-expanded={showSuppliers}
            className="flex items-center gap-2 w-full min-h-14 px-4 sm:px-5 text-left text-[15px] font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
            {showSuppliers ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
            Fournisseurs
            <span className="text-sm font-normal text-gray-500">{suppliers.length}</span>
          </button>
        </h2>

        {showSuppliers && (
          <div className="border-t border-gray-100">
            {suppliers.length === 0 && !newSupplier && (
              <p className="px-5 py-4 text-[15px] text-gray-600">Aucun fournisseur. Ajoutez-en un pour le relier à vos ingrédients.</p>
            )}
            {suppliers.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {suppliers.map((s) => (
                  <SupplierRow key={s.id} supplier={s} onUpdate={updateSupplier} onDelete={deleteSupplier} />
                ))}
              </ul>
            )}

            {newSupplier ? (
              <form onSubmit={(e) => { e.preventDefault(); addSupplier(); }} className="px-4 sm:px-5 py-4 space-y-3 border-t border-gray-100 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={nsName} onChange={(e) => setNsName(e.target.value)} placeholder="Nom du fournisseur" aria-label="Nom du fournisseur" className={smallInput} autoFocus />
                  <input value={nsEmail} onChange={(e) => setNsEmail(e.target.value)} placeholder="Email" aria-label="Email" type="email" className={smallInput} />
                  <input value={nsPhone} onChange={(e) => setNsPhone(e.target.value)} placeholder="Téléphone" aria-label="Téléphone" type="tel" className={smallInput} />
                  <input value={nsNotes} onChange={(e) => setNsNotes(e.target.value)} placeholder="Notes (facultatif)" aria-label="Notes" className={smallInput} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={resetNewSupplier} className={btnGhost}>Annuler</button>
                  <button type="submit" disabled={!nsName.trim() || nsSaving} className={btnPrimary}>
                    {nsSaving && <Loader2 className="h-4 w-4 animate-spin" />}Ajouter
                  </button>
                </div>
              </form>
            ) : (
              <div className="px-2 sm:px-3 py-2 border-t border-gray-100">
                <button onClick={() => setNewSupplier(true)} className={cn(btnGhost, 'text-primary-700')}>
                  <Plus className="h-4 w-4" />Ajouter un fournisseur
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {modal.open && (
        <IngredientModal
          initial={modal.item}
          onSave={saveIngredient}
          onClose={() => setModal({ open: false, item: null })}
        />
      )}

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
