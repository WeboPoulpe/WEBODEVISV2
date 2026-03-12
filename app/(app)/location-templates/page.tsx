'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, Loader2, Check, Pencil, X, Package, GripVertical,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface RentalTemplate {
  id: string;
  material_name: string;
  qty_per_guest: number;
  unit: string | null;
  default_supplier_id: string | null;
  default_price_per_unit: number;
  sort_order: number;
}

interface Supplier {
  id: string;
  name: string;
}

export default function LocationTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<RentalTemplate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [qtyPerGuest, setQtyPerGuest] = useState('1');
  const [unit, setUnit] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [price, setPrice] = useState('0');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('rental_templates').select('*').eq('user_id', user.id).order('sort_order'),
      supabase.from('suppliers').select('id, name').order('name'),
    ]);
    setTemplates((t ?? []) as RentalTemplate[]);
    setSuppliers((s ?? []) as Supplier[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setQtyPerGuest('1');
    setUnit('');
    setSupplierId('');
    setPrice('0');
  };

  const startEdit = (t: RentalTemplate) => {
    setEditingId(t.id);
    setName(t.material_name);
    setQtyPerGuest(String(t.qty_per_guest));
    setUnit(t.unit ?? '');
    setSupplierId(t.default_supplier_id ?? '');
    setPrice(String(t.default_price_per_unit));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      material_name: name.trim(),
      qty_per_guest: parseFloat(qtyPerGuest) || 1,
      unit: unit.trim() || null,
      default_supplier_id: supplierId || null,
      default_price_per_unit: parseFloat(price) || 0,
    };
    if (editingId) {
      await supabase.from('rental_templates').update(payload).eq('id', editingId);
    } else {
      await supabase.from('rental_templates').insert({
        ...payload,
        user_id: user.id,
        sort_order: templates.length,
      });
    }
    resetForm();
    setSaving(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return;
    await createClient().from('rental_templates').delete().eq('id', id);
    setTemplates((p) => p.filter((t) => t.id !== id));
  };

  const getSupplierName = (id: string | null) =>
    suppliers.find((s) => s.id === id)?.name ?? '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Templates de location</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Définissez la vaisselle standard par convive. Ces templates seront utilisés pour auto-générer la location sur chaque événement.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {/* Example hint */}
      {templates.length === 0 && !showForm && (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucun template configuré.</p>
          <p className="text-xs text-gray-400 mt-1">
            Ex : &quot;Assiette plate&quot; × 1 / convive, &quot;Verre à vin&quot; × 1 / convive, &quot;Fourchette&quot; × 1 / convive…
          </p>
        </div>
      )}

      {/* Templates list */}
      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm group hover:border-[#9c27b0]/30 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{t.material_name}</p>
                <p className="text-xs text-gray-400">
                  {t.qty_per_guest} {t.unit ?? 'pcs'} / convive
                  {t.default_supplier_id && <> — <span className="text-gray-500">{getSupplierName(t.default_supplier_id)}</span></>}
                  {t.default_price_per_unit > 0 && <> — {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(t.default_price_per_unit)} / unité</>}
                </p>
              </div>
              <button
                onClick={() => startEdit(t)}
                className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-purple-50 rounded-lg transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white border border-[#9c27b0]/20 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{editingId ? 'Modifier' : 'Nouveau'} template</p>
            <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du matériel *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Assiette plate, Verre à vin…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quantité / convive</label>
              <input
                type="number" min="0" step="0.1"
                value={qtyPerGuest}
                onChange={(e) => setQtyPerGuest(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Unité</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, lot…"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fournisseur par défaut</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white"
              >
                <option value="">— Aucun —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prix unitaire HT</label>
              <input
                type="number" min="0" step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editingId ? 'Modifier' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4">
        <p className="text-xs text-gray-600">
          <strong className="text-[#9c27b0]">Comment ça marche :</strong> Sur chaque événement, cliquez sur{' '}
          <span className="font-semibold text-[#9c27b0]">« Générer vaisselle »</span> dans l&apos;onglet Matériel.
          La quantité sera automatiquement calculée : <code className="bg-purple-100 px-1 py-0.5 rounded text-[#9c27b0]">quantité / convive × nombre de convives</code>.
        </p>
      </div>
    </div>
  );
}
