'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, UtensilsCrossed, CheckCircle2, Calculator, ShoppingCart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  unit: string | null;
}

interface EventIngredient {
  id: string;
  quantity: number;
  unit: string | null;
  checked: boolean;
  ingredient: Ingredient;
}

interface QuoteMeta {
  client_name: string;
  event_date: string | null;
}

// ── Category color map ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Crèmerie':         'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Épicerie':         'bg-orange-100 text-orange-700 border-orange-200',
  'Viandes':          'bg-red-100 text-red-700 border-red-200',
  'Poissons':         'bg-blue-100 text-blue-700 border-blue-200',
  'Fruits & Légumes': 'bg-green-100 text-green-700 border-green-200',
  'Boissons':         'bg-purple-100 text-purple-700 border-purple-200',
};

function categoryColor(cat: string | null) {
  if (!cat) return 'bg-gray-100 text-gray-600 border-gray-200';
  return CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const { id } = useParams<{ id: string }>();

  const [meta, setMeta]       = useState<QuoteMeta | null>(null);
  const [items, setItems]     = useState<EventIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Load quote meta + ingredients
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from('quotes')
        .select('client_name, event_date')
        .eq('id', id)
        .single(),
      supabase
        .from('event_ingredients')
        .select('id, quantity, unit, checked, ingredient:ingredients(id, name, category, image_url, unit)')
        .eq('quote_id', id)
        .order('created_at'),
    ]).then(([{ data: q }, { data: ei }]) => {
      setMeta(q as QuoteMeta | null);
      setItems((ei ?? []) as unknown as EventIngredient[]);
      setLoading(false);
    });
  }, [id]);

  const [computing, setComputing] = useState(false);

  // Auto-compute needs from prestations.service_ingredients × guest_count
  const autoComputeAndCreateOrders = useCallback(async () => {
    if (!confirm('Calculer automatiquement les besoins depuis les prestations du devis et créer les commandes fournisseurs ?')) return;
    setComputing(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setComputing(false); return; }

    // Fetch quote with services + guest_count
    const { data: q } = await supabase.from('quotes').select('services, guest_count').eq('id', id).single();
    if (!q || !Array.isArray(q.services)) { alert('Aucune prestation dans ce devis'); setComputing(false); return; }
    const guestCount = q.guest_count ?? 1;

    // Fetch all prestations with their service_ingredients
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const presNames = q.services.filter((s: any) => s.name && !s.isPageBreak).map((s: any) => s.name);
    if (presNames.length === 0) { alert('Aucune prestation valide'); setComputing(false); return; }

    const { data: prestations } = await supabase.from('prestations')
      .select('id, name, service_ingredients(ingredient_id, qty_per_person, ingredient:ingredients(id, name, unit, preferred_supplier_id, volume_unit_price))')
      .in('name', presNames);

    // Agrégation par ingrédient : quantité = qty_per_person × nombre de convives.
    // (Formule unique, alignée sur la page Événement — on NE multiplie PAS par la
    //  quantité de la ligne de prestation, qui encode déjà souvent le nb de convives.)
    const needsByIng: Record<string, { ingredient_id: string; quantity: number; supplier_id: string | null; unit_price: number }> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prestations || []).forEach((p: any) => {
      // On ne compte chaque prestation qu'une fois, même si présente plusieurs fois dans le devis.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isInQuote = q.services.some((s: any) => s.name === p.name && !s.isPageBreak);
      if (!isInQuote) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p.service_ingredients || []).forEach((si: any) => {
        const qty = (si.qty_per_person || 0) * guestCount;
        if (qty <= 0) return;
        const ing = si.ingredient;
        if (!ing) return;
        if (!needsByIng[ing.id]) {
          needsByIng[ing.id] = {
            ingredient_id: ing.id,
            quantity: 0,
            supplier_id: ing.preferred_supplier_id || null,
            unit_price: ing.volume_unit_price ?? 0,
          };
        }
        needsByIng[ing.id].quantity += qty;
      });
    });

    const allNeeds = Object.values(needsByIng);
    if (allNeeds.length === 0) {
      alert('Aucun ingrédient n\'a de quantité par invité définie. Va dans Prestations → édite une prestation → ajoute les ingrédients avec une quantité par invité.');
      setComputing(false);
      return;
    }

    // Group by supplier
    const bySupplier: Record<string, typeof allNeeds> = {};
    allNeeds.forEach((n) => {
      const key = n.supplier_id || 'no-supplier';
      if (!bySupplier[key]) bySupplier[key] = [];
      bySupplier[key].push(n);
    });

    let createdCount = 0;
    let skippedCount = 0;
    for (const [supId, needs] of Object.entries(bySupplier)) {
      if (supId === 'no-supplier') {
        skippedCount += needs.length;
        continue;
      }
      const total = needs.reduce((s, n) => s + n.quantity * n.unit_price, 0);
      const { data: order } = await supabase.from('supplier_orders').insert({
        user_id: user.id,
        supplier_id: supId,
        event_id: id,
        status: 'draft',
        total_amount: total,
        notes: `Auto-calculé depuis l'événement (${guestCount} invités)`,
      }).select('id').single();
      if (order) {
        await supabase.from('supplier_order_items').insert(needs.map((n) => ({
          order_id: order.id,
          ingredient_id: n.ingredient_id,
          quantity: n.quantity,
          unit_price: n.unit_price,
        })));
        createdCount++;
      }
    }

    setComputing(false);
    alert(`✅ ${createdCount} commande(s) créée(s) en brouillon.${skippedCount > 0 ? `\n⚠️ ${skippedCount} ingrédient(s) sans fournisseur préféré ignoré(s).` : ''}\n\nVoir page Commandes.`);
  }, [id]);

  // Toggle checked state (optimistic + persist)
  const toggle = useCallback(async (itemId: string) => {
    setItems((prev) =>
      prev.map((i) => i.id === itemId ? { ...i, checked: !i.checked } : i)
    );
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const supabase = createClient();
    await supabase
      .from('event_ingredients')
      .update({ checked: !item.checked })
      .eq('id', itemId);
  }, [items]);

  // Derive categories
  const categories = Array.from(
    new Set(items.map((i) => i.ingredient.category ?? 'Divers'))
  ).sort();

  // Filtered + grouped items
  const filtered = activeCategory
    ? items.filter((i) => (i.ingredient.category ?? 'Divers') === activeCategory)
    : items;

  const groups = filtered.reduce<Record<string, EventIngredient[]>>((acc, item) => {
    const key = item.ingredient.category ?? 'Divers';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const doneCount  = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const displayDate = meta?.event_date
    ? new Date(meta.event_date + 'T00:00:00').toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long',
      })
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 pt-4 pb-3 space-y-3">
          {/* Back + title */}
          <div className="flex items-center gap-3">
            <Link
              href={`/evenements/${id}`}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">
                {meta?.client_name ?? 'Courses'}
              </h1>
              {displayDate && (
                <p className="text-xs text-[#9c27b0] font-medium">{displayDate}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-[#9c27b0]">{pct}%</p>
              <p className="text-xs text-gray-400">{doneCount}/{totalCount}</p>
            </div>
            <button
              onClick={autoComputeAndCreateOrders}
              disabled={computing}
              title="Calculer auto les besoins depuis les prestations + créer les commandes par fournisseur"
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
            >
              {computing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Calcul auto + commandes</span>
            </button>
            <Link href="/commandes" title="Voir toutes les commandes" className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl">
              <ShoppingCart className="h-4 w-4" />
            </Link>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-[#9c27b0] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* Category filter chips (horizontal scroll) */}
          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className={[
                  'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  activeCategory === null
                    ? 'bg-[#9c27b0] text-white border-[#9c27b0]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                ].join(' ')}
              >
                Tout
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                  className={[
                    'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                    activeCategory === cat
                      ? 'bg-[#9c27b0] text-white border-[#9c27b0]'
                      : `${categoryColor(cat)} hover:opacity-80`,
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-6">
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UtensilsCrossed className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun ingrédient dans la liste.</p>
            <p className="text-xs text-gray-400 mt-1">
              Ajoutez des ingrédients depuis l&apos;onglet{' '}
              <Link href={`/evenements/${id}`} className="text-[#9c27b0] hover:underline">
                Prépa & Achats
              </Link>.
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([cat, groupItems]) => (
            <div key={cat}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryColor(cat)}`}>
                  {cat}
                </span>
                <span className="text-xs text-gray-400">
                  {groupItems.filter((i) => i.checked).length}/{groupItems.length}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2.5">
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={[
                      'w-full flex items-center gap-3 bg-white border rounded-2xl p-3 text-left transition-all active:scale-[0.98]',
                      item.checked
                        ? 'border-gray-100 opacity-50'
                        : 'border-gray-200 shadow-sm hover:shadow-md',
                    ].join(' ')}
                  >
                    {/* Photo */}
                    {item.ingredient.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.ingredient.image_url}
                        alt=""
                        className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <UtensilsCrossed className="h-7 w-7 text-gray-300" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={[
                        'text-base font-semibold leading-tight',
                        item.checked ? 'line-through text-gray-400' : 'text-gray-900',
                      ].join(' ')}>
                        {item.ingredient.name}
                      </p>
                      <p className="text-sm text-[#9c27b0] font-medium mt-0.5">
                        {item.quantity} {item.unit ?? item.ingredient.unit ?? ''}
                      </p>
                    </div>

                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {item.checked ? (
                        <CheckCircle2 className="h-7 w-7 text-[#9c27b0]" />
                      ) : (
                        <div className="h-7 w-7 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}

        {/* All done celebration */}
        {totalCount > 0 && doneCount === totalCount && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-base font-bold text-gray-900">Tout est prêt !</p>
            <p className="text-sm text-gray-500 mt-1">Tous les ingrédients sont cochés.</p>
          </div>
        )}
      </div>
    </div>
  );
}
