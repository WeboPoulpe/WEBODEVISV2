'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Link2, Loader2, X, Check, Users2, Phone, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Extra {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  access_token: string;
  created_at: string;
}

const ROLES = ['Cuisinier', 'Sous-chef', 'Serveur', 'Barman', 'Aide', 'Autre'];

// ── Avatar initiales ──────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7b1fa2] to-[#ab47bc] flex items-center justify-center flex-shrink-0">
      <span className="text-white font-bold text-sm">{initials}</span>
    </div>
  );
}

// ── Modal add/edit ────────────────────────────────────────────────────────────
interface ModalProps {
  initial?: Partial<Extra>;
  onSave: (data: { name: string; role: string; phone: string; email: string }) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function ExtraModal({ initial, onSave, onClose, saving }: ModalProps) {
  const [name,  setName]  = useState(initial?.name  ?? '');
  const [role,  setRole]  = useState(initial?.role  ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? "Modifier l'extra" : 'Nouvel extra'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom complet *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] bg-white"
            >
              <option value="">— Sélectionner —</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 00 00 00 00"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jean@exemple.fr"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ name, role, phone, email })}
            disabled={!name.trim() || saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {initial?.id ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExtrasPage() {
  const { user } = useAuth();
  const [extras,  setExtras]  = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Extra | null>(null);
  const [saving, setSaving]             = useState(false);
  const [copied, setCopied]             = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await createClient()
      .from('extras')
      .select('*')
      .eq('user_id', user.id)
      .order('name');
    setExtras((data ?? []) as Extra[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (form: { name: string; role: string; phone: string; email: string }) => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    if (editing) {
      const { data } = await supabase
        .from('extras')
        .update({ name: form.name, role: form.role || null, phone: form.phone || null, email: form.email || null })
        .eq('id', editing.id)
        .select()
        .single();
      if (data) setExtras((p) => p.map((e) => e.id === editing.id ? data as Extra : e));
    } else {
      const { data } = await supabase
        .from('extras')
        .insert({ user_id: user.id, name: form.name, role: form.role || null, phone: form.phone || null, email: form.email || null })
        .select()
        .single();
      if (data) setExtras((p) => [...p, data as Extra]);
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet extra ?')) return;
    await createClient().from('extras').delete().eq('id', id);
    setExtras((p) => p.filter((e) => e.id !== id));
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/e/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion des Extras</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez votre équipe de prestataires événementiels</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter un extra
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-[#9c27b0] animate-spin" />
        </div>
      ) : extras.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Users2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun extra enregistré</p>
          <p className="text-sm text-gray-400 mt-1">Ajoutez votre première équipe pour gérer le staffing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {extras.map((extra) => (
            <div
              key={extra.id}
              className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Avatar name={extra.name} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{extra.name}</p>
                  {extra.role && (
                    <span className="px-2 py-0.5 bg-purple-50 text-[#9c27b0] text-xs font-medium rounded-full">
                      {extra.role}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  {extra.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />{extra.phone}
                    </span>
                  )}
                  {extra.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />{extra.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => copyLink(extra.access_token, extra.id)}
                  title="Copier le lien d'accès"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied === extra.id
                    ? <><Check className="h-3.5 w-3.5 text-emerald-500" /><span>Copié !</span></>
                    : <><Link2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Lien</span></>
                  }
                </button>
                <button
                  onClick={() => { setEditing(extra); setShowModal(true); }}
                  className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-purple-50 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(extra.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ExtraModal
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
