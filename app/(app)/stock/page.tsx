'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Search, Loader2, Package, History, TrendingUp, TrendingDown, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn, formatCurrency } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, cardCls, errorCls, iconBtn, inputCls, labelCls, pill } from '@/components/ui/kit';

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

type Filter = 'all' | 'alert' | 'empty';

/** Quantité suivie de son unité, avec la virgule française. */
const qty = (n: number, unit: string | null) => `${n.toLocaleString('fr-FR')}${unit ? ` ${unit}` : ''}`;

const smallBtn =
  'inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-800 hover:border-gray-300 transition-colors';

export default function StockPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [movementModal, setMovementModal] = useState<{ open: boolean; ingredient: Ingredient | null; type: 'in' | 'out' | 'adjust' }>({ open: false, ingredient: null, type: 'in' });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; ingredient: Ingredient | null; movements: Movement[] }>({ open: false, ingredient: null, movements: [] });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data, error: err } = await supabase.from('ingredients')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order('name');
    if (err) setError('Le stock n’a pas pu être chargé. Rechargez la page.');
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
    const { data, error: err } = await supabase.from('stock_movements')
      .select('*')
      .eq('ingredient_id', ing.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (err) { setError('L’historique n’a pas pu être chargé. Réessayez.'); return; }
    setHistoryModal({ open: true, ingredient: ing, movements: (data as Movement[]) ?? [] });
  };

  const FILTERS: [Filter, string][] = [
    ['all', 'Tous'],
    ['alert', `Stock bas${lowStockCount ? ` (${lowStockCount})` : ''}`],
    ['empty', `Épuisés${emptyCount ? ` (${emptyCount})` : ''}`],
  ];

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Stock</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading ? ' ' : `${totalIngredients} ingrédient${totalIngredients > 1 ? 's' : ''}, ${formatCurrency(totalValue)} en réserve`}
        </p>
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un ingrédient"
            aria-label="Rechercher un ingrédient" className={cn(inputCls, 'pl-11')} />
        </div>
        <div className="flex p-1 rounded-xl bg-gray-200/70 overflow-x-auto scrollbar-none" role="tablist" aria-label="Ingrédients affichés">
          {FILTERS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
              className={cn('flex-1 lg:flex-none flex-shrink-0 h-10 px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="w-11 h-11 bg-gray-100 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/4" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">
            {search ? 'Aucun ingrédient ne correspond' : filter === 'alert' ? 'Aucun ingrédient en stock bas' : filter === 'empty' ? 'Aucun ingrédient épuisé' : 'Aucun ingrédient'}
          </p>
          <p className="text-sm text-gray-500 max-w-sm">
            {search ? 'Essayez un autre mot.' : filter === 'all' ? 'Créez vos ingrédients dans la page Ingrédients pour suivre leur stock ici.' : 'Tout est au-dessus du seuil d’alerte.'}
          </p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((ing) => {
            const stock = ing.stock_quantity ?? 0;
            const alert = ing.min_stock_alert ?? 0;
            const isAlert = alert > 0 && stock <= alert;
            const isEmpty = stock <= 0;
            return (
              <li key={ing.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0 basis-full sm:basis-auto">
                  {ing.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ing.image_url} alt="" loading="lazy" decoding="async" className="w-11 h-11 object-contain rounded-xl flex-shrink-0 bg-gray-50" />
                  ) : (
                    <span className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-gray-400" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{ing.name}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {[ing.category, alert > 0 ? `seuil ${qty(alert, ing.unit)}` : null].filter(Boolean).join(', ') || 'Sans catégorie'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn('font-display text-lg font-bold tabular-nums leading-tight', isEmpty ? 'text-gray-500' : 'text-gray-900')}>
                      {qty(stock, ing.unit)}
                    </p>
                    {isEmpty ? <span className={cn(pill, 'bg-danger/10 text-danger')}>Épuisé</span>
                      : isAlert ? <span className={cn(pill, 'bg-primary-50 text-primary-700')}>Stock bas</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto pl-14 sm:pl-2">
                  <button onClick={() => setMovementModal({ open: true, ingredient: ing, type: 'in' })} className={cn(smallBtn, 'flex-1 sm:flex-none')}
                    aria-label={`Entrée en stock : ${ing.name}`}>
                    <Plus className="h-4 w-4" />Entrée
                  </button>
                  <button onClick={() => setMovementModal({ open: true, ingredient: ing, type: 'out' })} className={cn(smallBtn, 'flex-1 sm:flex-none')}
                    aria-label={`Sortie de stock : ${ing.name}`}>
                    <Minus className="h-4 w-4" />Sortie
                  </button>
                  <button onClick={() => openHistory(ing)} className={iconBtn} aria-label={`Historique de ${ing.name}`} title="Historique">
                    <History className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {movementModal.open && movementModal.ingredient && (
        <MovementModal
          ingredient={movementModal.ingredient}
          type={movementModal.type}
          userId={user?.id}
          onClose={() => setMovementModal({ open: false, ingredient: null, type: 'in' })}
          onDone={() => { setMovementModal({ open: false, ingredient: null, type: 'in' }); fetchAll(); }}
        />
      )}

      {historyModal.open && historyModal.ingredient && (
        <Modal title={`Historique : ${historyModal.ingredient.name}`} onClose={() => setHistoryModal({ open: false, ingredient: null, movements: [] })}>
          {historyModal.movements.length === 0 ? (
            <p className="text-[15px] text-gray-600 text-center py-8">Aucun mouvement enregistré pour cet ingrédient.</p>
          ) : (
            <ul className="divide-y divide-gray-100 pb-3">
              {historyModal.movements.map((m) => {
                const Icon = m.movement_type === 'in' ? TrendingUp : m.movement_type === 'out' ? TrendingDown : Check;
                const label = m.movement_type === 'in' ? 'Entrée' : m.movement_type === 'out' ? 'Sortie' : 'Inventaire';
                const sign = m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '−' : '';
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <span className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      m.movement_type === 'in' ? 'bg-sage-100 text-sage' : 'bg-gray-100 text-gray-700')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 tabular-nums">{label} {sign}{qty(m.quantity, historyModal.ingredient?.unit ?? null)}</p>
                      {m.reason && <p className="text-sm text-gray-500 truncate">{m.reason}</p>}
                    </div>
                    <p className="text-sm text-gray-500 flex-shrink-0">{new Date(m.created_at).toLocaleDateString('fr-FR')}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
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
  const [error, setError] = useState<string | null>(null);
  const current = ingredient.stock_quantity ?? 0;
  const entered = parseFloat(quantity);

  const save = async () => {
    if (!userId || !quantity) return;
    const q = parseFloat(quantity);
    if (!(q > 0)) { setError('Indiquez une quantité supérieure à 0.'); return; }
    // Garde-fou : une sortie ne peut pas dépasser le stock disponible (évite un stock négatif).
    if (type === 'out' && q > current) {
      setError(`Stock insuffisant : ${qty(current, ingredient.unit)} disponible${current > 1 ? 's' : ''}. Vous ne pouvez pas sortir ${qty(q, ingredient.unit)}.`);
      return;
    }
    setSaving(true); setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from('stock_movements').insert({
      user_id: userId,
      ingredient_id: ingredient.id,
      movement_type: type,
      quantity: parseFloat(quantity),
      reason: reason || null,
    });
    setSaving(false);
    if (err) { setError('Le mouvement n’a pas pu être enregistré. Réessayez.'); return; }
    onDone();
  };

  const title = { in: 'Entrée en stock', out: 'Sortie de stock', adjust: 'Inventaire' }[type];
  const after = !Number.isFinite(entered) ? null : type === 'in' ? current + entered : type === 'out' ? current - entered : entered;

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={btnGhost}>Annuler</button>
        <button onClick={save} disabled={saving || !quantity} className={btnPrimary}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Valider
        </button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4 pb-3">
        <p className="text-[15px] font-semibold text-gray-900">{ingredient.name}</p>
        <div>
          <label htmlFor="mv-qty" className={labelCls}>Quantité ({ingredient.unit || 'unité'})</label>
          <input id="mv-qty" autoFocus type="number" inputMode="decimal" min={0} step={0.01} value={quantity}
            onChange={(e) => setQuantity(e.target.value)} placeholder={type === 'adjust' ? 'Nouveau stock total' : '10'} className={inputCls} />
          <p className="text-sm text-gray-500 mt-2">
            Stock actuel : {qty(current, ingredient.unit)}.
            {after !== null && ` Après : ${qty(Math.round(after * 100) / 100, ingredient.unit)}.`}
          </p>
        </div>
        <div>
          <label htmlFor="mv-reason" className={labelCls}>Raison (facultatif)</label>
          <input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}
            placeholder={type === 'in' ? 'Livraison du fournisseur' : type === 'out' ? 'Mariage Dupont' : 'Inventaire du mois'} />
        </div>
        {error && <p role="alert" className={errorCls}>{error}</p>}
      </form>
    </Modal>
  );
}
