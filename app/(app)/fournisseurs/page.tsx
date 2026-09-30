'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, Search, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, cardCls, errorCls, iconBtnDanger, inputCls, labelCls } from '@/components/ui/kit';
import { ErrorBanner } from '@/components/evenements/shared';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export default function FournisseursPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Formulaire
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: err } = await createClient()
      .from('suppliers')
      .select('*')
      .order('name');
    if (err) setError('Vos fournisseurs n’ont pas pu être chargés. Rechargez la page.');
    setSuppliers((data ?? []) as Supplier[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setNotes('');
    setFormError(null);
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.id);
    setName(s.name);
    setEmail(s.email ?? '');
    setPhone(s.phone ?? '');
    setAddress(s.address ?? '');
    setNotes(s.notes ?? '');
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true); setFormError(null);
    const supabase = createClient();
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    const { error: err } = editingId
      ? await supabase.from('suppliers').update(payload).eq('id', editingId)
      : await supabase.from('suppliers').insert({ ...payload, user_id: user.id, owner_user_id: user.id });
    setSaving(false);
    if (err) { setFormError('Le fournisseur n’a pas pu être enregistré. Réessayez.'); return; }
    resetForm();
    await load();
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Supprimer « ${s.name} » ? Il sera retiré des articles de location qui lui sont rattachés.`)) return;
    const { error: err } = await createClient().from('suppliers').delete().eq('id', s.id);
    if (err) { setError('Le fournisseur n’a pas pu être supprimé. Réessayez.'); return; }
    setError(null);
    setSuppliers((p) => p.filter((x) => x.id !== s.id));
  };

  const filtered = suppliers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Fournisseurs</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Vos grossistes et vos loueurs, repris dans les ingrédients, les courses, la location et les commandes.
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className={cn(btnPrimary, 'w-full sm:w-auto')}>
          <Plus className="h-4 w-4" />Nouveau fournisseur
        </button>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onClose={() => setError(null)} /></div>}

      {suppliers.length > 5 && (
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un fournisseur"
            aria-label="Rechercher un fournisseur" className={cn(inputCls, 'pl-11')} />
        </div>
      )}

      {loading ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className={cn(cardCls, 'flex flex-col items-center px-6 py-16 text-center')}>
          <Truck className="h-8 w-8 text-gray-400 mb-3" />
          <p className="font-semibold text-gray-900 mb-1">Aucun fournisseur pour le moment</p>
          <p className="text-sm text-gray-500 max-w-sm">Ajoutez votre grossiste, votre primeur, votre loueur de vaisselle.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900">Aucun fournisseur ne correspond</p>
          <p className="text-sm text-gray-500 mt-1">Essayez un autre nom.</p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((s) => (
            <li key={s.id} className="flex items-center gap-1 pr-2 hover:bg-gray-50 transition-colors">
              <button onClick={() => startEdit(s)} aria-label={`Modifier ${s.name}`} className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 text-left pl-4 sm:pl-5 py-3.5">
                <span aria-hidden className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">
                  {initialsOf(s.name) || <Truck className="h-[18px] w-[18px]" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-gray-900 truncate">{s.name}</span>
                  {(s.phone || s.email || s.address) && (
                    <span className="block text-sm text-gray-500 truncate">{[s.phone, s.email, s.address].filter(Boolean).join(', ')}</span>
                  )}
                  {s.notes && <span className="block text-sm text-gray-500 truncate">{s.notes}</span>}
                </span>
              </button>
              <button onClick={() => handleDelete(s)} className={iconBtnDanger} aria-label={`Supprimer ${s.name}`} title="Supprimer"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <Modal
          title={editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          onClose={resetForm}
          footer={<>
            <button onClick={resetForm} className={btnGhost}>Annuler</button>
            <button onClick={handleSave} disabled={!name.trim() || saving} className={btnPrimary}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
            </button>
          </>}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4 pb-3">
            <div>
              <label htmlFor="sup-name" className={labelCls}>Nom</label>
              <input id="sup-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Metro, Huguier Location" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sup-phone" className={labelCls}>Téléphone</label>
                <input id="sup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01 23 45 67 89" className={inputCls} />
              </div>
              <div>
                <label htmlFor="sup-email" className={labelCls}>Email</label>
                <input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@fournisseur.fr" className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="sup-address" className={labelCls}>Adresse</label>
              <input id="sup-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue des Halles, Troyes" className={inputCls} />
            </div>
            <div>
              <label htmlFor="sup-notes" className={labelCls}>Notes</label>
              <textarea id="sup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Livre le mardi et le vendredi, minimum 150 € HT" className={cn(inputCls, 'h-auto py-3 resize-none')} />
            </div>
            {formError && <p role="alert" className={errorCls}>{formError}</p>}
          </form>
        </Modal>
      )}
    </div>
  );
}
