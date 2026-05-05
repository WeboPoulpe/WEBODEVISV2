'use client';

import { useEffect, useState, useCallback } from 'react';
import { FolderTree, Plus, Trash2, Pencil, Loader2, Check, X, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Category { id: string; name: string; icon: string | null; sort_order: number; user_id: string | null; }
interface Subcategory { id: string; category_id: string; name: string; sort_order: number; user_id: string | null; }

export default function UserCategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchAll = useCallback(async () => {
    const sb = createClient();
    const [{ data: cats }, { data: scs }] = await Promise.all([
      sb.from('prestation_categories').select('*').order('sort_order').order('name'),
      sb.from('prestation_subcategories').select('*').order('sort_order').order('name'),
    ]);
    setCategories((cats as Category[]) ?? []);
    setSubs((scs as Subcategory[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const subsFor = (catId: string) => subs.filter((s) => s.category_id === catId);
  const isMine = (row: { user_id: string | null }) => row.user_id != null && row.user_id === user?.id;
  const isGlobal = (row: { user_id: string | null }) => row.user_id == null;

  const addCategory = async () => {
    if (!newCatName.trim() || !user) return;
    const sb = createClient();
    await sb.from('prestation_categories').insert({ name: newCatName.trim(), user_id: user.id });
    setNewCatName(''); setAddingCat(false);
    fetchAll();
  };

  const updateCategory = async (id: string) => {
    if (!editName.trim()) return;
    const sb = createClient();
    await sb.from('prestation_categories').update({ name: editName.trim() }).eq('id', id);
    setEditingCat(null); setEditName('');
    fetchAll();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ? Les sous-catégories liées seront supprimées aussi.')) return;
    const sb = createClient();
    await sb.from('prestation_categories').delete().eq('id', id);
    fetchAll();
  };

  const addSubcategory = async (catId: string) => {
    if (!newSubName.trim() || !user) return;
    const sb = createClient();
    await sb.from('prestation_subcategories').insert({ category_id: catId, name: newSubName.trim(), user_id: user.id });
    setNewSubName(''); setAddingSubFor(null);
    fetchAll();
  };

  const updateSubcategory = async (id: string) => {
    if (!editName.trim()) return;
    const sb = createClient();
    await sb.from('prestation_subcategories').update({ name: editName.trim() }).eq('id', id);
    setEditingSub(null); setEditName('');
    fetchAll();
  };

  const deleteSubcategory = async (id: string) => {
    if (!confirm('Supprimer cette sous-catégorie ?')) return;
    const sb = createClient();
    await sb.from('prestation_subcategories').delete().eq('id', id);
    fetchAll();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl">
            <FolderTree className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes catégories</h1>
            <p className="text-sm text-gray-500">Catégories personnelles + globales (en lecture seule)</p>
          </div>
        </div>
        <button onClick={() => setAddingCat(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2]">
          <Plus className="h-4 w-4" />Catégorie
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-[#9c27b0]" /></div>
      ) : (
        <div className="space-y-2">
          {addingCat && (
            <div className="bg-white border-2 border-[#9c27b0] rounded-xl p-3 flex items-center gap-2">
              <input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAddingCat(false); }}
                placeholder="Nom de la catégorie…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none" />
              <button onClick={addCategory} className="p-2 bg-[#9c27b0] text-white rounded-lg hover:bg-[#7b1fa2]"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setAddingCat(false); setNewCatName(''); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
          )}

          {categories.map((cat) => {
            const isOpen = expanded[cat.id] ?? true;
            const subList = subsFor(cat.id);
            const mine = isMine(cat);
            const global = isGlobal(cat);
            return (
              <div key={cat.id} className={`bg-white border rounded-xl ${global ? 'border-gray-200' : 'border-purple-200'}`}>
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setExpanded({ ...expanded, [cat.id]: !isOpen })} className="p-1 text-gray-400">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {editingCat === cat.id ? (
                    <>
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') updateCategory(cat.id); if (e.key === 'Escape') setEditingCat(null); }}
                        className="flex-1 text-sm font-medium border border-[#9c27b0] rounded-lg px-2 py-1" />
                      <button onClick={() => updateCategory(cat.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditingCat(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <p className="flex-1 text-sm font-bold text-gray-900">{cat.name}</p>
                      {global && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                          <Globe className="h-2.5 w-2.5" />Globale
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">{subList.length} sous-cat.</span>
                      {mine && (
                        <>
                          <button onClick={() => { setEditingCat(cat.id); setEditName(cat.name); }} className="p-1 text-gray-300 hover:text-[#9c27b0]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
                    {subList.map((s) => {
                      const subMine = isMine(s);
                      const subGlobal = isGlobal(s);
                      return (
                        <div key={s.id} className="flex items-center gap-2 pl-6 group">
                          {editingSub === s.id ? (
                            <>
                              <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') updateSubcategory(s.id); if (e.key === 'Escape') setEditingSub(null); }}
                                className="flex-1 text-sm border border-[#9c27b0] rounded px-2 py-1" />
                              <button onClick={() => updateSubcategory(s.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setEditingSub(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="h-3.5 w-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <span className="text-gray-300">›</span>
                              <p className="flex-1 text-xs text-gray-700">{s.name}</p>
                              {subGlobal && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                                  <Globe className="h-2.5 w-2.5" />Globale
                                </span>
                              )}
                              {subMine && (
                                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                                  <button onClick={() => { setEditingSub(s.id); setEditName(s.name); }} className="p-1 text-gray-300 hover:text-[#9c27b0]"><Pencil className="h-3 w-3" /></button>
                                  <button onClick={() => deleteSubcategory(s.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                    {mine && (addingSubFor === cat.id ? (
                      <div className="flex items-center gap-2 pl-6">
                        <input autoFocus value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addSubcategory(cat.id); if (e.key === 'Escape') setAddingSubFor(null); }}
                          placeholder="Nom de la sous-catégorie…"
                          className="flex-1 text-xs border border-[#9c27b0] rounded px-2 py-1" />
                        <button onClick={() => addSubcategory(cat.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setAddingSubFor(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingSubFor(cat.id)} className="ml-6 text-[10px] text-[#9c27b0] hover:underline">+ Sous-catégorie</button>
                    ))}
                    {global && subList.length === 0 && (
                      <p className="pl-6 text-[10px] text-gray-300 italic">Catégorie globale en lecture seule</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {categories.length === 0 && !addingCat && (
            <p className="text-center py-10 text-sm text-gray-400 italic">Aucune catégorie</p>
          )}
        </div>
      )}
    </div>
  );
}
