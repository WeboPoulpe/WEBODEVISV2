'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckSquare, Package, ShoppingCart,
  Plus, Trash2, Printer, Loader2, ChevronUp, ChevronDown,
  UtensilsCrossed, Search, X, Smartphone, Users2,
  ChevronLeft, ChevronRight, Pencil, Check, ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { generateStaffHtml, type StaffMission } from '@/lib/generateStaffHtml';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ServiceLine {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  isPageBreak?: boolean;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface Quote {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string | null;
  event_location: string | null;
  guest_count: number | null;
  total_amount: number | null;
  status: string;
  services: ServiceLine[] | null;
  checklist: ChecklistItem[] | null;
}

interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  image_url: string | null;
  user_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface EventIngredient {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  supplier_id: string | null;
  checked: boolean;
  ingredient: Ingredient;
  supplier: Supplier | null;
}

interface Extra {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  access_token: string;
}

interface EventExtra {
  id: string;
  extra_id: string;
  status: 'a_solliciter' | 'confirme' | 'present';
  arrival_time: string | null;
  mission_notes: string | null;
  assign_courses: boolean;
  extra: Extra;
}

interface ServiceMaterial {
  id: string;
  service_name: string;
  material_name: string;
  qty_per_unit: number;
  multiply_by: 'guest' | 'service_qty';
  unit: string | null;
}

// ── Category helpers ──────────────────────────────────────────────────────────
const MATERIEL_KEYS = ['matériel', 'materiel', 'vaisselle', 'équipement', 'equipement', 'location', 'technique'];
const PERSONNEL_KEYS = ['personnel', 'service', 'staff', 'extra', 'cuisinier', 'serveur'];
const GASTRO_KEYS = [
  'apéritif', 'cocktail', 'mise en bouche', 'entrée', 'plat',
  'fromage', 'dessert', 'mignardise', 'boissons', 'vins', 'bar', 'gastronomie',
];

function isMateriel(cat?: string): boolean {
  if (!cat) return false;
  return MATERIEL_KEYS.some((k) => cat.toLowerCase().includes(k));
}

function isPersonnel(cat?: string): boolean {
  if (!cat) return false;
  return PERSONNEL_KEYS.some((k) => cat.toLowerCase().includes(k));
}

function isGastro(cat?: string): boolean {
  if (!cat) return true;
  return GASTRO_KEYS.some((k) => cat.toLowerCase().includes(k)) || (!isMateriel(cat) && !isPersonnel(cat));
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
type Tab = 'checklist' | 'materiel' | 'courses' | 'achats' | 'staffing';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'checklist', label: 'Checklist',       icon: <CheckSquare className="h-4 w-4" />    },
  { key: 'materiel',  label: 'Matériel',         icon: <Package className="h-4 w-4" />        },
  { key: 'courses',   label: 'Courses',          icon: <ShoppingCart className="h-4 w-4" />   },
  { key: 'achats',    label: 'Prépa & Achats',   icon: <UtensilsCrossed className="h-4 w-4" /> },
  { key: 'staffing',  label: 'Staffing',         icon: <Users2 className="h-4 w-4" />         },
];

