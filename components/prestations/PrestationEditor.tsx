'use client';

import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Carrot, Check, Loader2, Plus, Search, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import PrestationQuotePreview, { PREVIEW_TEMPLATES, type PreviewTemplate } from '@/components/prestations/PrestationQuotePreview';
import PrestationCarteSection from '@/components/prestations/PrestationCarteSection';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { createClient } from '@/lib/supabase/client';
import { isBlankHtml } from '@/lib/prestationCard';
import { sanitizeHtml } from '@/lib/sanitize';
import { PENDING_STATUSES } from '@/lib/quoteStatus';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { usePrestationCategories } from '@/hooks/usePrestationCategories';
import AllergenPicker from '@/components/allergens/AllergenPicker';
import { ALLERGEN_LABELS, ingredientAllergens, prestationAllergens, sortAllergens, type AllergenKey } from '@/lib/allergens';
import RecipeCostPanel from '@/components/costing/RecipeCostPanel';
import { defaultRecipeUnit, margin as computeMargin, recipeUnits } from '@/lib/costing';

// Page d'une prestation du catalogue : création (/prestations/nouvelle) et modification (/prestations/[id]).
// Grand écran : le formulaire à gauche, l'aperçu dans un devis à droite (colonne collante).
// Plus étroit (petit portable, tablette, téléphone) : une colonne, avec deux onglets « Modifier » et « Aperçu ».
// La mise en page suit la largeur réellement disponible (requête de conteneur), barre latérale ouverte ou repliée.
// En bas, une barre d'actions toujours visible ; quitter avec des modifications non enregistrées demande confirmation.

export interface PrestationRecord {
  id: string;
  name: string;
  unit_price: number;
  cost_price?: number | null;
  child_unit_price?: number | null;
  category: string | null;
  sub_category: string | null;
  category_id: string | null;
  sub_category_id: string | null;
  description: string | null;
  is_option: boolean;
  gastro_card_html?: string | null;
  gastro_card_html_en?: string | null;
  /** Absents tant que la migration 0020 n'est pas appliquée. */
  allergens_extra?: string[] | null;
  allergens_checked?: boolean | null;
}

interface IngredientLink {
  id: string;
  ingredient_id: string;
  qty_per_person: number;
  unit: string | null;
  ingredient: { id: string; name: string; unit: string | null; allergens?: string[] | null };
}

/** Ingrédient de la recette, tel que le calcul des allergènes le lit. */
type RecipeItem = { name: string; allergens: string[] | null | undefined; /** Quantité et unité, pour refaire le coût matière. */ amount?: string };

// Sélection des liens de la recette. Sans la colonne des allergènes (migration pas encore appliquée), on s'en passe.
const LINK_SELECT = 'id, ingredient_id, qty_per_person, unit, ingredient:ingredients(id, name, unit, allergens)';
const LINK_SELECT_OLD = 'id, ingredient_id, qty_per_person, unit, ingredient:ingredients(id, name, unit)';

interface IngredientOption {
  id: string;
  name: string;
  unit: string | null;
}

/** Fiche mise en page enregistrée : null si absente ou vide. */
const cardOf = (html: string | null | undefined) => (html && !isBlankHtml(html) ? html : null);

/** Retour à la liste : elle reprend son filtre et sa position ; `maj` y met la prestation enregistrée en évidence. */
export const LIST_BACK = '/prestations?retour=1';
const listAfterSave = (id: string) => `/prestations?maj=${encodeURIComponent(id)}`;

// ── Montants saisis ───────────────────────────────────────────────────────────
/** Lit un montant tapé (« 14,50 », « 14.5 », « 1 200 € ») : null si vide, NaN si illisible. */
const parseAmount = (v: string): number | null => {
  const t = v.replace(/[\s  €]/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
/** Montant affiché dans un champ, à la française (virgule) ; vide si absent. */
const amountField = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));
const cents = (n: number) => Math.round(n * 100) / 100;

/** Champ de prix : clavier numérique sur téléphone, virgule acceptée, euro affiché dans le champ. */
function PriceField({ id, label, value, onChange, error, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative">
        <input
          id={id} value={value} inputMode="decimal" autoComplete="off" placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
          className={cn(inputCls, 'pr-9 tabular-nums', error && 'border-danger focus:border-danger')}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" aria-hidden>€</span>
      </div>
      {error && <p id={`${id}-error`} className="text-sm text-danger mt-1.5">{error}</p>}
    </div>
  );
}

