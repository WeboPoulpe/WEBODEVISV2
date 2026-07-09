'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Boxes, AlertTriangle, TrendingUp, TrendingDown, Plus, Minus,
  Search, Loader2, Package, History, X, Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  image_url: string | null;
  stock_quantity: number | null;
  min_stock_alert: number | null;
  volume_unit_price: number | null;
}

interface Movement {
  id: string;
  ingredient_id: string;
  movement_type: 'in' | 'out' | 'adjust';
  quantity: number;
  reason: string | null;
  created_at: string;
}

export default function StockPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'alert' | 'empty'>('all');
  const [movementModal, setMovementModal] = useState<{ open: boolean; ingredient: Ingredient | null; type: 'in' | 'out' | 'adjust' }>({ open: false, ingredient: null, type: 'in' });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; ingredient: Ingredient | null; movements: Movement[] }>({ open: false, ingredient: null, movements: [] });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase.from('ingredients')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name');
    setIngredients((data as Ingredient[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = ingredients.filter((i) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const stock = i.stock_quantity ?? 0;
    const alert = i.min_stock_alert ?? 0;
    const matchFilter =
      filter === 'all' ? true :
      filter === 'alert' ? (alert > 0 && stock <= alert) :
      stock <= 0;
    return matchSearch && matchFilter;
  });

  const totalIngredients = ingredients.length;
  const lowStockCount = ingredients.filter((i) => (i.min_stock_alert ?? 0) > 0 && (i.stock_quantity ?? 0) <= (i.min_stock_alert ?? 0)).length;
  const emptyCount = ingredients.filter((i) => (i.stock_quantity ?? 0) <= 0).length;
  const totalValue = ingredients.reduce((sum, i) => sum + ((i.stock_quantity ?? 0) * (i.volume_unit_price ?? 0)), 0);

  const openHistory = async (ing: Ingredient) => {
    const supabase = createClient();
    const { data } = await supabase.from('stock_movements')
      .select('*')
      .eq('ingredient_id', ing.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistoryModal({ open: true, ingredient: ing, movements: (data as Movement[]) ?? [] });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <Boxes className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-base">Gestion du stock</h1>
              <p className="text-xs text-gray-500">{totalIngredients} ingrédients · {totalValue.toFixed(0)} € de stock</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Total</p>
            <p className="text-lg font-bold text-blue-900">{totalIngredients}</p>
          </div>
          <button onClick={() => setFilter('alert')} className={cn('text-left rounded-xl p-3 border transition-all', filter === 'alert' ? 'bg-amber-100 border-amber-400' : 'bg-amber-50 border-amber-200 hover:bg-amber-100')}>
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Stock bas</p>
            <p className="text-lg font-bold text-amber-900">{lowStockCount}</p>
          </button>
          <button onClick={() => setFilter('empty')} className={cn('text-left rounded-xl p-3 border transition-all', filter === 'empty' ? 'bg-red-100 border-red-400' : 'bg-red-50 border-red-200 hover:bg-red-100')}>
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Épuisé</p>
            <p className="text-lg font-bold text-red-900">{emptyCount}</p>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un ingrédient…"
              className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
            />
          </div>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="text-xs text-gray-500 hover:text-gray-700">Tous</button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aucun ingrédient {filter === 'alert' ? 'en alerte' : filter === 'empty' ? 'épuisé' : 'trouvé'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((ing) => {
              const stock = ing.stock_quantity ?? 0;
              const alert = ing.min_stock_alert ?? 0;
              const isAlert = alert > 0 && stock <= alert;
              const isEmpty = stock <= 0;
              return (
                <div key={ing.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    {ing.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ing.image_url} alt={ing.name} className="w-12 h-12 object-contain rounded-lg flex-shrink-0 bg-gray-50" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ing.name}</p>
                      <p className="text-[10px] text-gray-400">{ing.category || '—'}</p>
                      <div className="flex items-baseline gap-1 mt-1.5">
                        <span className={cn('text-lg font-bold tabular-nums', isEmpty ? 'text-red-600' : isAlert ? 'text-amber-600' : 'text-gray-900')}>
                          {stock}
                        </span>
                        <span className="text-xs text-gray-500">{ing.unit || ''}</span>
                        {isEmpty && <span className="ml-1 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">ÉPUISÉ</span>}
                        {isAlert && !isEmpty && <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">BAS</span>}
                      </div>
                      {alert > 0 && !isEmpty && !isAlert && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Seuil: {alert}{ing.unit || ''}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => setMovementModal({ open: true, ingredient: ing, type: 'in' })} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Entrée stock">
                      <Plus className="h-3.5 w-3.5" />Entrée
                    </button>
                    <button onClick={() => setMovementModal({ open: true, ingredient: ing, type: 'out' })} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sortie stock">
                      <Minus className="h-3.5 w-3.5" />Sortie
                    </button>
                    <button onClick={() => openHistory(ing)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Historique">
                      <History className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Movement Modal */}
      {movementModal.open && movementModal.ingredient && (
        <MovementModal
          ingredient={movementModal.ingredient}
          type={movementModal.type}
          userId={user?.id}
          onClose={() => setMovementModal({ open: false, ingredient: null, type: 'in' })}
          onDone={() => { setMovementModal({ open: false, ingredient: null, type: 'in' }); fetchAll(); }}
        />
      )}

      {/* History Modal */}
      {historyModal.open && historyModal.ingredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryModal({ open: false, ingredient: null, movements: [] })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#9c27b0]" />
                <h2 className="font-semibold text-sm">Historique — {historyModal.ingredient.name}</h2>
              </div>
              <button onClick={() => setHistoryModal({ open: false, ingredient: null, movements: [] })} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {historyModal.movements.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">Aucun mouvement enregistré</p>
              ) : historyModal.movements.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-lg">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    m.movement_type === 'in' ? 'bg-emerald-100' : m.movement_type === 'out' ? 'bg-red-100' : 'bg-blue-100')}>
                    {m.movement_type === 'in' ? <TrendingUp className="h-4 w-4 text-emerald-600" /> :
                     m.movement_type === 'out' ? <TrendingDown className="h-4 w-4 text-red-600" /> :
                     <Check className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '-' : '='}{m.quantity}{historyModal.ingredient?.unit || ''}
                    </p>
                    {m.reason && <p className="text-[10px] text-gray-500 truncate">{m.reason}</p>}
                  </div>
                  <p className="text-[10px] text-gray-400 flex-shrink-0">
                    {new Date(m.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MovementModal({ ingredient, type, userId, onClose, onDone }: {
  ingredient: Ingredient; type: 'in' | 'out' | 'adjust'; userId: string | undefined;
  onClose: () => void; onDone: () => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!userId || !quantity) return;
    const qty = parseFloat(quantity);
    if (!(qty > 0)) { alert('La quantité doit être un nombre supérieur à 0.'); return; }
    // Garde-fou : une sortie ne peut pas dépasser le stock disponible (évite un stock négatif).
    if (type === 'out' && qty > (ingredient.stock_quantity ?? 0)) {
      alert(`Stock insuffisant : ${ingredient.stock_quantity ?? 0}${ingredient.unit || ''} disponible(s), sortie de ${qty}${ingredient.unit || ''} demandée.`);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('stock_movements').insert({
      user_id: userId,
      ingredient_id: ingredient.id,
      movement_type: type,
      quantity: parseFloat(quantity),
      reason: reason || null,
    });
    setSaving(false);
    if (error) { alert('Erreur: ' + error.message); return; }
    onDone();
  };

  const labelByType = { in: 'Entrée stock', out: 'Sortie stock', adjust: 'Ajustement stock' };
  const colorByType = { in: 'emerald', out: 'red', adjust: 'blue' };
  const c = colorByType[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className={cn('p-2 rounded-xl', c === 'emerald' ? 'bg-emerald-50' : c === 'red' ? 'bg-red-50' : 'bg-blue-50')}>
              {type === 'in' ? <Plus className={`h-4 w-4 text-${c}-600`} /> : type === 'out' ? <Minus className={`h-4 w-4 text-${c}-600`} /> : <Check className={`h-4 w-4 text-${c}-600`} />}
            </div>
            <div>
              <h2 className="font-semibold text-sm">{labelByType[type]}</h2>
              <p className="text-[10px] text-gray-400">{ingredient.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Quantité ({ingredient.unit || 'unité'})
            </label>
            <input
              autoFocus
              type="number"
              min={0}
              step={0.01}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === 'adjust' ? 'Nouveau stock total' : '10'}
              className="w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Stock actuel : {ingredient.stock_quantity ?? 0}{ingredient.unit || ''}
              {type === 'in' && quantity && ` → ${(ingredient.stock_quantity ?? 0) + parseFloat(quantity)}`}
              {type === 'out' && quantity && ` → ${(ingredient.stock_quantity ?? 0) - parseFloat(quantity)}`}
              {type === 'adjust' && quantity && ` → ${parseFloat(quantity)}`}
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Raison (optionnel)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === 'in' ? 'Livraison fournisseur X' : type === 'out' ? 'Consommation event Y' : 'Inventaire'}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={save} disabled={saving || !quantity} className={cn('flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50',
            c === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : c === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