// ── Checklist tab ─────────────────────────────────────────────────────────────
function ChecklistTab({ quote, onUpdate }: { quote: Quote; onUpdate: (items: ChecklistItem[]) => void }) {
  const [items, setItems] = useState<ChecklistItem[]>(quote.checklist ?? []);
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (next: ChecklistItem[]) => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from('quotes').update({ checklist: next }).eq('id', quote.id);
    setSaving(false);
    onUpdate(next);
  }, [quote.id, onUpdate]);

  const toggle = (id: string) => {
    const next = items.map((i) => i.id === id ? { ...i, done: !i.done } : i);
    setItems(next);
    save(next);
  };

  const add = () => {
    const text = newText.trim();
    if (!text) return;
    const next = [...items, { id: crypto.randomUUID(), text, done: false }];
    setItems(next);
    setNewText('');
    save(next);
  };

  const remove = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    save(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    save(next);
  };

  const done = items.filter((i) => i.done).length;
  const pct  = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{done}/{items.length} tâche{items.length > 1 ? 's' : ''} complétée{done > 1 ? 's' : ''}</span>
            <span className="font-medium text-[#9c27b0]">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-2 bg-[#9c27b0] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-4">Aucune tâche — ajoutez-en ci-dessous</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 group">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
              />
              <span className={['flex-1 text-sm', item.done ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                {item.text}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(item.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Nouvelle tâche…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
        />
        <button
          onClick={add}
          disabled={!newText.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {saving && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde…</p>}
    </div>
  );
}

// ── Matériel tab ──────────────────────────────────────────────────────────────
function MaterielTab({ quote }: { quote: Quote }) {
  const { user } = useAuth();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<ServiceMaterial[]>([]);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('service_materials')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => setTemplates((data ?? []) as ServiceMaterial[]));
  }, [user]);

  const services = (quote.services ?? []).filter((s) => !s.isPageBreak);
  const materiel  = services.filter((s) => isMateriel(s.category));
  const personnel = services.filter((s) => isPersonnel(s.category));

  // Computed materials from templates
  const computed = useMemo(() => {
    const result: { key: string; name: string; qty: number; unit: string | null }[] = [];
    for (const tmpl of templates) {
      for (const svc of services) {
        if (svc.name.toLowerCase().includes(tmpl.service_name.toLowerCase())) {
          const qty = tmpl.multiply_by === 'guest'
            ? tmpl.qty_per_unit * (quote.guest_count ?? 1)
            : tmpl.qty_per_unit * svc.quantity;
          const key = `${tmpl.id}-${svc.id}`;
          const existing = result.find((r) => r.name === tmpl.material_name);
          if (existing) {
            existing.qty += qty;
          } else {
            result.push({ key, name: tmpl.material_name, qty: Math.ceil(qty), unit: tmpl.unit });
          }
        }
      }
    }
    return result;
  }, [templates, services, quote.guest_count]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const Section = ({ title, items }: { title: string; items: ServiceLine[] }) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
      <div className="space-y-1.5">
        {items.map((s) => (
          <div key={s.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
            <input
              type="checkbox"
              checked={checked.has(s.id)}
              onChange={() => toggle(s.id)}
              className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className={['text-sm font-medium leading-snug', checked.has(s.id) ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                {s.name}
              </p>
              {s.description && <p className="text-xs text-gray-400 italic truncate">{s.description}</p>}
            </div>
            <span className="text-sm font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-purple-50 px-2 py-0.5 rounded-lg">
              ×{s.quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const isEmpty = materiel.length === 0 && personnel.length === 0 && computed.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-400">Cochez les éléments disponibles. Ces données ne sont pas sauvegardées.</p>

      {isEmpty && (
        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun matériel détecté.</p>
          <p className="text-xs text-gray-400 mt-1">
            Catégorisez vos prestations avec &quot;matériel&quot; ou configurez les templates dans{' '}
            <Link href="/prestations" className="text-[#9c27b0] hover:underline">Prestations</Link>.
          </p>
        </div>
      )}

      {/* Computed materials from templates */}
      {computed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Matériel calculé automatiquement</p>
          <div className="space-y-1.5">
            {computed.map((item) => (
              <div key={item.key} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
                <input
                  type="checkbox"
                  checked={checked.has(item.key)}
                  onChange={() => toggle(item.key)}
                  className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
                />
                <p className={['flex-1 text-sm font-medium', checked.has(item.key) ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                  {item.name}
                </p>
                <span className="text-sm font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-purple-50 px-2 py-0.5 rounded-lg">
                  {item.qty} {item.unit ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {materiel.length > 0  && <Section title="Matériel & Vaisselle" items={materiel}  />}
      {personnel.length > 0 && <Section title="Personnel & Service" items={personnel} />}
    </div>
  );
}

// ── Liste de courses tab ───────────────────────────────────────────────────────
function CoursesTab({ quote }: { quote: Quote }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const services = (quote.services ?? []).filter((s) => !s.isPageBreak);
  const gastro = services.filter((s) => isGastro(s.category));

  const groups = new Map<string, ServiceLine[]>();
  for (const s of gastro) {
    const key = s.category?.trim() || 'Divers';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  if (gastro.length === 0) {
    return (
      <div className="text-center py-8">
        <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Aucune prestation culinaire trouvée.</p>
      </div>
    );
  }

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Cochez les ingrédients ou fournitures déjà préparés.</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimer
        </button>
      </div>

      {Array.from(groups.entries()).map(([cat, items]) => (
        <div key={cat} className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{cat}</p>
          {items.map((s) => (
            <div key={s.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
              <input
                type="checkbox"
                checked={checked.has(s.id)}
                onChange={() => toggle(s.id)}
                className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
              />
              <span className={['flex-1 text-sm font-medium', checked.has(s.id) ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                {s.name}
              </span>
              <span className="text-sm font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-purple-50 px-2 py-0.5 rounded-lg">
                ×{s.quantity}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Préparation & Achats tab ──────────────────────────────────────────────────
function AchatsTab({ quoteId }: { quoteId: string }) {
  const [items, setItems]           = useState<EventIngredient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [bonOpen, setBonOpen]       = useState(false);

  const [search, setSearch]         = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [selected, setSelected]     = useState<Ingredient | null>(null);
  const [qty, setQty]               = useState('1');
  const [unit, setUnit]             = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('event_ingredients')
      .select('*, ingredient:ingredients(*), supplier:suppliers(id, name)')
      .eq('quote_id', quoteId)
      .order('created_at');
    setItems((data ?? []) as EventIngredient[]);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showAdd) return;
    createClient().from('suppliers').select('id, name').order('name')
      .then(({ data }) => setSuppliers(data ?? []));
  }, [showAdd]);

  useEffect(() => {
    if (!showAdd) return;
    const t = setTimeout(async () => {
      const supabase = createClient();
      let q = supabase.from('ingredients').select('id, name, category, unit, image_url, user_id').order('name');
      if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
      const { data } = await q.limit(20);
      setIngredients((data ?? []) as Ingredient[]);
    }, 200);
    return () => clearTimeout(t);
  }, [search, showAdd]);

  const closeModal = () => {
    setShowAdd(false);
    setSelected(null);
    setSearch('');
    setQty('1');
    setUnit('');
    setSupplierId('');
    setNotes('');
  };

  const addItem = async () => {
    if (!selected) return;
    setSaving(true);
    const supabase = createClient();
    const { data: newItem } = await supabase
      .from('event_ingredients')
      .insert({
        quote_id: quoteId,
        ingredient_id: selected.id,
        quantity: parseFloat(qty) || 1,
        unit: unit || selected.unit || null,
        supplier_id: supplierId || null,
        notes: notes.trim() || null,
      })
      .select('*, ingredient:ingredients(*), supplier:suppliers(id, name)')
      .single();
    if (newItem) setItems((p) => [...p, newItem as EventIngredient]);
    setSaving(false);
    closeModal();
  };

  const removeItem = async (id: string) => {
    await createClient().from('event_ingredients').delete().eq('id', id);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  const grouped = useMemo(() =>
    items.reduce<Record<string, EventIngredient[]>>((acc, item) => {
      const key = item.supplier?.name ?? 'Sans fournisseur';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {}),
  [items]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#9c27b0]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{items.length} ingrédient{items.length !== 1 ? 's' : ''} ajouté{items.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <Link
            href={`/evenements/${quoteId}/courses`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9c27b0] border border-[#9c27b0]/30 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mode courses
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#9c27b0] text-white rounded-lg hover:bg-[#7b1fa2] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8">
          <UtensilsCrossed className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun ingrédient ajouté pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
              {item.ingredient.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.ingredient.image_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="h-4 w-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{item.ingredient.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-[#9c27b0] font-semibold">{item.quantity} {item.unit ?? item.ingredient.unit ?? ''}</span>
                  {item.supplier && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{item.supplier.name}</span>}
                </div>
                {item.notes && <p className="text-xs text-gray-400 italic mt-0.5">{item.notes}</p>}
              </div>
              <button onClick={() => removeItem(item.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setBonOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Bon de commande</span>
            </div>
            {bonOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {bonOpen && (
            <div className="p-4 space-y-4">
              {Object.entries(grouped).map(([supplierName, its]) => (
                <div key={supplierName}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">{supplierName}</p>
                  <div className="space-y-1.5">
                    {its.map((it) => (
                      <div key={it.id} className="flex items-center gap-2 text-sm text-gray-800">
                        <span className="flex-1">{it.ingredient.name}</span>
                        <span className="font-semibold text-[#9c27b0]">{it.quantity} {it.unit ?? it.ingredient.unit ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => window.print()} className="mt-2 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden">
                <Printer className="h-4 w-4" />
                Imprimer le bon
              </button>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Ajouter un ingrédient</h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {!selected ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un ingrédient…"
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {ingredients.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">{search.trim() ? 'Aucun résultat' : 'Saisissez un nom pour rechercher'}</p>
                    ) : (
                      ingredients.map((ing) => (
                        <button
                          key={ing.id}
                          onClick={() => { setSelected(ing); setUnit(ing.unit ?? 'Unité'); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-purple-50 text-left transition-colors"
                        >
                          {ing.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ing.image_url} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <UtensilsCrossed className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{ing.name}</p>
                            {ing.category && <p className="text-xs text-gray-400">{ing.category}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                    {selected.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.image_url} alt="" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-white border border-purple-100 flex items-center justify-center flex-shrink-0">
                        <UtensilsCrossed className="h-4 w-4 text-[#9c27b0]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#9c27b0]">{selected.name}</p>
                      {selected.category && <p className="text-xs text-gray-500">{selected.category}</p>}
                    </div>
                    <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantité</label>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        min="0"
                        step="0.1"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Unité</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="kg, L, pièce…"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fournisseur</label>
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white"
                    >
                      <option value="">— Aucun fournisseur —</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Instructions particulières…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-5 flex-shrink-0">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
              {selected && (
                <button
                  onClick={addItem}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Ajouter
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staffing tab ───────────────────────────────────────────────────────────────
const PIPELINE_STATUSES: { key: EventExtra['status']; label: string; color: string }[] = [
  { key: 'a_solliciter', label: 'À solliciter', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'confirme',     label: 'Confirmé',     color: 'bg-blue-50 border-blue-200 text-blue-700'   },
  { key: 'present',      label: 'Présent',      color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
];

function StaffingTab({ quoteId, quote }: { quoteId: string; quote: Quote }) {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<EventExtra[]>([]);
  const [allExtras, setAllExtras]     = useState<Extra[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [savingId, setSavingId]       = useState<string | null>(null);

  // Add modal state
  const [selExtra, setSelExtra]       = useState('');
  const [arrTime, setArrTime]         = useState('');
  const [missionNotes, setMissionNotes] = useState('');
  const [assignCourses, setAssignCourses] = useState(false);
  const [addSaving, setAddSaving]     = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('event_extras')
      .select('*, extra:extras(*)')
      .eq('quote_id', quoteId)
      .order('created_at');
    setAssignments((data ?? []) as EventExtra[]);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('extras')
      .select('id, name, phone, email, role, access_token')
      .eq('user_id', user.id)
      .order('name')
      .then(({ data }) => setAllExtras((data ?? []) as Extra[]));
  }, [user]);

  const changeStatus = async (id: string, status: EventExtra['status']) => {
    setSavingId(id);
    await createClient().from('event_extras').update({ status }).eq('id', id);
    setAssignments((p) => p.map((a) => a.id === id ? { ...a, status } : a));
    setSavingId(null);
  };

  const saveNotes = async (id: string, notes: string) => {
    setSavingId(id);
    await createClient().from('event_extras').update({ mission_notes: notes || null }).eq('id', id);
    setAssignments((p) => p.map((a) => a.id === id ? { ...a, mission_notes: notes || null } : a));
    setSavingId(null);
    setEditingNotes(null);
  };

  const removeAssignment = async (id: string) => {
    if (!confirm('Retirer cet extra ?')) return;
    await createClient().from('event_extras').delete().eq('id', id);
    setAssignments((p) => p.filter((a) => a.id !== id));
  };

  const addAssignment = async () => {
    if (!selExtra) return;
    setAddSaving(true);
    const { data } = await createClient()
      .from('event_extras')
      .insert({
        quote_id: quoteId,
        extra_id: selExtra,
        arrival_time: arrTime || null,
        mission_notes: missionNotes.trim() || null,
        assign_courses: assignCourses,
      })
      .select('*, extra:extras(*)')
      .single();
    if (data) setAssignments((p) => [...p, data as EventExtra]);
    setAddSaving(false);
    setShowAdd(false);
    setSelExtra('');
    setArrTime('');
    setMissionNotes('');
    setAssignCourses(false);
  };

  const printStaff = () => {
    const missions: StaffMission[] = assignments.map((a) => ({
      extraName:    a.extra.name,
      role:         a.extra.role,
      phone:        a.extra.phone,
      email:        a.extra.email,
      eventType:    quote.event_type,
      clientName:   quote.client_name,
      eventDate:    quote.event_date,
      eventLocation: quote.event_location,
      arrivalTime:  a.arrival_time,
      missionNotes: a.mission_notes,
    }));
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiches Mission</title><style>@page{size:A4;margin:0;}body{margin:0;padding:0;font-family:Georgia,serif;}#wrapper{padding:20mm;}</style></head><body><div id="wrapper">${generateStaffHtml(missions)}</div></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const alreadyAssigned = new Set(assignments.map((a) => a.extra_id));
  const available = allExtras.filter((e) => !alreadyAssigned.has(e.id));

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#9c27b0]" /></div>;

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{assignments.length} extra{assignments.length !== 1 ? 's' : ''} assigné{assignments.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          {assignments.length > 0 && (
            <button
              onClick={printStaff}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimer fiches
            </button>
          )}
          <Link
            href="/extras"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Gérer les extras
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            disabled={available.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#9c27b0] text-white rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Assigner
          </button>
        </div>
      </div>

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Users2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun extra assigné à cet événement.</p>
          {allExtras.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              <Link href="/extras" className="text-[#9c27b0] hover:underline">Créer des extras</Link> d&apos;abord.
            </p>
          )}
        </div>
      )}

      {/* Pipeline columns */}
      {assignments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PIPELINE_STATUSES.map((col, colIdx) => {
            const colItems = assignments.filter((a) => a.status === col.key);
            return (
              <div key={col.key} className={['rounded-xl border p-3 space-y-2', col.color].join(' ')}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest">{col.label}</p>
                  <span className="text-xs font-semibold bg-white/60 px-1.5 py-0.5 rounded-full">{colItems.length}</span>
                </div>

                {colItems.map((a) => (
                  <div key={a.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#7b1fa2] to-[#ab47bc] flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">
                            {a.extra.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{a.extra.name}</p>
                          {a.extra.role && <p className="text-[10px] text-gray-400">{a.extra.role}</p>}
                        </div>
                      </div>
                      <button onClick={() => removeAssignment(a.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    {a.arrival_time && (
                      <p className="text-[10px] text-gray-500">⏰ Arrivée : <span className="font-semibold">{a.arrival_time}</span></p>
                    )}

                    {/* Notes inline */}
                    {editingNotes === a.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          defaultValue={a.mission_notes ?? ''}
                          id={`notes-${a.id}`}
                          rows={3}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#9c27b0]/30"
                          placeholder="Notes de mission…"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              const el = document.getElementById(`notes-${a.id}`) as HTMLTextAreaElement;
                              saveNotes(a.id, el.value);
                            }}
                            disabled={savingId === a.id}
                            className="flex items-center gap-1 px-2 py-1 bg-[#9c27b0] text-white text-[10px] font-medium rounded-lg"
                          >
                            {savingId === a.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                            Sauvegarder
                          </button>
                          <button onClick={() => setEditingNotes(null)} className="px-2 py-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingNotes(a.id)}
                        className="w-full text-left text-[10px] text-gray-400 hover:text-[#9c27b0] flex items-center gap-1 transition-colors"
                      >
                        <Pencil className="h-2.5 w-2.5 flex-shrink-0" />
                        {a.mission_notes ? <span className="truncate italic">{a.mission_notes}</span> : 'Ajouter des notes…'}
                      </button>
                    )}

                    {/* Status nav arrows */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                      <button
                        onClick={() => changeStatus(a.id, PIPELINE_STATUSES[colIdx - 1].key)}
                        disabled={colIdx === 0 || savingId === a.id}
                        className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[10px] text-gray-400 font-medium">{col.label}</span>
                      <button
                        onClick={() => changeStatus(a.id, PIPELINE_STATUSES[colIdx + 1].key)}
                        disabled={colIdx === PIPELINE_STATUSES.length - 1 || savingId === a.id}
                        className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Assigner un extra</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Extra *</label>
                <select
                  value={selExtra}
                  onChange={(e) => setSelExtra(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white"
                >
                  <option value="">— Sélectionner —</option>
                  {available.map((e) => <option key={e.id} value={e.id}>{e.name}{e.role ? ` (${e.role})` : ''}</option>)}
                </select>
                {available.length === 0 && <p className="text-xs text-gray-400 mt-1">Tous vos extras sont déjà assignés.</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Heure d&apos;arrivée</label>
                <input
                  type="time"
                  value={arrTime}
                  onChange={(e) => setArrTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes de mission</label>
                <textarea
                  value={missionNotes}
                  onChange={(e) => setMissionNotes(e.target.value)}
                  rows={3}
                  placeholder="Arrivée 17h, tenue noire exigée…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignCourses}
                  onChange={(e) => setAssignCourses(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#9c27b0]"
                />
                <span className="text-sm text-gray-700">Assigner la mission de courses</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Annuler</button>
              <button
                onClick={addAssignment}
                disabled={!selExtra || addSaving}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
              >
                {addSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Assigner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EvenementPage() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote]     = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('checklist');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('quotes')
      .select('id, client_name, event_type, event_date, event_location, guest_count, total_amount, status, services, checklist')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setQuote(data as Quote | null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
      </div>
    );
  }

  if (!quote) {
    notFound();
    return null;
  }

  const displayDate = mounted && quote.event_date
    ? new Date(quote.event_date + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">

      {/* ── Back + header ─────────────────────────────────────────────────── */}
      <div>
        <Link href="/calendrier" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Retour au calendrier
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{quote.client_name || 'Événement'}</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{quote.event_type}</p>
            {displayDate && <p className="text-sm text-[#9c27b0] font-medium mt-0.5">{displayDate}</p>}
            {quote.event_location && <p className="text-xs text-gray-400 mt-0.5">📍 {quote.event_location}</p>}
            {quote.guest_count && (
              <p className="text-xs text-gray-400 mt-0.5">{quote.guest_count} couvert{quote.guest_count > 1 ? 's' : ''}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {quote.total_amount != null && (
              <p className="text-lg font-bold text-[#9c27b0]">{formatCurrency(quote.total_amount)}</p>
            )}
            <Link href={`/devis/${quote.id}/modifier`} className="text-xs text-gray-400 hover:text-[#9c27b0] hover:underline transition-colors">
              Voir le devis
            </Link>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex bg-gray-100 p-1 rounded-xl gap-1 overflow-x-auto">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex-shrink-0 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all',
              tab === key ? 'bg-white text-[#9c27b0] shadow-sm' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div>
        {tab === 'checklist' && (
          <ChecklistTab
            quote={quote}
            onUpdate={(items) => setQuote((q) => q ? { ...q, checklist: items } : q)}
          />
        )}
        {tab === 'materiel'  && <MaterielTab quote={quote} />}
        {tab === 'courses'   && <CoursesTab  quote={quote} />}
        {tab === 'achats'    && <AchatsTab   quoteId={id!} />}
        {tab === 'staffing'  && <StaffingTab quoteId={id!} quote={quote} />}
      </div>
    </div>
  );
}
