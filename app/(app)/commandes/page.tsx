'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Check, Trash2, Search, Send, CheckCircle2, Printer, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUrlAction } from '@/lib/useUrlAction';
import { useAuth } from '@/context/AuthContext';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, iconBtn, iconBtnDanger, inputCls, labelCls, pill, errorCls } from '@/components/ui/kit';
import { ErrorBanner, esc, printDocument } from '@/components/evenements/shared';

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
  draft:     { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700' },
  sent:      { label: 'Envoyée',   cls: 'bg-primary-50 text-primary-700' },
  received:  { label: 'Reçue',     cls: 'bg-sage-100 text-sage' },
  cancelled: { label: 'Annulée',   cls: 'bg-gray-100 text-gray-500' },
};

type StatusFilter = 'all' | 'draft' | 'sent' | 'received';

const euros = (n: number) => formatCurrency(n);
const num = (n: number) => n.toLocaleString('fr-FR');

export default function CommandesPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createModal, setCreateModal] = useState(false);
  // Action rapide du menu (lib/navMega.ts).
  useUrlAction({ nouveau: () => setCreateModal(true) });
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const [ordersRes, suppliersRes] = await Promise.all([
      supabase.from('supplier_orders')
        .select('*, supplier:suppliers(id, name, email, phone), items:supplier_order_items(*, ingredient:ingredients(id, name, unit, volume_unit_price, preferred_supplier_id))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    if (ordersRes.error || suppliersRes.error) setError('Vos commandes n’ont pas pu être chargées. Rechargez la page.');
    setOrders((ordersRes.data as SupplierOrder[]) ?? []);
    setSuppliers((suppliersRes.data as Supplier[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.supplier?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const count = (s: SupplierOrder['status']) => orders.filter((o) => o.status === s).length;
  const totalToOrder = orders.filter((o) => o.status === 'draft').reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalSent = orders.filter((o) => o.status === 'sent').reduce((s, o) => s + (o.total_amount || 0), 0);

  const FILTERS: [StatusFilter, string][] = [
    ['all', 'Toutes'],
    ['draft', `Brouillons${count('draft') ? ` (${count('draft')})` : ''}`],
    ['sent', `Envoyées${count('sent') ? ` (${count('sent')})` : ''}`],
    ['received', `Reçues${count('received') ? ` (${count('received')})` : ''}`],
  ];

  const summary = [
    `${orders.length} commande${orders.length > 1 ? 's' : ''}`,
    totalToOrder > 0 ? `${euros(totalToOrder)} en brouillon` : null,
    totalSent > 0 ? `${euros(totalSent)} envoyé${totalSent > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ');

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Commandes fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{loading ? ' ' : summary}</p>
        </div>
        <button onClick={() => setCreateModal(true)} className={cn(btnPrimary, 'w-full sm:w-auto')}>
          <Plus className="h-4 w-4" />Nouvelle commande
        </button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un fournisseur"
            aria-label="Rechercher un fournisseur" className={cn(inputCls, 'pl-11')} />
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70 overflow-x-auto scrollbar-none" role="tablist" aria-label="Commandes affichées">
          {FILTERS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={statusFilter === key} onClick={() => setStatusFilter(key)}
              className={cn('flex-1 lg:flex-none flex-shrink-0 h-10 px-2.5 sm:px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">{orders.length === 0 ? 'Aucune commande pour le moment' : 'Aucune commande ne correspond'}</p>
          <p className="text-sm text-gray-500 max-w-sm">
            {orders.length === 0
              ? 'Préparez un bon de commande : un fournisseur, des ingrédients, des quantités.'
              : 'Essayez un autre fournisseur ou un autre filtre.'}
          </p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((order) => {
            const cfg = STATUS_CONFIG[order.status];
            const n = order.items?.length ?? 0;
            return (
              <li key={order.id} className="flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-2 pr-2 hover:bg-gray-50 transition-colors">
                <button onClick={() => setEditingOrder(order)} className="flex-1 min-w-0 basis-full md:basis-auto flex items-center gap-3 text-left pl-4 sm:pl-5 pr-2 md:pr-0 pt-3.5 md:py-3.5">
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{order.supplier?.name || 'Fournisseur supprimé'}</span>
                      <span className={cn(pill, cfg.cls)}>{cfg.label}</span>
                    </span>
                    <span className="block text-sm text-gray-500 mt-0.5">
                      {n} article{n > 1 ? 's' : ''}, créée le {formatDate(order.created_at)}
                      {order.ordered_at && `, envoyée le ${formatDate(order.ordered_at)}`}
                    </span>
                    {order.notes && <span className="block text-sm text-gray-500 truncate">{order.notes}</span>}
                  </span>
                  <span className="font-display text-lg font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {euros(order.total_amount || 0)}
                  </span>
                </button>
                <div className="flex items-center gap-1 w-full md:w-auto pl-3 sm:pl-4 md:pl-2 pb-3 md:pb-0">
                  {order.status === 'draft' && (
                    <button onClick={() => updateStatus(order.id, 'sent')} className={cn(btnSecondary, 'h-10 flex-1 md:flex-none whitespace-nowrap')}>
                      <Send className="h-4 w-4" />Marquer envoyée
                    </button>
                  )}
                  {order.status === 'sent' && (
                    <button onClick={() => markAsReceived(order.id)} className={cn(btnSecondary, 'h-10 flex-1 md:flex-none whitespace-nowrap')}>
                      <CheckCircle2 className="h-4 w-4" />Marquer reçue
                    </button>
                  )}
                  <span className={cn('flex items-center', order.status !== 'draft' && order.status !== 'sent' && 'ml-auto md:ml-0')}>
                    <button onClick={() => printOrder(order)} className={iconBtn} aria-label={`Imprimer le bon de commande ${order.supplier?.name ?? ''}`} title="Imprimer le bon">
                      <Printer className="h-[18px] w-[18px]" />
                    </button>
                    <button onClick={() => deleteOrder(order.id)} className={iconBtnDanger} aria-label={`Supprimer la commande ${order.supplier?.name ?? ''}`} title="Supprimer">
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {createModal && user && (
        <CreateOrderModal
          userId={user.id}
          suppliers={suppliers}
          onClose={() => setCreateModal(false)}
          onCreated={() => { setCreateModal(false); fetchAll(); }}
        />
      )}

      {editingOrder && (
        <OrderDetailsModal order={editingOrder} onClose={() => setEditingOrder(null)} onPrint={() => printOrder(editingOrder)} />
      )}
    </div>
  );

  async function updateStatus(orderId: string, status: 'sent' | 'received' | 'cancelled') {
    const supabase = createClient();
    const { error: err } = await supabase.from('supplier_orders').update({
      status,
      ordered_at: status === 'sent' ? new Date().toISOString() : undefined,
      received_at: status === 'received' ? new Date().toISOString() : undefined,
    }).eq('id', orderId);
    if (err) { setError('Le statut de la commande n’a pas pu être changé. Réessayez.'); return; }
    setError(null);
    fetchAll();
  }

  async function markAsReceived(orderId: string) {
    if (!user) return;
    if (!confirm('Marquer cette commande comme reçue ? Ses quantités seront ajoutées au stock.')) return;
    const supabase = createClient();
    const order = orders.find((o) => o.id === orderId);
    if (!order || !order.items) return;

    // Un mouvement d'entrée par article (le stock se met à jour par déclencheur).
    let failed = 0;
    for (const item of order.items) {
      const { error: err } = await supabase.from('stock_movements').insert({
        user_id: user.id,
        ingredient_id: item.ingredient_id,
        movement_type: 'in',
        quantity: item.quantity,
        reason: `Commande ${order.supplier?.name || 'fournisseur'} reçue`,
        order_id: orderId,
      });
      if (err) failed++;
    }
    if (failed > 0) {
      setError(`${failed} article${failed > 1 ? 's' : ''} n’${failed > 1 ? 'ont' : 'a'} pas pu entrer dans le stock. La commande reste « Envoyée » : vérifiez le stock avant de réessayer.`);
      fetchAll();
      return;
    }

    const { error: err } = await supabase.from('supplier_orders').update({
      status: 'received',
      received_at: new Date().toISOString(),
    }).eq('id', orderId);
    if (err) setError('Le stock est à jour, mais la commande n’a pas pu passer en « Reçue ». Réessayez.');
    else setError(null);
    fetchAll();
  }

  async function deleteOrder(orderId: string) {
    if (!confirm('Supprimer cette commande ? Cette action est définitive.')) return;
    const { error: err } = await createClient().from('supplier_orders').delete().eq('id', orderId);
    if (err) { setError('La commande n’a pas pu être supprimée. Réessayez.'); return; }
    setError(null);
    fetchAll();
  }

  function printOrder(order: SupplierOrder) {
    if (!printDocument('Bon de commande', buildOrderBody(order))) {
      setError('Votre navigateur a bloqué l’ouverture du bon. Autorisez les fenêtres pour ce site, puis réessayez.');
    }
  }
}

// ── Bon de commande à imprimer ───────────────────────────────────────────────
function buildOrderBody(order: SupplierOrder): string {
  const items = order.items || [];
  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const sup = order.supplier;
  const box = 'flex:1;padding:10px 12px;background:#f7f3ec;border-radius:8px';
  const label = 'margin:0 0 4px;font-size:11px;color:#78736a';
  return `
  <p class="muted" style="margin:0 0 16px">N° ${esc(order.id.slice(0, 8).toUpperCase())}, du ${new Date(order.created_at).toLocaleDateString('fr-FR')}</p>
  <div style="display:flex;gap:12px;margin-bottom:18px">
    <div style="${box}">
      <p style="${label}">Fournisseur</p>
      <p style="margin:0;font-weight:bold;font-size:14px">${esc(sup?.name) || 'Fournisseur supprimé'}</p>
      ${sup?.email ? `<p style="margin:2px 0 0;font-size:11px">${esc(sup.email)}</p>` : ''}
      ${sup?.phone ? `<p style="margin:2px 0 0;font-size:11px">${esc(sup.phone)}</p>` : ''}
    </div>
    <div style="${box}">
      <p style="${label}">Statut</p>
      <p style="margin:0;font-weight:bold;font-size:14px">${STATUS_CONFIG[order.status].label}</p>
      ${order.ordered_at ? `<p style="margin:2px 0 0;font-size:11px">Envoyée le ${new Date(order.ordered_at).toLocaleDateString('fr-FR')}</p>` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>Article</th><th class="r">Quantité</th><th class="r">Prix unitaire HT</th><th class="r">Total HT</th></tr></thead>
    <tbody>
      ${items.map((it) => `<tr>
        <td><strong>${esc(it.ingredient?.name) || 'Ingrédient supprimé'}</strong></td>
        <td class="r">${num(it.quantity)} ${esc(it.ingredient?.unit)}</td>
        <td class="r">${euros(it.unit_price)}</td>
        <td class="r"><strong>${euros(it.quantity * it.unit_price)}</strong></td>
      </tr>`).join('')}
      ${items.length === 0 ? '<tr><td colspan="4" class="muted" style="text-align:center;padding:16px">Aucun article</td></tr>' : ''}
    </tbody>
    <tfoot><tr>
      <td colspan="3" class="r" style="font-weight:bold;border:0;padding-top:12px">Total HT</td>
      <td class="r" style="font-weight:bold;font-size:16px;color:#b4502d;border:0;padding-top:12px">${euros(total)}</td>
    </tr></tfoot>
  </table>
  ${order.notes ? `<p style="margin-top:18px;padding:10px 12px;background:#f7f3ec;border-radius:8px;font-size:12px">${esc(order.notes)}</p>` : ''}
  <p class="muted" style="margin-top:36px;text-align:center">Document préparé avec WeboDevis</p>`;
}

// ── Nouvelle commande ────────────────────────────────────────────────────────
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.from('ingredients').select('id, name, unit, volume_unit_price, preferred_supplier_id').or(`user_id.is.null,user_id.eq.${userId}`).order('name')
      .then(({ data }) => setIngredients((data as Ingredient[]) ?? []));
  }, [userId]);

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
    if (!supplierId || items.length === 0) { setError('Choisissez un fournisseur et au moins un article.'); return; }
    setSaving(true); setError(null);
    const sb = createClient();
    const { data: order, error: err } = await sb.from('supplier_orders').insert({
      user_id: userId,
      supplier_id: supplierId,
      status: 'draft',
      total_amount: total,
      notes: notes || null,
    }).select('id').single();
    if (err || !order) { setError('La commande n’a pas pu être créée. Réessayez.'); setSaving(false); return; }

    const { error: itemsErr } = await sb.from('supplier_order_items').insert(items.map((i) => ({
      order_id: order.id,
      ingredient_id: i.ingredient_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })));
    setSaving(false);
    if (itemsErr) {
      setError('La commande est créée, mais ses articles n’ont pas pu être enregistrés. Supprimez-la et recommencez.');
      return;
    }
    onCreated();
  };

  const small = 'h-10 px-2 bg-white border border-gray-200 rounded-lg text-gray-900 tabular-nums focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100';

  return (
    <Modal
      title="Nouvelle commande"
      wide
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={save} disabled={saving || !supplierId || items.length === 0} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Créer la commande
        </button>
      </>}
    >
      <div className="space-y-5 pb-3">
        <div>
          <label htmlFor="order-supplier" className={labelCls}>Fournisseur</label>
          <select id="order-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
            <option value="">Choisir un fournisseur</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {suppliers.length === 0 && <p className="text-sm text-gray-500 mt-2">Ajoutez d’abord vos fournisseurs dans la page Fournisseurs.</p>}
        </div>

        <div className="relative">
          <label htmlFor="order-search" className={labelCls}>Ajouter un ingrédient</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input id="order-search" value={search} onChange={(e) => { setSearch(e.target.value); setShowPicker(true); }}
              placeholder="Rechercher un ingrédient…" className={cn(inputCls, 'pl-11')} />
          </div>
          {showPicker && filteredIngs.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-float max-h-56 overflow-y-auto">
              {filteredIngs.map((ing) => (
                <button key={ing.id} onClick={() => addItem(ing)}
                  className="w-full flex items-center justify-between gap-3 px-4 min-h-11 py-2 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0">
                  <span className="text-[15px] text-gray-900">{ing.name}</span>
                  <span className="text-sm text-gray-500 whitespace-nowrap">{euros(ing.volume_unit_price ?? 0)}{ing.unit ? ` le ${ing.unit}` : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-5 py-6 text-center text-[15px] text-gray-600">Aucun article pour l’instant. Cherchez un ingrédient ci-dessus.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border-y border-gray-100">
            {items.map((it) => {
              const ing = ingredients.find((i) => i.id === it.ingredient_id);
              return (
                <li key={it.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 py-3">
                  <div className="flex items-center gap-2 basis-full sm:basis-auto sm:flex-1 min-w-0 sm:order-none">
                    <p className="font-medium text-gray-900 flex-1 min-w-0 break-words">{ing?.name}</p>
                    <button onClick={() => removeItem(it.id)} className={cn(iconBtnDanger, 'sm:hidden')} aria-label={`Retirer ${ing?.name ?? 'l’article'}`}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <label className="flex items-center gap-1.5 text-sm text-gray-500">
                      <input type="number" inputMode="decimal" min={0.01} step={0.01} value={it.quantity} aria-label={`Quantité de ${ing?.name ?? 'l’article'}`}
                        onChange={(e) => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)} className={cn(small, 'w-20 text-center')} />
                      {ing?.unit || 'unité'}
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-gray-500">
                      à
                      <input type="number" inputMode="decimal" min={0} step={0.01} value={it.unit_price} aria-label={`Prix unitaire de ${ing?.name ?? 'l’article'}`}
                        onChange={(e) => updateItem(it.id, 'unit_price', parseFloat(e.target.value) || 0)} className={cn(small, 'w-24 text-right')} />
                      €
                    </label>
                    <span className="ml-auto sm:ml-0 sm:w-24 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{euros(it.quantity * it.unit_price)}</span>
                    <button onClick={() => removeItem(it.id)} className={cn(iconBtnDanger, 'hidden sm:inline-flex')} aria-label={`Retirer ${ing?.name ?? 'l’article'}`}><X className="h-4 w-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 && (
          <p className="flex justify-between text-base font-semibold text-gray-900">
            <span>Total HT</span><span className="tabular-nums">{euros(total)}</span>
          </p>
        )}

        <div>
          <label htmlFor="order-notes" className={labelCls}>Notes</label>
          <textarea id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Pour le mariage Dupont du 14 juin, livraison le matin"
            className={cn(inputCls, 'h-auto py-3 resize-none')} />
        </div>

        {error && <p role="alert" className={errorCls}>{error}</p>}
      </div>
    </Modal>
  );
}

// ── Détail d'une commande ────────────────────────────────────────────────────
function OrderDetailsModal({ order, onClose, onPrint }: { order: SupplierOrder; onClose: () => void; onPrint: () => void }) {
  const cfg = STATUS_CONFIG[order.status];
  const items = order.items || [];
  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

  return (
    <Modal
      title={`Commande ${order.supplier?.name ?? ''}`.trim()}
      wide
      onClose={onClose}
      footer={<button onClick={onPrint} className={btnSecondary}><Printer className="h-4 w-4" />Imprimer le bon</button>}
    >
      <div className="space-y-4 pb-3">
        <p className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
          <span className={cn(pill, cfg.cls)}>{cfg.label}</span>
          Créée le {formatDate(order.created_at)}{order.ordered_at && `, envoyée le ${formatDate(order.ordered_at)}`}
        </p>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 px-5 py-6 text-center text-[15px] text-gray-600">Cette commande n’a aucun article.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border-y border-gray-100">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-3">
                <p className="font-medium text-gray-900 flex-1 min-w-[10rem]">{it.ingredient?.name || 'Ingrédient supprimé'}</p>
                <span className="text-sm text-gray-500 tabular-nums">{num(it.quantity)} {it.ingredient?.unit || ''} à {euros(it.unit_price)}</span>
                <span className="w-24 text-right font-semibold text-gray-900 tabular-nums">{euros(it.quantity * it.unit_price)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex justify-between text-base font-semibold text-gray-900">
          <span>Total HT</span><span className="tabular-nums">{euros(total)}</span>
        </p>
        {order.notes && <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">{order.notes}</p>}
      </div>
    </Modal>
  );
}
