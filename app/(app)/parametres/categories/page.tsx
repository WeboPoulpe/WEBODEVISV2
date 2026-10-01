'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUrlAction } from '@/lib/useUrlAction';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { btnGhost, btnPrimary, cardCls, iconBtn, iconBtnDanger, inputCls, pill } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/evenements/shared';

interface Category { id: string; name: string; icon: string | null; sort_order: number; user_id: string | null; }
interface Subcategory { id: string; category_id: string; name: string; sort_order: number; user_id: string | null; }

const fieldCls = cn(inputCls, 'h-10 flex-1 min-w-0');

/** Champ de saisie d'un nom, validé par Entrée ou la coche, annulé par Échap ou la croix. */
function NameInput({ value, onChange, onSubmit, onCancel, placeholder, label }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void; placeholder?: string; label: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onCancel(); }}
        className={fieldCls} />
      <button onClick={onSubmit} disabled={!value.trim()} className={iconBtn} aria-label="Valider"><Check className="h-4 w-4" /></button>
      <button onClick={onCancel} className={iconBtn} aria-label="Annuler"><X className="h-4 w-4" /></button>
    </div>
  );
}

export default function UserCategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingCat, setAddingCat] = useState(false);
  // Action rapide du menu (lib/navMega.ts).
  useUrlAction({ nouveau: () => { setAddingCat(true); setNewCatName(''); } });
  const [newCatName, setNewCatName] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchAll = useCallback(async () => {
    const sb = createClient();
    const [cats, scs] = await Promise.all([
      sb.from('prestation_categories').select('*').order('sort_order').order('name'),
      sb.from('prestation_subcategories').select('*').order('sort_order').order('name'),
    ]);
    if (cats.error || scs.error) setError('Vos catégories n’ont pas pu être chargées. Rechargez la page.');
    setCategories((cats.data as Category[]) ?? []);
    setSubs((scs.data as Subcategory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const subsFor = (catId: string) => subs.filter((s) => s.category_id === catId);
  const isMine = (row: { user_id: string | null }) => row.user_id != null && row.user_id === user?.id;
  const isGlobal = (row: { user_id: string | null }) => row.user_id == null;

  /** Vérifie le résultat d'une écriture : affiche le message et renvoie false en cas d'échec. */
  const ok = (res: { error: unknown }, message: string) => {
    if (res.error) { setError(message); return false; }
    setError(null);
    return true;
  };

  const addCategory = async () => {
    if (!newCatName.trim() || !user) return;
    const res = await createClient().from('prestation_categories').insert({ name: newCatName.trim(), user_id: user.id });
    if (!ok(res, 'La catégorie n’a pas pu être créée. Réessayez.')) return;
    setNewCatName(''); setAddingCat(false);
    fetchAll();
  };

  const updateCategory = async (id: string) => {
    if (!editName.trim()) return;
    const res = await createClient().from('prestation_categories').update({ name: editName.trim() }).eq('id', id);
    if (!ok(res, 'La catégorie n’a pas pu être renommée. Réessayez.')) return;
    setEditingCat(null); setEditName('');
    fetchAll();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ? Ses sous-catégories seront supprimées aussi.')) return;
    const res = await createClient().from('prestation_categories').delete().eq('id', id);
    if (!ok(res, 'La catégorie n’a pas pu être supprimée. Réessayez.')) return;
    fetchAll();
  };

  const addSubcategory = async (catId: string) => {
    if (!newSubName.trim() || !user) return;
    const res = await createClient().from('prestation_subcategories').insert({ category_id: catId, name: newSubName.trim(), user_id: user.id });
    if (!ok(res, 'La sous-catégorie n’a pas pu être créée. Réessayez.')) return;
    setNewSubName(''); setAddingSubFor(null);
    fetchAll();
  };

  const updateSubcategory = async (id: string) => {
    if (!editName.trim()) return;
    const res = await createClient().from('prestation_subcategories').update({ name: editName.trim() }).eq('id', id);
    if (!ok(res, 'La sous-catégorie n’a pas pu être renommée. Réessayez.')) return;
    setEditingSub(null); setEditName('');
    fetchAll();
  };

  const deleteSubcategory = async (id: string) => {
    if (!confirm('Supprimer cette sous-catégorie ?')) return;
    const res = await createClient().from('prestation_subcategories').delete().eq('id', id);
    if (!ok(res, 'La sous-catégorie n’a pas pu être supprimée. Réessayez.')) return;
    fetchAll();
  };

  const defaultPill = <span className={cn(pill, 'bg-gray-100 text-gray-600')}>Par défaut</span>;

  return (
    <div className="px-4 md:px-6 pb-8 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Mes catégories</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-xl">Elles rangent votre catalogue de prestations. Les catégories par défaut sont fournies avec l’app et ne se modifient pas.</p>
        </div>
        <button onClick={() => { setAddingCat(true); setNewCatName(''); }} className={cn(btnPrimary, 'w-full sm:w-auto')}>
          <Plus className="h-4 w-4" />Nouvelle catégorie
        </button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="px-5 py-4 animate-pulse"><div className="h-4 bg-gray-100 rounded w-1/3" /></div>)}
        </div>
      ) : (
        <div className="space-y-3">
          {addingCat && (
            <div className={cn(cardCls, 'flex items-center gap-2 pl-4 pr-2 py-2')}>
              <NameInput value={newCatName} onChange={setNewCatName} onSubmit={addCategory}
                onCancel={() => { setAddingCat(false); setNewCatName(''); }} placeholder="Nom de la catégorie" label="Nom de la nouvelle catégorie" />
            </div>
          )}

          {categories.map((cat) => {
            const isOpen = expanded[cat.id] ?? true;
            const subList = subsFor(cat.id);
            const mine = isMine(cat);
            const global = isGlobal(cat);
            return (
              <section key={cat.id} className={cn(cardCls, 'overflow-hidden')}>
                <div className="flex items-center gap-1 pl-1 pr-2 py-1.5">
                  {editingCat === cat.id ? (
                    <div className="flex-1 min-w-0 pl-3"><NameInput value={editName} onChange={setEditName} onSubmit={() => updateCategory(cat.id)}
                      onCancel={() => setEditingCat(null)} label={`Nouveau nom de ${cat.name}`} /></div>
                  ) : (
                    <>
                      <button onClick={() => setExpanded({ ...expanded, [cat.id]: !isOpen })} aria-expanded={isOpen}
                        className="flex-1 min-w-0 flex items-center gap-2 min-h-11 pl-2 pr-1 text-left rounded-xl hover:bg-gray-50 transition-colors">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                        <span className="font-semibold text-gray-900 break-words min-w-0">{cat.name}</span>
                        {global && defaultPill}
                        <span className="hidden sm:inline text-sm text-gray-500 whitespace-nowrap ml-auto pl-2">
                          {subList.length} sous-catégorie{subList.length > 1 ? 's' : ''}
                        </span>
                      </button>
                      {mine && (
                        <>
                          <button onClick={() => { setEditingCat(cat.id); setEditName(cat.name); }} className={iconBtn} aria-label={`Renommer ${cat.name}`}><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => deleteCategory(cat.id)} className={iconBtnDanger} aria-label={`Supprimer ${cat.name}`}><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </>
                  )}
                </div>

                {isOpen && (subList.length > 0 || mine) && (
                  <ul className="border-t border-gray-100 divide-y divide-gray-100">
                    {subList.map((s) => (
                      <li key={s.id} className="flex items-center gap-1 pl-10 pr-2 py-1 min-h-12">
                        {editingSub === s.id ? (
                          <NameInput value={editName} onChange={setEditName} onSubmit={() => updateSubcategory(s.id)}
                            onCancel={() => setEditingSub(null)} label={`Nouveau nom de ${s.name}`} />
                        ) : (
                          <>
                            <span className="flex-1 min-w-0 text-[15px] text-gray-800 break-words">{s.name}</span>
                            {isGlobal(s) && defaultPill}
                            {isMine(s) && (
                              <>
                                <button onClick={() => { setEditingSub(s.id); setEditName(s.name); }} className={iconBtn} aria-label={`Renommer ${s.name}`}><Pencil className="h-4 w-4" /></button>
                                <button onClick={() => deleteSubcategory(s.id)} className={iconBtnDanger} aria-label={`Supprimer ${s.name}`}><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                    {mine && (
                      <li className="pl-8 pr-2 py-1.5">
                        {addingSubFor === cat.id ? (
                          <div className="pl-2"><NameInput value={newSubName} onChange={setNewSubName} onSubmit={() => addSubcategory(cat.id)}
                            onCancel={() => setAddingSubFor(null)} placeholder="Nom de la sous-catégorie" label={`Nouvelle sous-catégorie de ${cat.name}`} /></div>
                        ) : (
                          <button onClick={() => { setAddingSubFor(cat.id); setNewSubName(''); }} className={cn(btnGhost, 'h-10 text-primary-700')}>
                            <Plus className="h-4 w-4" />Ajouter une sous-catégorie
                          </button>
                        )}
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}

          {categories.length === 0 && !addingCat && (
            <div className={cn(cardCls, 'px-6 py-14 text-center')}>
              <p className="font-semibold text-gray-900">Aucune catégorie</p>
              <p className="text-sm text-gray-500 mt-1">Créez-en une pour ranger vos prestations : Cocktail, Dîner, Boissons.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
