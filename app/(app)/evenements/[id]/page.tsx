'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckSquare, Package, ShoppingCart,
  Plus, Trash2, Printer, Loader2, ChevronUp, ChevronDown,
  UtensilsCrossed, Search, X, Smartphone, Users2,
  ChevronLeft, ChevronRight, Pencil, Check, ExternalLink, Wand2,
  MapPin, Users, Calendar, CreditCard, Eye, CheckCircle2, Wallet,
} from 'lucide-react';
import FinanceSheet from '@/components/devis/FinanceSheet';
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
  event_materials: MaterialItem[] | null;
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

interface MaterialItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

interface RentalItem {
  id: string;
  quote_id: string;
  material_name: string;
  qty: number;
  unit: string | null;
  supplier_id: string | null;
  price_per_unit: number;
  notes: string | null;
  supplier: Supplier | null;
  source?: string | null;
  ordered?: boolean;
  confirmed_individually?: boolean;
}

interface RentalTemplate {
  id: string;
  material_name: string;
  qty_per_guest: number;
  unit: string | null;
  default_supplier_id: string | null;
  default_price_per_unit: number;
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
  { key: 'staffing',  label: 'Extras',           icon: <Users2 className="h-4 w-4" />         },
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
    <div className="space-y-5">
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{done}/{items.length} tâche{items.length > 1 ? 's' : ''}</span>
            <span className="font-bold text-[#9c27b0]">{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #9c27b0, #e040fb)' }}
            />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-50 flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="h-6 w-6 text-[#9c27b0]" />
          </div>
          <p className="text-sm font-medium text-gray-500">Aucune tâche</p>
          <p className="text-xs text-gray-400 mt-1">Ajoutez votre première tâche ci-dessous</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={[
                'flex items-center gap-3 rounded-xl px-4 py-3 group transition-all duration-200 border',
                item.done
                  ? 'bg-emerald-50/50 border-emerald-200/50'
                  : 'bg-white border-gray-100 hover:border-purple-200/60 hover:shadow-sm',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item.id)}
                className="h-4.5 w-4.5 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
              />
              <span className={['flex-1 text-sm font-medium', item.done ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                {item.text}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 rounded-lg hover:bg-gray-100 transition-all">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="p-1.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 rounded-lg hover:bg-gray-100 transition-all">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
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
          placeholder="Ajouter une tâche…"
          className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] focus:bg-white transition-all"
        />
        <button
          onClick={add}
          disabled={!newText.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] text-white text-sm font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-200/50 disabled:opacity-40 transition-all duration-200"
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
interface CatalogPrestation { id: string; name: string; category: string | null; sub_category: string | null; }

function MaterielTab({ quote, onUpdate }: { quote: Quote; onUpdate: (mats: MaterialItem[]) => void }) {
  const { user } = useAuth();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<ServiceMaterial[]>([]);
  const [customItems, setCustomItems] = useState<MaterialItem[]>(quote.event_materials ?? []);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty]   = useState('1');
  const [newUnit, setNewUnit] = useState('');
  const [saving, setSaving]   = useState(false);
  const [showCatalog, setShowCatalog]   = useState(false);
  const [catalog, setCatalog]           = useState<CatalogPrestation[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');

  // ── Rental items state ─────────────────────────────────────────────────────
  const [rentalItems, setRentalItems] = useState<RentalItem[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [rentalTemplates, setRentalTemplates] = useState<RentalTemplate[]>([]);
  const [showRentalForm, setShowRentalForm] = useState(false);
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null);
  const [rName, setRName]       = useState('');
  const [rQty, setRQty]         = useState('1');
  const [rUnit, setRUnit]       = useState('');
  const [rSupplierId, setRSupplierId] = useState('');
  const [rPrice, setRPrice]     = useState('0');
  const [rNotes, setRNotes]     = useState('');
  const [savingRental, setSavingRental] = useState(false);
  const [generatingRentals, setGeneratingRentals] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from('service_materials').select('*').eq('user_id', user.id)
      .then(({ data }) => setTemplates((data ?? []) as ServiceMaterial[]));
    supabase.from('prestations').select('id, name, category, sub_category').eq('user_id', user.id).order('name')
      .then(({ data }) => setCatalog((data ?? []) as CatalogPrestation[]));
    supabase.from('rental_templates').select('*').eq('user_id', user.id).order('sort_order')
      .then(({ data }) => setRentalTemplates((data ?? []) as RentalTemplate[]));
  }, [user]);

  const saveCustom = useCallback(async (items: MaterialItem[]) => {
    setSaving(true);
    await createClient().from('quotes').update({ event_materials: items }).eq('id', quote.id);
    setSaving(false);
    onUpdate(items);
  }, [quote.id, onUpdate]);

  // Load rental items + suppliers
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('rental_items')
      .select('*, supplier:suppliers(id, name)')
      .eq('quote_id', quote.id)
      .then(({ data }) => setRentalItems((data ?? []) as RentalItem[]));
    supabase.from('suppliers').select('id, name').order('name')
      .then(({ data }) => setSuppliers(data ?? []));
  }, [quote.id]);

  const resetRentalForm = () => {
    setRName(''); setRQty('1'); setRUnit(''); setRSupplierId(''); setRPrice('0'); setRNotes('');
    setShowRentalForm(false);
    setEditingRentalId(null);
  };

  const startEditRental = (r: RentalItem) => {
    setEditingRentalId(r.id);
    setRName(r.material_name);
    setRQty(String(r.qty));
    setRUnit(r.unit ?? '');
    setRSupplierId(r.supplier_id ?? '');
    setRPrice(String(r.price_per_unit));
    setRNotes(r.notes ?? '');
    setShowRentalForm(true);
  };

  const saveRental = async () => {
    const name = rName.trim();
    if (!name) return;
    setSavingRental(true);
    const payload = {
      material_name: name,
      qty: parseFloat(rQty) || 1,
      unit: rUnit.trim() || null,
      supplier_id: rSupplierId || null,
      price_per_unit: parseFloat(rPrice) || 0,
      notes: rNotes.trim() || null,
    };
    if (editingRentalId) {
      const { data: updated } = await createClient()
        .from('rental_items')
        .update(payload)
        .eq('id', editingRentalId)
        .select('*, supplier:suppliers(id, name)')
        .single();
      if (updated) setRentalItems((p) => p.map((r) => r.id === editingRentalId ? updated as RentalItem : r));
    } else {
      const { data: newItem } = await createClient()
        .from('rental_items')
        .insert({ ...payload, quote_id: quote.id, source: 'manual' })
        .select('*, supplier:suppliers(id, name)')
        .single();
      if (newItem) setRentalItems((p) => [...p, newItem as RentalItem]);
    }
    resetRentalForm();
    setSavingRental(false);
  };

  const removeRental = async (id: string) => {
    await createClient().from('rental_items').delete().eq('id', id);
    setRentalItems((p) => p.filter((r) => r.id !== id));
  };

  const toggleOrdered = async (id: string, ordered: boolean) => {
    await createClient().from('rental_items').update({ ordered }).eq('id', id);
    setRentalItems((p) => p.map((r) => r.id === id ? { ...r, ordered } : r));
  };

  const toggleConfirmedIndividually = async (id: string, confirmed: boolean) => {
    await createClient().from('rental_items').update({
      confirmed_individually: confirmed,
      confirmed_at: confirmed ? new Date().toISOString() : null,
    }).eq('id', id);
    setRentalItems((p) => p.map((r) => r.id === id ? { ...r, confirmed_individually: confirmed } : r));
  };

  const generateFromTemplates = async () => {
    if (rentalTemplates.length === 0) return;
    const guestCount = quote.guest_count ?? 1;
    if (!confirm(`Générer la vaisselle pour ${guestCount} convive${guestCount > 1 ? 's' : ''} depuis vos ${rentalTemplates.length} template${rentalTemplates.length > 1 ? 's' : ''} ?\nLes articles auto-générés précédents seront remplacés.`)) return;
    setGeneratingRentals(true);
    const supabase = createClient();
    // Delete previously auto-generated items
    const autoIds = rentalItems.filter((r) => r.source === 'template').map((r) => r.id);
    if (autoIds.length > 0) {
      await supabase.from('rental_items').delete().in('id', autoIds);
    }
    // Insert from templates
    const toInsert = rentalTemplates.map((t) => ({
      quote_id: quote.id,
      material_name: t.material_name,
      qty: Math.ceil(t.qty_per_guest * guestCount),
      unit: t.unit,
      supplier_id: t.default_supplier_id,
      price_per_unit: t.default_price_per_unit,
      source: 'template',
    }));
    await supabase.from('rental_items').insert(toInsert);
    // Reload all
    const { data } = await supabase
      .from('rental_items')
      .select('*, supplier:suppliers(id, name)')
      .eq('quote_id', quote.id);
    setRentalItems((data ?? []) as RentalItem[]);
    setGeneratingRentals(false);
  };

  const printBonCommande = () => {
    if (rentalItems.length === 0) return;
    const grouped: Record<string, RentalItem[]> = {};
    for (const r of rentalItems) {
      const key = r.supplier?.name ?? 'Sans fournisseur';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
    const today = new Date().toLocaleDateString('fr-FR');
    const rows = Object.entries(grouped).map(([sup, items]) => {
      const total = items.reduce((s, i) => s + i.qty * i.price_per_unit, 0);
      return `
        <h3 style="color:#9c27b0;margin:18px 0 6px;font-size:14px;border-bottom:1px solid #e9d5ff;padding-bottom:4px;">${sup}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3e5f5;">
            <th style="text-align:left;padding:6px 8px;">Article</th>
            <th style="text-align:center;padding:6px 8px;width:60px;">Qté</th>
            <th style="text-align:right;padding:6px 8px;width:80px;">PU</th>
            <th style="text-align:right;padding:6px 8px;width:90px;">Total</th>
          </tr></thead>
          <tbody>${items.map((i) => `
            <tr style="border-bottom:1px solid #f3e5f5;">
              <td style="padding:6px 8px;">${i.material_name}${i.notes ? `<br><span style="color:#aaa;font-size:11px;font-style:italic;">${i.notes}</span>` : ''}</td>
              <td style="text-align:center;padding:6px 8px;">${i.qty}${i.unit ? ` ${i.unit}` : ''}</td>
              <td style="text-align:right;padding:6px 8px;">${money(i.price_per_unit)}</td>
              <td style="text-align:right;padding:6px 8px;font-weight:bold;">${money(i.qty * i.price_per_unit)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="3" style="text-align:right;padding:6px 8px;font-weight:bold;font-size:12px;">Total ${sup}</td>
            <td style="text-align:right;padding:6px 8px;font-weight:bold;color:#9c27b0;">${money(total)}</td>
          </tr></tfoot>
        </table>`;
    }).join('');
    const grandTotal = rentalItems.reduce((s, r) => s + r.qty * r.price_per_unit, 0);
    const htmlStr = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bon de Commande Location</title>
      <style>@page{size:A4;margin:20mm}html,body{color-scheme:light}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{font-family:Georgia,serif;color:#1a1a1a;margin:0;background:#fff;}</style></head>
      <body><h1 style="color:#9c27b0;font-size:18px;margin:0 0 4px;">Bon de Commande — Location de Matériel</h1>
      <p style="color:#888;font-size:11px;margin:0 0 20px;">Événement : ${quote.event_type ?? ''} — ${today}</p>
      ${rows}
      <p style="margin-top:20px;text-align:right;font-size:14px;font-weight:bold;color:#9c27b0;">
        Total général : ${money(grandTotal)}</p>
      </body></html>`;
    const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 600); };
  };

  const addCustom = () => {
    const name = newName.trim();
    if (!name) return;
    const next = [...customItems, { id: crypto.randomUUID(), name, qty: parseFloat(newQty) || 1, unit: newUnit.trim() }];
    setCustomItems(next);
    setNewName('');
    setNewQty('1');
    setNewUnit('');
    saveCustom(next);
  };

  const removeCustom = (id: string) => {
    const next = customItems.filter((i) => i.id !== id);
    setCustomItems(next);
    saveCustom(next);
  };

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
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
        <span className="h-px flex-1 bg-gray-200" />
        {title}
        <span className="h-px flex-1 bg-gray-200" />
      </h3>
      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className={[
            'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 border',
            checked.has(s.id)
              ? 'bg-emerald-50/50 border-emerald-200/50'
              : 'bg-white border-gray-100 hover:border-purple-200/60 hover:shadow-sm',
          ].join(' ')}>
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
            <span className="text-xs font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 rounded-lg border border-purple-100/50">
              x{s.quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const isEmpty = materiel.length === 0 && computed.length === 0 && customItems.length === 0;
  const filteredCatalog = catalog.filter((p) =>
    !catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );
  const addFromCatalog = (p: CatalogPrestation) => {
    const next = [...customItems, { id: crypto.randomUUID(), name: p.name, qty: 1, unit: '' }];
    setCustomItems(next);
    saveCustom(next);
  };

  return (
    <div className="space-y-6">

      {isEmpty && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-50 flex items-center justify-center mx-auto mb-4">
            <Package className="h-7 w-7 text-[#9c27b0]" />
          </div>
          <p className="text-sm font-medium text-gray-500">Aucun matériel</p>
          <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">
            Ajoutez du matériel ci-dessous ou configurez les templates dans{' '}
            <Link href="/location-templates" className="text-[#9c27b0] hover:underline font-medium">Configuration</Link>.
          </p>
        </div>
      )}

      {/* Custom materials (saved to DB) */}
      {customItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-200" />
            Matériel manuel
            <span className="h-px flex-1 bg-gray-200" />
          </h3>
          <div className="space-y-2">
            {customItems.map((item) => (
              <div key={item.id} className={[
                'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 border',
                checked.has(item.id)
                  ? 'bg-emerald-50/50 border-emerald-200/50'
                  : 'bg-white border-gray-100 hover:border-purple-200/60 hover:shadow-sm',
              ].join(' ')}>
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
                />
                <p className={['flex-1 text-sm font-medium', checked.has(item.id) ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                  {item.name}
                </p>
                <span className="text-xs font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 rounded-lg border border-purple-100/50">
                  {item.qty} {item.unit}
                </span>
                <button onClick={() => removeCustom(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Computed materials from templates */}
      {computed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-200" />
            Matériel auto-calculé
            <span className="h-px flex-1 bg-gray-200" />
          </h3>
          <div className="space-y-2">
            {computed.map((item) => (
              <div key={item.key} className={[
                'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 border',
                checked.has(item.key)
                  ? 'bg-emerald-50/50 border-emerald-200/50'
                  : 'bg-white border-gray-100 hover:border-purple-200/60 hover:shadow-sm',
              ].join(' ')}>
                <input
                  type="checkbox"
                  checked={checked.has(item.key)}
                  onChange={() => toggle(item.key)}
                  className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
                />
                <p className={['flex-1 text-sm font-medium', checked.has(item.key) ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                  {item.name}
                </p>
                <span className="text-xs font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-gradient-to-r from-purple-50 to-pink-50 px-2.5 py-1 rounded-lg border border-purple-100/50">
                  {item.qty} {item.unit ?? ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {materiel.length > 0  && <Section title="Matériel & Vaisselle" items={materiel}  />}
      {personnel.length > 0 && <Section title="Personnel & Service" items={personnel} />}

      {/* Add custom material */}
      <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-br from-gray-50 to-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Ajouter du matériel</h3>
          {catalog.length > 0 && (
            <button
              onClick={() => setShowCatalog((v) => !v)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200',
                showCatalog
                  ? 'bg-[#9c27b0] text-white shadow-md shadow-purple-200/50'
                  : 'text-[#9c27b0] border border-[#9c27b0]/30 hover:bg-purple-50',
              ].join(' ')}
            >
              <Search className="h-3.5 w-3.5" />
              Catalogue ({catalog.length})
            </button>
          )}
        </div>

        {/* Catalog picker */}
        {showCatalog && (
          <div className="rounded-xl bg-white border border-purple-200/60 overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Rechercher une prestation…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] focus:bg-white transition-all"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {filteredCatalog.length === 0 ? (
                <p className="px-4 py-4 text-xs text-gray-400 text-center">Aucun résultat</p>
              ) : filteredCatalog.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { addFromCatalog(p); setCatalogSearch(''); setShowCatalog(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50/50 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                    {p.category && <span className="ml-2 text-xs text-gray-400">{p.category}</span>}
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#9c27b0] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="h-3 w-3" />Ajouter
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="Nom du matériel…"
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] transition-all"
          />
          <input
            type="number"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            min="0"
            step="1"
            className="w-20 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] transition-all"
          />
          <input
            type="text"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder="unité"
            className="w-20 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] transition-all"
          />
          <button
            onClick={addCustom}
            disabled={!newName.trim() || saving}
            className="flex items-center justify-center w-11 h-11 bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] text-white rounded-xl hover:shadow-lg hover:shadow-purple-200/50 disabled:opacity-40 transition-all duration-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Location de matériel ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-purple-200/60 bg-gradient-to-br from-purple-50/60 to-pink-50/30 p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#9c27b0] to-[#7b1fa2] flex items-center justify-center shadow-md shadow-purple-200/50">
              <Package className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Location de matériel</h3>
              <Link href="/location-templates" className="text-[10px] text-[#9c27b0] hover:underline">Gérer les templates</Link>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {rentalTemplates.length > 0 && (
              <button
                onClick={generateFromTemplates}
                disabled={generatingRentals}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#9c27b0] bg-white border border-purple-200/60 rounded-xl hover:bg-purple-50 hover:shadow-sm transition-all duration-200"
              >
                {generatingRentals ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Générer ({quote.guest_count ?? 1} conv.)
              </button>
            )}
            {rentalItems.length > 0 && (
              <button
                onClick={printBonCommande}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all duration-200"
              >
                <Printer className="h-3.5 w-3.5" />
                PDF
              </button>
            )}
            <button
              onClick={() => { resetRentalForm(); setShowRentalForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] rounded-xl hover:shadow-lg hover:shadow-purple-200/50 transition-all duration-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </button>
          </div>
        </div>

        {/* Rental items grouped by supplier */}
        {rentalItems.length > 0 && (() => {
          const grouped: Record<string, RentalItem[]> = {};
          for (const r of rentalItems) {
            const key = r.supplier?.name ?? 'Sans fournisseur';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
          }
          const grandTotal = rentalItems.reduce((s, r) => s + r.qty * r.price_per_unit, 0);
          return (
            <div className="space-y-4">
              {Object.entries(grouped).map(([sup, items]) => {
                const total = items.reduce((s, i) => s + i.qty * i.price_per_unit, 0);
                return (
                  <div key={sup} className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{sup}</p>
                      <span className="text-xs font-bold text-[#9c27b0] bg-white px-2.5 py-1 rounded-lg border border-purple-100/50">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(total)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((r) => (
                        <div
                          key={r.id}
                          className={[
                            'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 group border',
                            r.ordered
                              ? 'bg-emerald-50/80 border-emerald-200/60'
                              : 'bg-white/80 border-white hover:border-purple-200/60 hover:shadow-sm',
                          ].join(' ')}
                        >
                          <input
                            type="checkbox"
                            checked={!!r.ordered}
                            onChange={(e) => { e.stopPropagation(); toggleOrdered(r.id, e.target.checked); }}
                            title={r.ordered ? 'Commandé' : 'Marquer comme commandé'}
                            className="h-4 w-4 rounded accent-emerald-600 cursor-pointer flex-shrink-0"
                          />
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => startEditRental(r)}
                          >
                            <div className="flex items-center gap-2">
                              <p className={['text-sm font-medium', r.ordered ? 'text-emerald-700' : 'text-gray-800'].join(' ')}>
                                {r.material_name}
                              </p>
                              {r.source === 'template' && (
                                <span className="text-[9px] bg-gradient-to-r from-purple-100 to-pink-50 text-[#9c27b0] px-2 py-0.5 rounded-full font-semibold border border-purple-200/40">auto</span>
                              )}
                              {r.ordered && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">commandé</span>
                              )}
                            </div>
                            {r.notes && <p className="text-xs text-gray-400 italic mt-0.5">{r.notes}</p>}
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0 font-medium">{r.qty}{r.unit ? ` ${r.unit}` : ''}</span>
                          <span className={[
                            'text-xs font-bold tabular-nums flex-shrink-0 px-2.5 py-1 rounded-lg',
                            r.ordered ? 'text-emerald-700 bg-emerald-100/80' : 'text-[#9c27b0] bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100/50',
                          ].join(' ')}>
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(r.qty * r.price_per_unit)}
                          </span>
                          {r.confirmed_individually && (
                            <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">commandé séparément</span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleConfirmedIndividually(r.id, !r.confirmed_individually); }}
                              title={r.confirmed_individually ? 'Réintégrer dans Location globale' : 'Marquer comme commandé séparément (masque de Location globale)'}
                              className={`p-1.5 rounded-lg transition-all ${r.confirmed_individually ? 'text-amber-600 hover:bg-amber-100' : 'text-gray-300 hover:text-amber-600 hover:bg-amber-50'}`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => startEditRental(r)}
                              className="p-1.5 text-gray-300 hover:text-[#9c27b0] rounded-lg hover:bg-purple-50 transition-all"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeRental(r.id); }}
                              className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Grand total */}
              <div className="flex justify-end pt-3 border-t border-purple-200/40">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] shadow-lg shadow-purple-200/40">
                  <span className="text-xs text-white/70 font-medium">Total</span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {rentalItems.length === 0 && !showRentalForm && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500 font-medium">Aucun matériel à louer</p>
            {rentalTemplates.length === 0 && (
              <p className="text-[10px] text-gray-400 mt-1.5">
                Configurez vos templates dans <Link href="/location-templates" className="text-[#9c27b0] hover:underline font-medium">Configuration</Link>
              </p>
            )}
          </div>
        )}

        {/* Add / Edit rental form */}
        {showRentalForm && (
          <div className="bg-white rounded-2xl border border-purple-200/60 p-4 space-y-3 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700">{editingRentalId ? 'Modifier' : 'Nouvel'} article</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                placeholder="Nom du matériel *"
                className="col-span-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 focus:bg-white transition-all"
              />
              <input
                type="number" min="0" step="1"
                value={rQty}
                onChange={(e) => setRQty(e.target.value)}
                placeholder="Quantité"
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 focus:bg-white transition-all"
              />
              <input
                value={rUnit}
                onChange={(e) => setRUnit(e.target.value)}
                placeholder="Unité"
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 focus:bg-white transition-all"
              />
              <select
                value={rSupplierId}
                onChange={(e) => setRSupplierId(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 focus:bg-white transition-all"
              >
                <option value="">Fournisseur (optionnel)</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                type="number" min="0" step="0.01"
                value={rPrice}
                onChange={(e) => setRPrice(e.target.value)}
                placeholder="Prix unitaire HT"
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 focus:bg-white transition-all"
              />
              <input
                value={rNotes}
                onChange={(e) => setRNotes(e.target.value)}
                placeholder="Notes (optionnel)"
                className="col-span-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/20 focus:border-[#9c27b0] bg-gray-50 focus:bg-white transition-all"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={resetRentalForm} className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                Annuler
              </button>
              <button
                onClick={saveRental}
                disabled={!rName.trim() || savingRental}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-[#9c27b0] to-[#7b1fa2] text-white text-xs font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-200/50 disabled:opacity-40 transition-all duration-200"
              >
                {savingRental ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {editingRentalId ? 'Modifier' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Liste de courses tab ───────────────────────────────────────────────────────
function CoursesTab({ quoteId, quote }: { quoteId: string; quote: Quote }) {
  const [items, setItems] = useState<EventIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadItems = useCallback(async () => {
    const { data } = await createClient()
      .from('event_ingredients')
      .select('*, ingredient:ingredients(*), supplier:suppliers(id, name)')
      .eq('quote_id', quoteId)
      .order('created_at');
    return (data ?? []) as EventIngredient[];
  }, [quoteId]);

  // Auto-generate courses from service_ingredients × guest_count
  const autoGenerate = useCallback(async (force = false) => {
    if (!force && !confirm('Recalculer la liste de courses depuis les prestations ? Les articles existants seront supprimés.')) return;
    setGenerating(true);
    const supabase = createClient();

    // 1. Get matching prestations by service names (substring match)
    const services = (quote.services ?? []).filter((s) => !s.isPageBreak);
    if (services.length === 0) { setGenerating(false); return; }

    const { data: prestations } = await supabase
      .from('prestations')
      .select('id, name');
    if (!prestations || prestations.length === 0) { setGenerating(false); return; }

    // Match prestations to quote services by name substring
    const matchedIds: string[] = [];
    for (const svc of services) {
      for (const p of prestations) {
        if (p.name.toLowerCase().includes(svc.name.toLowerCase()) ||
            svc.name.toLowerCase().includes(p.name.toLowerCase())) {
          if (!matchedIds.includes(p.id)) matchedIds.push(p.id);
        }
      }
    }
    if (matchedIds.length === 0) { setGenerating(false); return; }

    // 2. Fetch service_ingredients for matched prestations
    const { data: svcIngredients } = await supabase
      .from('service_ingredients')
      .select('ingredient_id, qty_per_person, unit')
      .in('prestation_id', matchedIds);
    if (!svcIngredients || svcIngredients.length === 0) { setGenerating(false); return; }

    // 3. Aggregate by ingredient_id (sum qty × guest_count)
    const guestCount = quote.guest_count ?? 1;
    const agg: Record<string, { qty: number; unit: string | null }> = {};
    for (const si of svcIngredients) {
      if (!agg[si.ingredient_id]) agg[si.ingredient_id] = { qty: 0, unit: si.unit };
      agg[si.ingredient_id].qty += si.qty_per_person * guestCount;
    }

    // 4. Delete existing + insert new
    await supabase.from('event_ingredients').delete().eq('quote_id', quoteId);
    const toInsert = Object.entries(agg).map(([ingredient_id, { qty, unit }]) => ({
      quote_id: quoteId,
      ingredient_id,
      quantity: Math.round(qty * 100) / 100,
      unit,
      checked: false,
    }));
    await supabase.from('event_ingredients').insert(toInsert);

    // 5. Reload
    const fresh = await loadItems();
    setItems(fresh);
    setGenerating(false);
  }, [quote, quoteId, loadItems]);

  useEffect(() => {
    loadItems().then((data) => {
      setItems(data);
      setLoading(false);
      // Auto-generate only if list is empty AND quote has services with potential links
      if (data.length === 0 && (quote.services ?? []).filter((s) => !s.isPageBreak).length > 0) {
        autoGenerate(true);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const toggle = async (id: string, checked: boolean) => {
    await createClient().from('event_ingredients').update({ checked }).eq('id', id);
    setItems((p) => p.map((i) => i.id === id ? { ...i, checked } : i));
  };

  const grouped = useMemo(() =>
    items.reduce<Record<string, EventIngredient[]>>((acc, item) => {
      const key = item.supplier?.name ?? 'Sans fournisseur';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {}),
  [items]);

  const supplierKeys = useMemo(() =>
    Object.keys(grouped).sort((a, b) => {
      if (a === 'Sans fournisseur') return 1;
      if (b === 'Sans fournisseur') return -1;
      return a.localeCompare(b, 'fr');
    }),
  [grouped]);

  const done = items.filter((i) => i.checked).length;
  const pct  = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  if (loading || generating) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-[#9c27b0]" />
      {generating && <p className="text-xs text-gray-400">Calcul depuis les prestations…</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{items.length} article{items.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => autoGenerate(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Recalculer depuis les prestations
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <ShoppingCart className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun article dans la liste de courses.</p>
          <p className="text-xs text-gray-400 mt-1">
            Ajoutez des ingrédients depuis l&apos;onglet <span className="text-[#9c27b0] font-medium">Prépa & Achats</span>
            {' '}ou liez des ingrédients à vos prestations.
          </p>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{done}/{items.length} article{items.length > 1 ? 's' : ''} coché{done > 1 ? 's' : ''}</span>
              <span className="font-medium text-[#9c27b0]">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 bg-[#9c27b0] rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Items grouped by supplier */}
          {supplierKeys.map((supplierName) => (
            <div key={supplierName} className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{supplierName}</p>
              {grouped[supplierName].map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                    className="h-4 w-4 rounded accent-[#9c27b0] cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={['text-sm font-medium leading-snug', item.checked ? 'line-through text-gray-400' : 'text-gray-800'].join(' ')}>
                      {item.ingredient.name}
                    </p>
                    {item.notes && <p className="text-xs text-gray-400 italic truncate">{item.notes}</p>}
                  </div>
                  <span className="text-sm font-bold text-[#9c27b0] tabular-nums flex-shrink-0 bg-purple-50 px-2 py-0.5 rounded-lg">
                    {item.quantity} {item.unit ?? item.ingredient.unit ?? ''}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
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
      <style>{`@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}}`}</style>
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

  const toggleCourses = async (id: string, val: boolean) => {
    await createClient().from('event_extras').update({ assign_courses: val }).eq('id', id);
    setAssignments((p) => p.map((a) => a.id === id ? { ...a, assign_courses: val } : a));
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
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiches Mission</title><style>@page{size:A4;margin:0;}html,body{color-scheme:light}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}body{margin:0;padding:0;font-family:Georgia,serif;background:#fff;}#wrapper{padding:20mm;}</style></head><body><div id="wrapper">${generateStaffHtml(missions)}</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) { URL.revokeObjectURL(url); return; }
    win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 600); };
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

                    {/* Assign courses toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.assign_courses}
                        onChange={(e) => toggleCourses(a.id, e.target.checked)}
                        className="h-3 w-3 rounded accent-[#9c27b0]"
                      />
                      <span className="text-[10px] text-gray-500">Mission courses</span>
                    </label>

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
  const [financeOpen, setFinanceOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('quotes')
      .select('id, client_name, event_type, event_date, event_location, guest_count, total_amount, status, services, checklist, event_materials')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Back ──────────────────────────────────────────────────────────── */}
        <Link href="/calendrier" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#9c27b0] transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Calendrier
        </Link>

        {/* ── Hero header card ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-purple-100/40">
          {/* Decorative gradient bar */}
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, #9c27b0, #e040fb, #7b1fa2)' }} />

          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{quote.client_name || 'Événement'}</h1>
                  <span className="inline-block mt-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-gradient-to-r from-purple-100 to-pink-50 text-[#9c27b0] border border-purple-200/50">
                    {quote.event_type}
                  </span>
                </div>

                {/* Info chips */}
                <div className="flex flex-wrap gap-2">
                  {displayDate && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50/80 border border-purple-100/50">
                      <Calendar className="h-3.5 w-3.5 text-[#9c27b0]" />
                      <span className="text-xs font-medium text-gray-700 capitalize">{displayDate}</span>
                    </div>
                  )}
                  {quote.event_location && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/80 border border-blue-100/50">
                      <MapPin className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-gray-700">{quote.event_location}</span>
                    </div>
                  )}
                  {quote.guest_count && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-100/50">
                      <Users className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs font-medium text-gray-700">{quote.guest_count} couvert{quote.guest_count > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price + actions */}
              <div className="text-right flex-shrink-0 space-y-2">
                {quote.total_amount != null && (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-br from-[#9c27b0] to-[#7b1fa2] shadow-lg shadow-purple-200/50">
                    <CreditCard className="h-4 w-4 text-white/70" />
                    <span className="text-lg font-bold text-white tabular-nums">{formatCurrency(quote.total_amount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setFinanceOpen(true)}
                    title="Gestion financière (CA, marge, coûts)"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition-colors">
                    <Wallet className="h-3 w-3" />
                    Finance
                  </button>
                  <Link href={`/devis/${quote.id}/modifier`} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#9c27b0] transition-colors">
                    <Eye className="h-3 w-3" />
                    Voir le devis
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex bg-white/70 backdrop-blur-sm border border-gray-200/60 p-1.5 rounded-2xl gap-1 overflow-x-auto shadow-sm">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200',
                tab === key
                  ? 'bg-gradient-to-br from-[#9c27b0] to-[#7b1fa2] text-white shadow-md shadow-purple-200/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <div className="bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-2xl p-5 sm:p-6 shadow-sm">
          {tab === 'checklist' && (
            <ChecklistTab
              quote={quote}
              onUpdate={(items) => setQuote((q) => q ? { ...q, checklist: items } : q)}
            />
          )}
          {tab === 'materiel'  && <MaterielTab quote={quote} onUpdate={(mats) => setQuote((q) => q ? { ...q, event_materials: mats } : q)} />}
          {tab === 'courses'   && <CoursesTab  quoteId={id!} quote={quote} />}
          {tab === 'achats'    && <AchatsTab   quoteId={id!} />}
          {tab === 'staffing'  && <StaffingTab quoteId={id!} quote={quote} />}
        </div>
      </div>

      {/* ── Finance sheet ────────────────────────────────────────────────── */}
      <FinanceSheet
        open={financeOpen}
        quoteId={financeOpen ? quote.id : null}
        onClose={() => setFinanceOpen(false)}
      />
    </div>
  );
}
