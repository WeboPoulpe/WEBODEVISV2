'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Plus, Truck, Loader2, X, Check, FileText, Trash2,
  Package, Calendar, Search, Send, CheckCircle2, Printer,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Supplier { id: string; name: string; email: string | null; phone: string | null; }
interface Ingredient { id: string; name: string; unit: string | null; volume_unit_price: number | null; preferred_supplier_id: string | null; }
interface OrderItem { id: string; ingredient_id: string; quantity: number; unit_price: number; received_quantity: number; ingredient?: Ingredient; }
interface SupplierOrder {
  id: string;
  supplier_id: string;
  event_id: string | null;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  total_amount: number;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  supplier?: Supplier;
  items?: OrderItem[];
}

const STATUS_CONFIG = {
  draft:     { label: 'Brouillon',   bg: 'bg-gray-100',     text: 'text-gray-700',     icon: FileText },
  sent:      { label: 'Envoyée',     bg: 'bg-blue-100',     text: 'text-blue-700',     icon: Send },
  received:  { label: 'Reçue',       bg: 'bg-emerald-100',  text: 'text-emerald-700',  icon: CheckCircle2 },
  cancelled: { label: 'Annulée',     bg: 'bg-red-100',      text: 'text-red-700',      icon: X },
};

export default function CommandesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'received'>('all');
  const [createModal, setCreateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const [{ data: ordersData }, { data: suppliersData }] = await Promise.all([
      supabase.from('supplier_orders')
        .select('*, supplier:suppliers(id, name, email, phone), items:supplier_order_items(*, ingredient:ingredients(id, name, unit, volume_unit_price, preferred_supplier_id))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
    ]);
    setOrders((ordersData as SupplierOrder[]) ?? []);
    setSuppliers((suppliersData as Supplier[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.supplier?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalToOrder = orders.filter((o) => o.status === 'draft').reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalSent = orders.filter((o) => o.status === 'sent').reduce((s, o) => s + (o.total_amount || 0), 0);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-base">Commandes fournisseurs</h1>
              <p className="text-xs text-gray-500">{orders.length} commande{orders.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2]">
            <Plus className="h-4 w-4" />Nouvelle commande
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <button onClick={() => setStatusFilter('draft')} className={cn('text-left rounded-xl p-3 border', statusFilter === 'draft' ? 'bg-gray-100 border-gray-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100')}>
            <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Brouillons</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalToOrder)}</p>
          </button>
          <button onClick={() => setStatusFilter('sent')} className={cn('text-left rounded-xl p-3 border', statusFilter === 'sent' ? 'bg-blue-100 border-blue-400' : 'bg-blue-50 border-blue-200 hover:bg-blue-100')}>
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Envoyées</p>
            <p className="text-lg font-bold text-blue-900">{formatCurrency(totalSent)}</p>
          </button>
          <button onClick={() => setStatusFilter('all')} className={cn('text-left rounded-xl p-3 border', statusFilter === 'all' ? 'bg-emerald-100 border-emerald-400' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100')}>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-emerald-900">{orders.length}</p>
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher fournisseur…"
            className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucune commande</p>
            <button onClick={() => setCreateModal(true)} className="mt-3 text-xs text-[#9c27b0] hover:underline font-medium">+ Créer une commande</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status];
              const Icon = cfg.icon;
              return (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex-shrink-0">
                        <Truck className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900 truncate">{order.supplier?.name || '—'}</p>
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                            <Icon className="h-2.5 w-2.5" />{cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(order.items?.length ?? 0)} article{(order.items?.length ?? 0) > 1 ? 's' : ''} ·
                          créée le {formatDate(order.created_at)}
                          {order.ordered_at && ` · envoyée le ${formatDate(order.ordered_at)}`}
                        </p>
                        {order.notes && <p className="text-[10px] text-gray-400 italic mt-1 truncate">{order.notes}</p>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(order.total_amount || 0)}</p>
                      <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingOrder(order)} title="Détails" className="p-1 text-gray-400 hover:text-[#9c27b0] hover:bg-[#f3e5f5] rounded">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => setEditingOrder(order)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <FileText className="h-3 w-3" />Détails
                    </button>
                    {order.status === 'draft' && (
                      <button onClick={() => updateStatus(order.id, 'sent')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg">
                        <Send className="h-3 w-3" />Marquer envoyée
                      </button>
                    )}
                    {order.status === 'sent' && (
                      <button onClick={() => markAsReceived(order.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 hover:bg-emerald-50 rounded-lg">
                        <CheckCircle2 className="h-3 w-3" />Marquer reçue (+stock)
                      </button>
                    )}
                    <button onClick={() => printOrder(order)} title="Imprimer" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteOrder(order.id)} title="Supprimer" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createModal && user && (
        <CreateOrderModal
          userId={user.id}
          suppliers={suppliers}
          onClose={() => setCreateModal(false)}
          onCreated={() => { setCreateModal(false); fetchAll(); }}
        />
      )}

      {/* Edit/details modal */}
      {editingOrder && (
        <OrderDetailsModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onUpdated={() => { setEditingOrder(null); fetchAll(); }}
        />
      )}
    </div>
  );

  async function updateStatus(orderId: string, status: 'sent' | 'received' | 'cancelled') {
    const supabase = createClient();
    await supabase.from('supplier_orders').update({
      status,
      ordered_at: status === 'sent' ? new Date().toISOString() : undefined,
      received_at: status === 'received' ? new Date().toISOString() : undefined,
    }).eq('id', orderId);
    fetchAll();
  }

  async function markAsReceived(orderId: string) {
    if (!user) return;
    if (!confirm('Marquer cette commande comme reçue ? Cela ajoutera les quantités au stock.')) return;
    const supabase = createClient();
    const order = orders.find((o) => o.id === orderId);
    if (!order || !order.items) return;

    // Add stock movements for each item (auto-update via trigger)
    for (const item of order.items) {
      await supabase.from('stock_movements').insert({
        user_id: user.id,
        ingredient_id: item.ingredient_id,
        movement_type: 'in',
        quantity: item.quantity,
        reason: `Commande ${order.supplier?.name || 'fournisseur'} reçue`,
        order_id: orderId,
      });
    }

    await supabase.from('supplier_orders').update({
      status: 'received',
      received_at: new Date().toISOString(),
    }).eq('id', orderId);
    fetchAll();
  }

  async function deleteOrder(orderId: string) {
    if (!confirm('Supprimer cette commande ? Cette action est irréversible.')) return;
    await createClient().from('supplier_orders').delete().eq('id', orderId);
    fetchAll();
  }

  function printOrder(order: SupplierOrder) {
    const html = buildOrderHtml(order);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

// ── PDF / Print HTML ─────────────────────────────────────────────────────────
function buildOrderHtml(order: SupplierOrder): string {
  const items = order.items || [];
  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bon de commande</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: Georgia, serif; color: #1a1a1a; line-height: 1.5; }
  h1 { color: #9c27b0; font-size: 28px; margin: 0 0 5px; }
  .header { border-bottom: 3px solid #9c27b0; padding-bottom: 15px; margin-bottom: 20px; }
  .info { display: flex; gap: 20px; margin-bottom: 20px; }
  .info-block { flex: 1; padding: 12px; background: #faf5ff; border-radius: 8px; border: 1px solid #e9d5ff; }
  .info-label { font-size: 9px; font-weight: bold; color: #9c27b0; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #9c27b0; color: white; text-align: left; padding: 10px; font-size: 11px; }
  th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
  td { padding: 9px 10px; border-bottom: 1px solid #e9d5ff; font-size: 12px; }
  td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
  .total { background: #faf5ff; padding: 15px; border-radius: 8px; border: 1px solid #e9d5ff; text-align: right; margin-top: 20px; }
  .total-amount { font-size: 22px; font-weight: bold; color: #9c27b0; }
  .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: center; }
</style></head>
<body>
  <div class="header">
    <h1>BON DE COMMANDE</h1>
    <p style="margin: 0; color: #666;">N° ${order.id.slice(0, 8).toUpperCase()} · ${new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
  </div>
  <div class="info">
    <div class="info-block">
      <p class="info-label">Fournisseur</p>
      <p style="margin: 0; font-weight: bold; font-size: 14px;">${order.supplier?.name || '—'}</p>
      ${order.supplier?.email ? `<p style="margin: 2px 0 0; font-size: 11px; color: #555;">${order.supplier.email}</p>` : ''}
      ${order.supplier?.phone ? `<p style="margin: 2px 0 0; font-size: 11px; color: #555;">${order.supplier.phone}</p>` : ''}
    </div>
    <div class="info-block">
      <p class="info-label">Statut</p>
      <p style="margin: 0; font-weight: bold; font-size: 14px;">${STATUS_CONFIG[order.status].label}</p>
      ${order.ordered_at ? `<p style="margin: 2px 0 0; font-size: 11px; color: #555;">Envoyée le ${new Date(order.ordered_at).toLocaleDateString('fr-FR')}</p>` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>Article</th><th>Quantité</th><th>Prix unit.</th><th>Total</th></tr></thead>
    <tbody>
      ${items.map((it) => `
        <tr>
          <td><strong>${it.ingredient?.name || '—'}</strong></td>
          <td>${it.quantity} ${it.ingredient?.unit || ''}</td>
          <td>${it.unit_price.toFixed(2)} €</td>
          <td><strong>${(it.quantity * it.unit_price).toFixed(2)} €</strong></td>
        </tr>
      `).join('')}
      ${items.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:#bbb; font-style:italic; padding:20px;">Aucun article</td></tr>' : ''}
    </tbody>
  </table>
  <div class="total">
    <p style="margin: 0 0 5px; font-size: 12px; color: #666;">Total HT</p>
    <p class="total-amount" style="margin: 0;">${total.toFixed(2)} €</p>
  </div>
  ${order.notes ? `<div style="margin-top: 20px; padding: 12px; background: #fafafa; border-radius: 6px;"><p style="margin:0; font-size: 11px; color:#666; font-style:italic;">${order.notes}</p></div>` : ''}
  <div class="footer">Document généré par WeboDevis</div>
</body></html>`;
}

// ── Create order modal ──────────────────────────────────────────────────────
function CreateOrderModal({ userId, suppliers, onClose, onCreated }: {
  userId: string; suppliers: Supplier[]; onClose: () => void; onCreated: () => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ id: string; ingredient_id: string; quantity: number; unit_price: number }[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb.from('ingredients').select('id, name, unit, volume_unit_price, preferred_supplier_id').or(`user_id.is.null,user_id.eq.${userId}`).order('name')
      .then(({ data }) => setIngredients((data as Ingredient[]) ?? []));
  }, [userId]);

  // Auto-suggest ingredients linked to selected supplier
  useEffect(() => {
    if (!supplierId) return;
    const linked = ingredients.filter((i) => i.preferred_supplier_id === supplierId);
    if (linked.length > 0 && items.length === 0) {
      // Pre-suggest but don't auto-add
    }
  }, [supplierId, ingredients, items.length]);

  const addItem = (ing: Ingredient) => {
    if (items.find((it) => it.ingredient_id === ing.id)) return;
    setItems([...items, { id: crypto.randomUUID(), ingredient_id: ing.id, quantity: 1, unit_price: ing.volume_unit_price ?? 0 }]);
    setSearch('');
    setShowPicker(false);
  };

  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));
  const updateItem = (id: string, key: 'quantity' | 'unit_price', value: number) => {
    setItems(items.map((i) => i.id === id ? { ...i, [key]: value } : i));
  };

  const filteredIngs = search ? ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];
  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

  const save = async () => {
    if (!supplierId || items.length === 0) { alert('Sélectionne un fournisseur et au moins un article'); return; }
    setSaving(true);
    const sb = createClient();
    const { data: order, error } = await sb.from('supplier_orders').insert({
      user_id: userId,
      supplier_id: supplierId,
      status: 'draft',
      total_amount: total,
      notes: notes || null,
    }).select('id').single();
    if (error || !order) { alert('Erreur: ' + error?.message); setSaving(false); return; }

    // Insert items
    await sb.from('supplier_order_items').insert(items.map((i) => ({
      order_id: order.id,
      ingredient_id: i.ingredient_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })));
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl"><ShoppingCart className="h-4 w-4 text-amber-600" /></div>
            <h2 className="font-semibold text-sm">Nouvelle commande fournisseur</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fournisseur *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]">
              <option value="">— Choisir un fournisseur —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Add items */}
          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ajouter un ingrédient</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setShowPicker(true); }}
                placeholder="Rechercher un ingrédient…"
                className="w-full text-sm border border-dashed border-[#9c27b0]/30 bg-[#faf5ff] rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30" />
            </div>
            {showPicker && filteredIngs.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredIngs.map((ing) => (
                  <button key={ing.id} onClick={() => addItem(ing)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#faf5ff] text-left border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium text-gray-900">{ing.name}</span>
                    <span className="text-xs text-gray-400">{ing.unit || ''} · {(ing.volume_unit_price ?? 0).toFixed(2)}€</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Aucun article</p>
            ) : items.map((it) => {
              const ing = ingredients.find((i) => i.id === it.ingredient_id);
              return (
                <div key={it.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                  <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-900 flex-1 truncate">{ing?.name}</p>
                  <input type="number" min={0.01} step={0.01} value={it.quantity}
                    onChange={(e) => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-16 text-xs text-center border border-gray-200 rounded px-2 py-1" />
                  <span className="text-[10px] text-gray-400">{ing?.unit || ''}</span>
                  <input type="number" min={0} step={0.01} value={it.unit_price}
                    onChange={(e) => updateItem(it.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs text-right border border-gray-200 rounded px-2 py-1" />
                  <span className="text-[10px] text-gray-400">€</span>
                  <span className="text-xs font-bold text-gray-900 w-20 text-right">{(it.quantity * it.unit_price).toFixed(2)}€</span>
                  <button onClick={() => removeItem(it.id)} className="p-1 text-gray-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>

          {items.length > 0 && (
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <p className="text-base font-bold text-gray-900">Total HT : {formatCurrency(total)}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Pour le mariage Dupont du 14 juin…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={save} disabled={saving || !supplierId || items.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Créer la commande
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order details modal ─────────────────────────────────────────────────────
function OrderDetailsModal({ order, onClose, onUpdated }: {
  order: SupplierOrder; onClose: () => void; onUpdated: () => void;
}) {
  const cfg = STATUS_CONFIG[order.status];
  const items = order.items || [];
  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl"><ShoppingCart className="h-4 w-4 text-amber-600" /></div>
            <div>
              <h2 className="font-semibold text-sm">Commande {order.supplier?.name}</h2>
              <p className={cn('text-[10px] font-bold inline-block px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                <Package className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-900 flex-1">{it.ingredient?.name || '—'}</p>
                <span className="text-xs text-gray-500">{it.quantity}{it.ingredient?.unit || ''}</span>
                <span className="text-xs text-gray-500">× {it.unit_price.toFixed(2)}€</span>
                <span className="text-sm font-bold text-gray-900 w-20 text-right">{(it.quantity * it.unit_price).toFixed(2)}€</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-bold">
            <span>Total HT</span><span>{formatCurrency(total)}</span>
          </div>
          {order.notes && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-600 italic">{order.notes}</p></div>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Fermer</button>
        </div>
      </div>
    </div>
  );
}