/** Section de la page : une carte, un titre, un texte d'aide facultatif. */
function Section({ title, hint, children, id }: { title: string; hint?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className={cn(cardCls, 'p-5 sm:p-6')} aria-labelledby={id}>
      <h2 id={id} className="text-[17px] font-semibold text-gray-900">{title}</h2>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

// ── Ingrédients liés (modification seulement) ────────────────────────────────
/** Unités proposées pour un ingrédient, en gardant celle déjà enregistrée si elle sort de la liste. */
const unitChoices = (ingredientUnit: string | null, current: string | null | undefined) => {
  const list = recipeUnits(ingredientUnit);
  return current && !list.includes(current) ? [current, ...list] : list;
};

/** Quantité et unité côte à côte : « 150 » « g ». */
function QtyUnitFields({ id, qty, unit, units, onQty, onUnit, onEnter, autoFocus }: {
  id: string; qty: string; unit: string; units: string[];
  onQty: (v: string) => void; onUnit: (v: string) => void; onEnter: () => void; autoFocus?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        id={id} inputMode="decimal" value={qty} placeholder="150" autoFocus={autoFocus}
        onChange={(e) => onQty(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
        className={cn(inputCls, 'w-24 h-10')}
      />
      {units.length > 1 ? (
        <select value={unit} onChange={(e) => onUnit(e.target.value)} aria-label="Unité" className={cn(inputCls, 'w-auto h-10 pr-8')}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      ) : (
        <span className="text-gray-700">{units[0]}</span>
      )}
      <span className="text-sm text-gray-500 whitespace-nowrap">/ pers.</span>
    </span>
  );
}

function IngredientsSection({ prestationId, userId, onRecipe }: {
  prestationId: string; userId: string;
  /** Recette à jour, pour le calcul des allergènes. */
  onRecipe: (items: RecipeItem[]) => void;
}) {
  const [links, setLinks] = useState<IngredientLink[]>([]);
  const [linkSelect, setLinkSelect] = useState(LINK_SELECT);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [selected, setSelected] = useState<IngredientOption | null>(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [saving, setSaving] = useState(false);
  /** Lien en cours de modification (quantité et unité). */
  const [editing, setEditing] = useState<{ id: string; qty: string; unit: string; saving: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    const supabase = createClient();
    let res = await supabase.from('service_ingredients').select(LINK_SELECT).eq('service_id', prestationId);
    if (res.error) {
      res = await supabase.from('service_ingredients').select(LINK_SELECT_OLD).eq('service_id', prestationId);
      if (!res.error) setLinkSelect(LINK_SELECT_OLD);
    }
    setLinks((res.data ?? []) as unknown as IngredientLink[]);
    setLoadingLinks(false);
  }, [prestationId]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  // La recette change (chargement, ajout, retrait) : le calcul des allergènes suit.
  useEffect(() => {
    if (!loadingLinks) onRecipe(links.map((l) => ({ name: l.ingredient.name, allergens: l.ingredient.allergens, amount: `${l.qty_per_person} ${l.unit ?? ''}` })));
  }, [links, loadingLinks, onRecipe]);

  useEffect(() => {
    if (!showAdd || search.trim().length < 2) { setOptions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from('ingredients')
        .select('id, name, unit')
        .ilike('name', `%${search}%`)
        .limit(10);
      setOptions((data ?? []) as IngredientOption[]);
    }, 250);
    return () => clearTimeout(t);
  }, [search, showAdd, userId]);

  const pick = (o: IngredientOption) => {
    setSelected(o); setSearch(o.name); setOptions([]);
    setUnit(defaultRecipeUnit(o.unit)); setQty('');
  };

  const addLink = async () => {
    if (!selected) return;
    const amount = parseAmount(qty);
    if (amount == null || Number.isNaN(amount) || amount <= 0) { setError('Indiquez la quantité par personne (par exemple 150).'); return; }
    setSaving(true); setError(null);
    const { data, error } = await createClient()
      .from('service_ingredients')
      .insert({ service_id: prestationId, ingredient_id: selected.id, qty_per_person: amount, unit: unit || selected.unit || null, user_id: userId })
      .select(linkSelect)
      .single();
    setSaving(false);
    if (error) { setError('L’ingrédient n’a pas pu être lié. Réessayez.'); return; }
    if (data) setLinks((p) => [...p, data as unknown as IngredientLink]);
    setSelected(null); setSearch(''); setQty(''); setUnit(''); setShowAdd(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const amount = parseAmount(editing.qty);
    if (amount == null || Number.isNaN(amount) || amount <= 0) { setError('Indiquez une quantité par personne supérieure à zéro.'); return; }
    setEditing({ ...editing, saving: true }); setError(null);
    const { error } = await createClient().from('service_ingredients').update({ qty_per_person: amount, unit: editing.unit || null }).eq('id', editing.id);
    if (error) { setEditing({ ...editing, saving: false }); setError('La quantité n’a pas pu être enregistrée. Réessayez.'); return; }
    setLinks((p) => p.map((l) => (l.id === editing.id ? { ...l, qty_per_person: amount, unit: editing.unit || null } : l)));
    setEditing(null);
  };

  const removeLink = async (id: string) => {
    const { error } = await createClient().from('service_ingredients').delete().eq('id', id);
    if (error) { setError('L’ingrédient n’a pas pu être retiré. Réessayez.'); return; }
    setLinks((p) => p.filter((l) => l.id !== id));
  };

  return (
    <Section id="presta-ingredients" title="Ingrédients par personne" hint="Ils servent à calculer les courses des événements qui contiennent cette prestation. Chaque lien est enregistré tout de suite.">
      {loadingLinks ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
      ) : links.length === 0 && !showAdd ? (
        <p className="text-[15px] text-gray-600">Aucun ingrédient lié.</p>
      ) : links.length > 0 && (
        <ul className="space-y-1.5">
          {links.map((l) => editing?.id === l.id ? (
            <li key={l.id} className="flex flex-wrap items-center gap-2 text-[15px] bg-gray-50 rounded-xl px-4 py-2">
              <Carrot className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1 min-w-[8rem] text-gray-900 truncate">{l.ingredient.name}</span>
              <QtyUnitFields
                id={`ing-edit-${l.id}`} qty={editing.qty} unit={editing.unit} units={unitChoices(l.ingredient.unit, l.unit)}
                onQty={(v) => setEditing({ ...editing, qty: v })} onUnit={(v) => setEditing({ ...editing, unit: v })}
                onEnter={saveEdit} autoFocus
              />
              <button type="button" onClick={saveEdit} disabled={editing.saving} className={cn(btnPrimary, 'h-10')}>
                {editing.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}OK
              </button>
              <button type="button" onClick={() => setEditing(null)} className={cn(btnGhost, 'h-10')}>Annuler</button>
            </li>
          ) : (
            <li key={l.id} className="flex items-center gap-2 text-[15px] bg-gray-50 rounded-xl pl-4">
              <Carrot className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="flex-1 min-w-0 text-gray-900 truncate">{l.ingredient.name}</span>
              <button
                type="button"
                onClick={() => { setError(null); setEditing({ id: l.id, qty: String(l.qty_per_person).replace('.', ','), unit: l.unit ?? defaultRecipeUnit(l.ingredient.unit), saving: false }); }}
                className="h-10 px-2 -mr-1 rounded-lg text-gray-700 tabular-nums whitespace-nowrap hover:bg-white hover:text-gray-900 underline decoration-dotted underline-offset-4"
                aria-label={`Modifier la quantité de ${l.ingredient.name}`}
              >
                {String(l.qty_per_person).replace('.', ',')} {l.unit ?? l.ingredient.unit ?? ''} / pers.
              </button>
              <button type="button" onClick={() => removeLink(l.id)} className={iconBtnDanger} aria-label={`Retirer ${l.ingredient.name}`}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAdd ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text" autoFocus
              value={selected ? selected.name : search}
              onChange={(e) => { setSelected(null); setSearch(e.target.value); }}
              placeholder="Rechercher un ingrédient"
              aria-label="Rechercher un ingrédient"
              className={cn(inputCls, 'pl-11')}
            />
          </div>
          {!selected && options.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.id} type="button"
                  onClick={() => pick(o)}
                  className="w-full text-left px-4 min-h-11 py-2 text-[15px] hover:bg-primary-50 transition-colors border-b border-gray-100 last:border-0"
                >
                  {o.name} {o.unit ? <span className="text-gray-500">({o.unit})</span> : null}
                </button>
              ))}
            </div>
          )}
          {!selected && search.trim().length >= 2 && options.length === 0 && (
            <p className="text-sm text-gray-500">Aucun ingrédient de ce nom dans votre liste.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            {selected && (
              <div>
                <label htmlFor="ing-qty" className={labelCls}>Quantité par personne</label>
                <QtyUnitFields id="ing-qty" qty={qty} unit={unit} units={unitChoices(selected.unit, unit)} onQty={setQty} onUnit={setUnit} onEnter={addLink} autoFocus />
              </div>
            )}
            {selected && (
              <button type="button" onClick={addLink} disabled={saving} className={cn(btnPrimary, 'h-12')}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Lier
              </button>
            )}
            <button type="button" onClick={() => { setShowAdd(false); setSelected(null); setSearch(''); }} className={cn(btnGhost, 'h-12')}>Annuler</button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setShowAdd(true)} className={btnSecondary}>
            <Plus className="h-4 w-4" />Lier un ingrédient
          </button>
        </div>
      )}
      {error && <p role="alert" className={errorCls}>{error}</p>}
    </Section>
  );
}

// ── Allergènes ───────────────────────────────────────────────────────────────
function AllergensSection({ recipe, extra, onExtra, checked, onChecked, isNew }: {
  /** null tant que la recette se charge. */
  recipe: RecipeItem[] | null;
  extra: AllergenKey[];
  onExtra: (keys: AllergenKey[]) => void;
  checked: boolean;
  onChecked: (v: boolean) => void;
  isNew: boolean;
}) {
  const items = recipe ?? [];
  const all = prestationAllergens({ name: '', allergens_extra: extra, ingredients: items });
  const fromRecipe = prestationAllergens({ name: '', ingredients: items });
  // Allergènes qui ne viennent que de suggestions par le nom (ni confirmés sur un ingrédient, ni ajoutés à la main).
  const confirmed = new Set<string>(extra);
  for (const ing of items) {
    const r = ingredientAllergens(ing);
    if (!r.suggested) r.keys.forEach((k) => confirmed.add(k));
  }
  const hint = Object.fromEntries(Object.entries(fromRecipe.sources).map(([k, v]) => [k, (v ?? []).join(', ')]));

  return (
    <Section id="presta-allergens" title="Allergènes" hint="Ceux des ingrédients de la recette, et ceux que vous ajoutez à la main.">
      {recipe === null ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {all.keys.length === 0 ? (
            <p className="text-[15px] text-gray-600">Aucun allergène pour le moment.</p>
          ) : (
            <ul className="space-y-1.5" aria-label="Allergènes de la prestation">
              {all.keys.map((k) => {
                const sugg = !confirmed.has(k);
                return (
                  <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={cn(pill, 'border', sugg ? 'border-dashed border-primary-400 bg-white text-primary-800' : 'border-primary-100 bg-primary-50 text-primary-800')}>
                      {ALLERGEN_LABELS[k]}
                    </span>
                    <span className="text-sm text-gray-500 min-w-0">
                      {(all.sources[k] ?? []).join(', ')}{sugg && ' (suggéré d’après le nom)'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {all.hasSuggestions && (
            <p className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-[15px] text-gray-800">
              Certains allergènes sont suggérés d’après le nom des ingrédients : vérifiez-les.
            </p>
          )}

          <div>
            <p className={labelCls}>Ajouter à la main</p>
            <AllergenPicker
              label="Allergènes ajoutés à la main"
              value={extra}
              onChange={onExtra}
              locked={fromRecipe.keys}
              lockedHint={hint}
            />
            <p className="text-sm text-gray-500 mt-2">
              {isNew
                ? 'Une fois la prestation ajoutée, liez ses ingrédients : leurs allergènes viendront s’ajouter ici.'
                : 'Un allergène apporté par un ingrédient reste coché : retirez l’ingrédient ou corrigez-le dans Ingrédients.'}
            </p>
          </div>

          <label className="flex items-center gap-3 min-h-10 cursor-pointer select-none">
            <input
              type="checkbox" checked={checked} onChange={(e) => onChecked(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 accent-primary flex-shrink-0"
            />
            <span className="text-[15px] text-gray-700">J’ai vérifié les allergènes de cette prestation</span>
          </label>
        </>
      )}
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
/** Charge la prestation (ou rien, pour une création), puis affiche le formulaire. */
export default function PrestationEditor({ id }: { id?: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing'; record: PrestationRecord | null }>(
    { status: id ? 'loading' : 'ready', record: null },
  );

  useEffect(() => {
    if (!id || !user) return;
    let alive = true;
    createClient().from('prestations').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (alive) setState({ status: data ? 'ready' : 'missing', record: (data as PrestationRecord | null) ?? null }); });
    return () => { alive = false; };
  }, [id, user]);

  if (state.status === 'loading') {
    return (
      <div className="px-4 md:px-6 pb-8 max-w-[1240px] mx-auto" aria-busy="true">
        <div className="h-5 w-28 bg-gray-100 rounded mb-6 animate-pulse" />
        <div className="h-9 w-2/3 max-w-md bg-gray-100 rounded mb-3 animate-pulse" />
        <div className="h-5 w-40 bg-gray-100 rounded mb-8 animate-pulse" />
        <div className={cn(cardCls, 'h-72 animate-pulse')} />
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <div className="px-4 md:px-6 pb-8 max-w-[1240px] mx-auto">
        <Link href={LIST_BACK} className="inline-flex items-center gap-1.5 h-10 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />Prestations
        </Link>
        <div className={cn(cardCls, 'mt-4 px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900 mb-1">Cette prestation n’existe plus</p>
          <p className="text-sm text-gray-500 mb-5">Elle a peut-être été supprimée. Retrouvez votre catalogue dans Prestations.</p>
          <Link href={LIST_BACK} className={btnPrimary}>Retour aux prestations</Link>
        </div>
      </div>
    );
  }
  return <PrestationForm key={state.record?.id ?? 'nouvelle'} initial={state.record} />;
}

type FieldErrors = { name?: string; price?: string; childPrice?: string; costPrice?: string };

/** Bouton « Nouvelle catégorie », sous le champ : action lisible, cible de 40 px. */
const newBtn = 'mt-1 -ml-2.5 inline-flex items-center gap-1.5 h-10 px-2.5 rounded-xl text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors';

function PrestationForm({ initial }: { initial: PrestationRecord | null }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  // Valeurs d'ouverture : servent à savoir si quelque chose a changé avant de quitter.
  const [startValues, setStartValues] = useState(() => ({
    name: initial?.name ?? '',
    price: amountField(initial?.unit_price),
    childPrice: amountField(initial?.child_unit_price),
    costPrice: initial?.cost_price ? amountField(initial.cost_price) : '',
    categoryId: initial?.category_id ?? '',
    subCategoryId: initial?.sub_category_id ?? '',
    description: initial?.description ?? '',
    cardFr: cardOf(initial?.gastro_card_html),
    cardEn: cardOf(initial?.gastro_card_html_en),
    isOption: initial?.is_option ?? false,
    extra: sortAllergens(initial?.allergens_extra ?? []).join(','),
    checked: !!initial?.allergens_checked,
  }));
  const [name, setName] = useState(startValues.name);
  const [price, setPrice] = useState(startValues.price);
  const [costPrice, setCostPrice] = useState(startValues.costPrice);
  const [childPrice, setChildPrice] = useState(startValues.childPrice);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [subCategory, setSubCategory] = useState(initial?.sub_category ?? '');
  const [categoryId, setCategoryId] = useState<string>(startValues.categoryId);
  const [subCategoryId, setSubCategoryId] = useState<string>(startValues.subCategoryId);
  const { categories: dbCategories, subcategoriesFor, reload: reloadCategories } = usePrestationCategories();
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingSubCat, setCreatingSubCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [catError, setCatError] = useState<string | null>(null);
  const [description, setDescription] = useState(startValues.description);
  const [isOption, setIsOption] = useState(startValues.isOption);
  // Fiches mises en page (française, anglaise) : quand elles existent, elles remplacent nom et description dans la carte.
  const [cardFr, setCardFr] = useState<string | null>(startValues.cardFr);
  const [cardEn, setCardEn] = useState<string | null>(startValues.cardEn);

  // ── Allergènes ─────────────────────────────────────────────────────────────
  // Colonnes présentes en base ? (migration 0020) Une fiche chargée le dit ; une création demande à la base.
  const [allergensReady, setAllergensReady] = useState(initial ? 'allergens_checked' in initial : false);
  useEffect(() => {
    if (initial) return;
    createClient().from('prestations').select('allergens_checked').limit(1).then(({ error }) => setAllergensReady(!error));
  }, [initial]);
  const [extra, setExtra] = useState<AllergenKey[]>(() => sortAllergens(initial?.allergens_extra ?? []));
  /** Recette (null tant qu'elle se charge ; vide pour une création). */
  const [recipe, setRecipe] = useState<RecipeItem[] | null>(initial ? null : []);
  const onRecipe = useCallback((items: RecipeItem[]) => setRecipe(items), []);
  const allergenKeys = prestationAllergens({ name, allergens_extra: extra, ingredients: recipe ?? [] }).keys.join(',');
  const recipeKeys = recipe ? prestationAllergens({ name, ingredients: recipe }).keys.join(',') : null;
  // « Vérifié » vaut pour une liste précise : si la liste change, la case se décoche d'elle-même.
  const [checkedFor, setCheckedFor] = useState<string | null | undefined>(initial ? undefined : null);
  useEffect(() => {
    if (recipe && checkedFor === undefined) setCheckedFor(initial?.allergens_checked ? allergenKeys : null);
  }, [recipe, checkedFor, initial, allergenKeys]);
  const allergensChecked = checkedFor === undefined ? !!initial?.allergens_checked : checkedFor === allergenKeys;
  // La recette s'enregistre à chaque lien : si elle change les allergènes d'une prestation vérifiée, la base le sait tout de suite.
  const recipeStart = useRef<string | null>(null);
  const dbChecked = useRef(!!initial?.allergens_checked);
  useEffect(() => {
    if (recipeKeys === null) return;
    if (recipeStart.current === null) { recipeStart.current = recipeKeys; return; }
    if (recipeKeys === recipeStart.current || !dbChecked.current || !initial || !allergensReady) return;
    dbChecked.current = false;
    createClient().from('prestations').update({ allergens_checked: false }).eq('id', initial.id).then(() => {});
  }, [recipeKeys, initial, allergensReady]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncDrafts, setSyncDrafts] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [tab, setTab] = useState<'form' | 'preview'>('form');
  /** Adresse où aller si la personne confirme qu'elle quitte sans enregistrer. */
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const leaving = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // À la création, le curseur est dans le nom ; à la modification, on ne fait pas surgir le clavier du téléphone.
  useEffect(() => { if (!initial) nameRef.current?.focus(); }, [initial]);

  // Devis en cours qui contiennent cette prestation (par son nom) : on propose de les mettre à jour.
  useEffect(() => {
    if (!initial?.name) return;
    createClient()
      .from('quotes')
      .select('id, services')
      .in('status', PENDING_STATUSES)
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

  const syncDraftQuotes = async (newName: string, newDescription: string, cards: { fr: string | null; en: string | null }) => {
    if (!initial?.name) return;
    const supabase = createClient();
    const { data: drafts } = await supabase
      .from('quotes')
      .select('id, services')
      .in('status', PENDING_STATUSES);
    if (!drafts) return;
    // Prépare les updates puis les exécute en parallèle (au lieu d'un await par devis en série).
    const updates: PromiseLike<unknown>[] = [];
    for (const draft of drafts) {
      if (!Array.isArray(draft.services)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = draft.services.map((s: any) =>
        s.name === initial.name
          ? {
            ...s, name: newName, description: newDescription || null,
            // Le texte de la carte suit aussi (sans ajouter de clé vide aux lignes qui n'en ont pas).
            ...(cards.fr !== null || 'gastroCardHtml' in s ? { gastroCardHtml: cards.fr } : {}),
            ...(cards.en !== null || 'gastroCardHtmlEn' in s ? { gastroCardHtmlEn: cards.en } : {}),
          }
          : s
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changed = updated.some((s: any, i: number) =>
        JSON.stringify(s) !== JSON.stringify(draft.services[i])
      );
      if (changed) {
        updates.push(supabase.from('quotes').update({ services: updated }).eq('id', draft.id));
      }
    }
    await Promise.all(updates);
  };

  const createCategory = async () => {
    if (!user || !newCatName.trim()) return;
    setCatError(null);
    const { data, error } = await createClient().from('prestation_categories').insert({
      user_id: user.id, name: newCatName.trim(),
    }).select().single();
    if (error) { setCatError('La catégorie n’a pas pu être créée. Réessayez.'); return; }
    if (data) {
      await reloadCategories();
      setCategoryId(data.id);
      setSubCategoryId('');
      setCategory(data.name); // sync legacy string field
      setSubCategory('');
    }
    setNewCatName('');
    setCreatingCat(false);
  };

  const createSubCategory = async () => {
    if (!user || !newSubCatName.trim() || !categoryId) return;
    setCatError(null);
    const { data, error } = await createClient().from('prestation_subcategories').insert({
      user_id: user.id, category_id: categoryId, name: newSubCatName.trim(),
    }).select().single();
    if (error) { setCatError('La sous-catégorie n’a pas pu être créée. Réessayez.'); return; }
    if (data) {
      await reloadCategories();
      setSubCategoryId(data.id);
      setSubCategory(data.name);
    }
    setNewSubCatName('');
    setCreatingSubCat(false);
  };

  // ── Prix et marge ──────────────────────────────────────────────────────────
  const priceValue = parseAmount(price);
  const priceOk = priceValue != null && !Number.isNaN(priceValue);
  const costValue = parseAmount(costPrice);
  const margin = priceOk && costValue != null && !Number.isNaN(costValue) && costValue > 0
    ? computeMargin(priceValue!, costValue)
    : null;
  /** Recette lue par le calcul du coût matière : il est refait quand un ingrédient est lié ou retiré. */
  const recipeKey = recipe ? recipe.map((r) => `${r.name}:${r.amount ?? ''}`).join('|') : '';

  const dirty =
    name !== startValues.name || price !== startValues.price || childPrice !== startValues.childPrice ||
    costPrice !== startValues.costPrice || categoryId !== startValues.categoryId || subCategoryId !== startValues.subCategoryId ||
    description !== startValues.description || isOption !== startValues.isOption ||
    cardFr !== startValues.cardFr || cardEn !== startValues.cardEn ||
    (allergensReady && (extra.join(',') !== startValues.extra || allergensChecked !== startValues.checked)) ||
    (creatingCat && !!newCatName.trim()) || (creatingSubCat && !!newSubCatName.trim());

  // Quitter la page avec une saisie non enregistrée : fermeture de l'onglet, rechargement, ou lien de l'application.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (leaving.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const go = (href: string) => { leaving.current = true; router.push(href); };
  const cancel = () => (dirty ? setLeaveTo(LIST_BACK) : go(LIST_BACK));

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = 'Donnez un nom à la prestation.';
    if (priceValue == null) e.price = 'Indiquez le prix unitaire HT, par exemple 14,50.';
    else if (Number.isNaN(priceValue) || priceValue < 0) e.price = 'Ce prix n’est pas un montant valide. Exemple : 14,50.';
    const child = parseAmount(childPrice);
    if (child != null && (Number.isNaN(child) || child < 0)) e.childPrice = 'Montant non valide. Laissez vide si le prix est le même pour tous.';
    if (costValue != null && (Number.isNaN(costValue) || costValue < 0)) e.costPrice = 'Montant non valide. Exemple : 6,20.';
    return e;
  };

  /** Enregistre, puis revient à la liste. */
  const save = async () => {
    if (saving) return;
    const found = validate();
    setErrors(found);
    setSaveError(null);
    const first = (['name', 'price', 'childPrice', 'costPrice'] as const).find((k) => found[k]);
    if (first) {
      setTab('form');
      setTimeout(() => {
        const field = document.getElementById(`presta-${first}`);
        field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        field?.focus({ preventScroll: true });
      }, 0);
      return;
    }
    if (!user) { setSaveError('Votre session n’est pas encore prête. Patientez un instant, puis réessayez.'); return; }
    const child = parseAmount(childPrice);
    // Texte modifié : nettoyé avant d'être enregistré ; un texte vide n'est pas gardé. Inchangé : tel quel.
    const cleanText = (html: string | null) => (html === null || isBlankHtml(html) ? null : sanitizeHtml(html));
    const descriptionOut = description === startValues.description ? (description.trim() || null) : cleanText(description);
    const cardFrOut = cardFr === startValues.cardFr ? cardFr : cleanText(cardFr);
    const cardEnOut = cardEn === startValues.cardEn ? cardEn : cleanText(cardEn);
    const payload = {
      name: name.trim(),
      unit_price: cents(priceValue ?? 0),
      cost_price: cents(costValue ?? 0),
      child_unit_price: child == null ? null : cents(child),
      category: category.trim() || null,
      sub_category: subCategory.trim() || null,
      category_id: categoryId || null,
      sub_category_id: subCategoryId || null,
      description: descriptionOut,
      is_option: isOption,
      // Les fiches ne sont écrites que si elles ont changé.
      ...(cardFr !== startValues.cardFr ? { gastro_card_html: cardFrOut } : {}),
      ...(cardEn !== startValues.cardEn ? { gastro_card_html_en: cardEnOut } : {}),
      user_id: user.id,
      // La case « vérifié » ne tient que pour la liste cochée : une liste modifiée est à revérifier.
      ...(allergensReady ? { allergens_extra: extra, allergens_checked: allergensChecked } : {}),
    };
    setSaving(true);
    const supabase = createClient();
    const { data, error } = initial
      ? await supabase.from('prestations').update(payload).eq('id', initial.id).select().single()
      : await supabase.from('prestations').insert([payload]).select().single();
    if (!error) dbChecked.current = allergensReady && allergensChecked;
    if (error || !data) {
      setSaving(false);
      setSaveError('La prestation n’a pas pu être enregistrée. Vérifiez votre connexion, puis réessayez.');
      return;
    }
    if (initial && syncDrafts) await syncDraftQuotes(payload.name, payload.description ?? '', { fr: cardFrOut, en: cardEnOut });
    // Ce qui est enregistré devient la référence : plus rien à confirmer en quittant.
    setStartValues({ name, price, childPrice, costPrice, categoryId, subCategoryId, description, cardFr, cardEn, isOption, extra: extra.join(','), checked: allergensChecked });
    go(listAfterSave(data.id));
  };

  // Échap dans un petit champ de création annule ce champ seulement.
  const escapeOnly = (e: React.KeyboardEvent, cancelField: () => void) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    cancelField();
  };

  const subs = subcategoriesFor(categoryId);
  const categoryName = dbCategories.find((c) => c.id === categoryId)?.name ?? (category || null);
  const profileStyle = profile as unknown as { default_quote_style?: string | null; default_quote_font?: string | null } | null;
  const quoteStyle: PreviewTemplate = PREVIEW_TEMPLATES.includes(profileStyle?.default_quote_style as PreviewTemplate)
    ? (profileStyle!.default_quote_style as PreviewTemplate) : 'classique';
  const quoteFont = profileStyle?.default_quote_font || 'Georgia';
  const styleLabel: Record<string, string> = { classique: 'Classique', standard: 'Standard', mariage: 'Mariage', business: 'Business' };
  const previewData = useDeferredValue({ name, unitPrice: priceOk ? priceValue! : 0, isOption, description, gastroCardHtml: cardFr && !isBlankHtml(cardFr) ? cardFr : null });

  // Classes des deux mises en page : « W » = la page dispose d'au moins 940 px (requête de conteneur).
  return (
    <div className="[container-type:inline-size]">
      <div className="px-4 md:px-6 pt-1 max-w-[1240px] mx-auto">
        <Link href={LIST_BACK} className="inline-flex items-center gap-1.5 h-10 -ml-1 px-1 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />Prestations
        </Link>

        {/* ── En-tête : nom et prix, bien lisibles ── */}
        <header className="mt-2 mb-6">
          <h1 className="text-[26px] md:text-[34px] font-bold text-gray-900 leading-tight break-words">
            {name.trim() || (initial ? 'Prestation sans nom' : 'Nouvelle prestation')}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
            {priceOk && (
              <p className="text-lg text-gray-900 tabular-nums"><strong className="font-semibold">{formatCurrency(priceValue!)}</strong> <span className="text-gray-500 text-base">HT</span></p>
            )}
            {categoryName && <span className={cn(pill, 'bg-gray-100 text-gray-700 capitalize')}>{categoryName}</span>}
            {isOption && <span className={cn(pill, 'bg-primary-50 text-primary-700')}>Option</span>}
          </div>
        </header>

        {/* Onglets, quand la place manque pour l'aperçu à côté du formulaire */}
        <div role="tablist" aria-label="Affichage" className="[@container(min-width:940px)]:hidden mb-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70 sm:max-w-sm">
          {([['form', 'Modifier'], ['preview', 'Aperçu']] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={cn('h-10 rounded-lg text-[15px] font-medium transition-colors', tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {label}
            </button>
          ))}
        </div>

        <div className="[@container(min-width:940px)]:grid [@container(min-width:940px)]:grid-cols-[minmax(0,1fr)_400px] [@container(min-width:1140px)]:grid-cols-[minmax(0,1fr)_440px] gap-8 pb-8">
          {/* ── Formulaire ── */}
          <div className={cn('min-w-0 space-y-5', tab === 'preview' && 'hidden [@container(min-width:940px)]:block')}>
            <form id="prestation-form" noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5">
              <Section id="presta-s-infos" title="Nom et prix">
                <div>
                  <label htmlFor="presta-name" className={labelCls}>Nom de la prestation</label>
                  <input
                    id="presta-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Plateau cocktail dînatoire" autoComplete="off"
                    aria-invalid={!!errors.name} aria-describedby={errors.name ? 'presta-name-error' : undefined}
                    className={cn(inputCls, errors.name && 'border-danger focus:border-danger')}
                  />
                  {errors.name && <p id="presta-name-error" className="text-sm text-danger mt-1.5">{errors.name}</p>}
                </div>

                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    <PriceField id="presta-price" label="Prix unitaire HT" value={price} onChange={setPrice} error={errors.price} placeholder="85,00" />
                    <PriceField id="presta-childPrice" label="Prix enfant HT" value={childPrice} onChange={setChildPrice} error={errors.childPrice} placeholder="Facultatif" />
                    <PriceField id="presta-costPrice" label="Prix de revient" value={costPrice} onChange={setCostPrice} error={errors.costPrice} placeholder="Facultatif" />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Sans prix enfant, le prix adulte s’applique à tous les invités. Le prix de revient ne figure jamais dans les devis.</p>
                  {margin && (
                    <p data-testid="presta-margin" className={cn('text-[15px] mt-2', margin.amount < 0 ? 'text-danger' : 'text-gray-800')}>
                      {margin.amount < 0
                        ? <>Le prix de revient dépasse le prix de vente : perte de <strong>{formatCurrency(-margin.amount)}</strong> par unité.</>
                        : <>Marge : <strong>{formatCurrency(margin.amount)}</strong> par unité{margin.rate != null && <>, soit <strong>{String(margin.rate).replace('.', ',')} %</strong> du prix HT</>}{margin.coefficient != null && <>, coefficient <strong>{String(margin.coefficient).replace('.', ',')}</strong></>}.</>}
                    </p>
                  )}
                  {initial && (
                    <RecipeCostPanel
                      prestationId={initial.id} recipeKey={recipeKey}
                      priceHT={priceOk ? priceValue : null}
                      costHT={costValue != null && !Number.isNaN(costValue) ? costValue : null}
                      onUse={(cost) => setCostPrice(amountField(cost))}
                    />
                  )}
                </div>

                <label className="flex items-center gap-3 min-h-10 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isOption}
                    onChange={(e) => setIsOption(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 accent-primary flex-shrink-0"
                  />
                  <span className="text-[15px] text-gray-700">
                    Marquer comme <strong className="font-semibold text-gray-900">option</strong> : dans un devis, son prix est compté à part du total
                  </span>
                </label>
              </Section>

              <Section id="presta-s-cat" title="Catégorie et sous-catégorie" hint="Elle range la prestation dans votre catalogue.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                  <div className="min-w-0">
                    <label htmlFor={creatingCat ? 'presta-new-cat' : 'presta-cat'} className={labelCls}>Catégorie</label>
                    {creatingCat ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          id="presta-new-cat" autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory(); } escapeOnly(e, () => setCreatingCat(false)); }}
                          placeholder="Nom de la catégorie"
                          className={cn(inputCls, 'flex-1 min-w-[10rem] w-auto')}
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={createCategory} disabled={!newCatName.trim()} className={cn(btnPrimary, 'h-12')}>Créer</button>
                          <button type="button" onClick={() => { setCreatingCat(false); setNewCatName(''); }} className={cn(btnGhost, 'h-12')}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <select
                        id="presta-cat"
                        value={categoryId}
                        onChange={(e) => {
                          setCategoryId(e.target.value);
                          setSubCategoryId('');
                          const cat = dbCategories.find((c) => c.id === e.target.value);
                          setCategory(cat?.name || '');
                          setSubCategory('');
                          setCreatingSubCat(false);
                        }}
                        className={inputCls}
                      >
                        <option value="">Sans catégorie</option>
                        {dbCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.user_id ? ' (la vôtre)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {!creatingCat && (
                      <button type="button" onClick={() => { setCreatingCat(true); setCatError(null); }} className={newBtn}>
                        <Plus className="h-4 w-4" />Nouvelle catégorie
                      </button>
                    )}
                  </div>

                  <div className="min-w-0">
                    <label htmlFor={creatingSubCat ? 'presta-new-subcat' : 'presta-subcat'} className={labelCls}>Sous-catégorie</label>
                    {creatingSubCat ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          id="presta-new-subcat" autoFocus value={newSubCatName} onChange={(e) => setNewSubCatName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createSubCategory(); } escapeOnly(e, () => setCreatingSubCat(false)); }}
                          placeholder="Nom de la sous-catégorie"
                          className={cn(inputCls, 'flex-1 min-w-[10rem] w-auto')}
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={createSubCategory} disabled={!newSubCatName.trim()} className={cn(btnPrimary, 'h-12')}>Créer</button>
                          <button type="button" onClick={() => { setCreatingSubCat(false); setNewSubCatName(''); }} className={cn(btnGhost, 'h-12')}>Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <select
                        id="presta-subcat"
                        value={subCategoryId}
                        onChange={(e) => {
                          setSubCategoryId(e.target.value);
                          const sub = subs.find((s) => s.id === e.target.value);
                          setSubCategory(sub?.name || '');
                        }}
                        disabled={!categoryId}
                        className={cn(inputCls, 'disabled:bg-gray-50 disabled:text-gray-500')}
                      >
                        <option value="">{categoryId ? 'Sans sous-catégorie' : 'Choisissez d’abord une catégorie'}</option>
                        {subs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}{s.user_id ? ' (la vôtre)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {categoryId && !creatingSubCat && (
                      <button type="button" onClick={() => { setCreatingSubCat(true); setCatError(null); }} className={newBtn}>
                        <Plus className="h-4 w-4" />Nouvelle sous-catégorie
                      </button>
                    )}
                  </div>
                  {catError && <p role="alert" className={cn(errorCls, 'sm:col-span-2')}>{catError}</p>}
                </div>
              </Section>

              <Section
                id="presta-s-desc"
                title="Texte de la carte du menu"
                hint={<>Tapez directement dans la carte, telle qu’elle sort dans vos devis : même police, mêmes tailles, mêmes retours à la ligne (style {styleLabel[quoteStyle]}, police {quoteFont}).</>}
              >
                <PrestationCarteSection
                  name={name} isOption={isOption} template={quoteStyle} font={quoteFont}
                  description={description} onDescription={setDescription}
                  cardFr={cardFr} onCardFr={setCardFr}
                  cardEn={cardEn} onCardEn={setCardEn}
                />
              </Section>

              {/* Devis en cours qui contiennent cette prestation */}
              {initial && draftCount > 0 && (
                <label className={cn(cardCls, 'flex items-center gap-3 p-5 cursor-pointer select-none')}>
                  <input
                    type="checkbox"
                    checked={syncDrafts}
                    onChange={(e) => setSyncDrafts(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 accent-primary flex-shrink-0"
                  />
                  <span className="text-[15px] text-gray-700">
                    Mettre aussi à jour le nom et le texte de la carte dans{' '}
                    <strong className="font-semibold text-gray-900">{draftCount} devis en cours</strong>{' '}
                    qui contiennent cette prestation
                  </span>
                </label>
              )}
            </form>

            {initial && user && <IngredientsSection prestationId={initial.id} userId={user.id} onRecipe={onRecipe} />}

            {allergensReady && (
              <AllergensSection
                recipe={recipe} extra={extra} onExtra={setExtra} isNew={!initial}
                checked={allergensChecked} onChecked={(v) => setCheckedFor(v ? allergenKeys : null)}
              />
            )}
          </div>

          {/* ── Aperçu ── */}
          <aside
            data-testid="prestation-preview"
            aria-label="Aperçu dans un devis"
            className={cn('min-w-0 overflow-x-hidden', tab === 'form' && 'hidden [@container(min-width:940px)]:block',
              '[@container(min-width:940px)]:sticky [@container(min-width:940px)]:top-4 [@container(min-width:940px)]:self-start')}
          >
            <div className={cn(cardCls, 'p-5')}>
              <h2 className="text-[17px] font-semibold text-gray-900 mb-4">Aperçu dans un devis</h2>
              <PrestationQuotePreview data={previewData} style={quoteStyle} font={quoteFont} />
              <p className="text-sm text-gray-500 mt-4">
                Style {styleLabel[quoteStyle] ?? quoteStyle}, police {quoteFont} : ceux de vos nouveaux devis, à choisir dans{' '}
                <Link href="/modeles" className="underline underline-offset-2 hover:text-gray-900">Styles de devis</Link>.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Barre d'actions, toujours visible. Sur téléphone, son fond descend jusqu'au bas de l'écran, derrière la barre
           d'onglets : les boutons restent au-dessus d'elle, et rien ne défile entre les deux. ── */}
      <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-white pb-[var(--tabbar-h)] mb-[calc(var(--tabbar-h)*-1)]">
        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <p className="hidden sm:block flex-1 min-w-0 text-sm text-gray-600 truncate" role="status">
            {saveError ? '' : dirty ? 'Modifications non enregistrées' : initial ? 'Aucune modification' : ''}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={cancel} disabled={saving} className={btnGhost}>Annuler</button>
            <button type="submit" form="prestation-form" disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {initial ? 'Enregistrer' : 'Ajouter la prestation'}
            </button>
          </div>
        </div>
        {saveError && (
          <div className="max-w-[1240px] mx-auto px-4 md:px-6 pb-3">
            <p role="alert" className={errorCls}>{saveError}</p>
          </div>
        )}
      </div>

      {leaveTo && (
        <Modal
          title="Quitter sans enregistrer ?"
          onClose={() => setLeaveTo(null)}
          footer={<>
            <button type="button" onClick={() => setLeaveTo(null)} className={btnSecondary} autoFocus>Continuer la saisie</button>
            <button type="button" onClick={() => go(leaveTo)} className={cn(btnPrimary, 'bg-danger hover:bg-danger/90')}>Quitter sans enregistrer</button>
          </>}
        >
          <p className="text-[15px] text-gray-700 pb-3">Vos modifications de cette prestation seront perdues.</p>
        </Modal>
      )}
    </div>
  );
}
