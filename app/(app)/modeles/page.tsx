'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Star, Sparkles, Briefcase, Plus, Pencil, Trash2,
  Check, Loader2, X, ArrowRight, Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
type BaseTemplate = 'standard' | 'mariage' | 'business';

interface CustomTemplate {
  id: string;
  name: string;
  base_template: BaseTemplate;
  accent_color: string;
  header_note: string | null;
  footer_note: string | null;
  is_default: boolean;
  created_at: string;
}

// ── Built-in definitions ──────────────────────────────────────────────────────
const BUILT_IN = [
  {
    key: 'standard' as BaseTemplate,
    label: 'Standard',
    icon: Star,
    accent: '#9c27b0',
    accentLight: '#f3e5f5',
    description: "Universel — mise en page épurée, prestations claires.",
  },
  {
    key: 'mariage' as BaseTemplate,
    label: 'Mariage & Réceptions',
    icon: Sparkles,
    accent: '#c8956c',
    accentLight: '#fdf3ec',
    description: "Élégant — typographie serif, palette champagne.",
    badge: 'Populaire',
  },
  {
    key: 'business' as BaseTemplate,
    label: 'Business & Corporate',
    icon: Briefcase,
    accent: '#1e3a5f',
    accentLight: '#eef2f7',
    description: "Corporate — sobre et professionnel, grands comptes.",
  },
] as const;

// ── Preset colors ─────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#9c27b0', '#7b1fa2', '#673ab7',
  '#3f51b5', '#1e3a5f', '#1976d2',
  '#c8956c', '#d4863c', '#c0392b',
  '#2e7d32', '#00796b', '#37474f',
  '#000000', '#424242',
];

// ── Mini preview ──────────────────────────────────────────────────────────────
function MiniPreview({ base, accent }: { base: BaseTemplate; accent: string }) {
  const isMariage  = base === 'mariage';
  const isBusiness = base === 'business';

  return (
    <div className={[
      'w-full h-full rounded-lg p-3 flex flex-col gap-1.5 overflow-hidden',
      isMariage  ? 'bg-[#fdf8f3] border border-[#c8956c]/20' : '',
      isBusiness ? 'bg-white border border-slate-200' : '',
      !isMariage && !isBusiness ? 'bg-white' : '',
    ].join(' ')}>
      {isBusiness ? (
        <div className="flex gap-2">
          <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
          <div className="flex-1 space-y-1">
            <div className="h-2 rounded w-3/4" style={{ backgroundColor: accent }} />
            <div className="h-1.5 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      ) : (
        <>
          <div className="h-5 rounded w-full" style={{ backgroundColor: accent }} />
          <div className="h-1.5 bg-gray-200 rounded w-1/2 mx-auto" />
        </>
      )}
      <div className="space-y-1.5 mt-1">
        {[85, 70, 90, 65].map((w, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <div className="h-1.5 bg-gray-100 rounded flex-1" style={{ maxWidth: `${w}%` }} />
            <div className="h-1.5 rounded w-8 flex-shrink-0 opacity-50" style={{ backgroundColor: accent }} />
          </div>
        ))}
      </div>
      <div className="mt-auto pt-2 border-t border-gray-100 flex justify-between items-center">
        <div className="h-1.5 bg-gray-200 rounded w-10" />
        <div className="h-2 rounded w-14" style={{ backgroundColor: accent }} />
      </div>
    </div>
  );
}

// ── Template modal (create / edit) ────────────────────────────────────────────
interface ModalProps {
  initial?: CustomTemplate | null;
  onClose: () => void;
  onSaved: (t: CustomTemplate) => void;
}

function TemplateModal({ initial, onClose, onSaved }: ModalProps) {
  const { user } = useAuth();
  const [name,        setName]        = useState(initial?.name          ?? '');
  const [base,        setBase]        = useState<BaseTemplate>(initial?.base_template ?? 'standard');
  const [accent,      setAccent]      = useState(initial?.accent_color  ?? '#9c27b0');
  const [headerNote,  setHeaderNote]  = useState(initial?.header_note   ?? '');
  const [footerNote,  setFooterNote]  = useState(initial?.footer_note   ?? '');
  const [isDefault,   setIsDefault]   = useState(initial?.is_default    ?? false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom du modèle est requis.'); return; }
    if (!user) return;
    setSaving(true); setError(null);

    const supabase = createClient();
    const payload = {
      name:          name.trim(),
      base_template: base,
      accent_color:  accent,
      header_note:   headerNote.trim() || null,
      footer_note:   footerNote.trim() || null,
      is_default:    isDefault,
      user_id:       user.id,
    };

    if (initial) {
      const { data, error: err } = await supabase
        .from('quote_templates')
        .update(payload)
        .eq('id', initial.id)
        .select()
        .single();
      setSaving(false);
      if (err) { setError(err.message); return; }
      onSaved(data as CustomTemplate);
    } else {
      const { data, error: err } = await supabase
        .from('quote_templates')
        .insert([payload])
        .select()
        .single();
      setSaving(false);
      if (err) { setError(err.message); return; }
      onSaved(data as CustomTemplate);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? 'Modifier le modèle' : 'Créer un modèle'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex overflow-hidden flex-1">

          {/* Left: form */}
          <div className="flex-1 p-6 space-y-5 overflow-y-auto">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom du modèle <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Mariage Élégant, Cocktail Corporate…"
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
              />
            </div>

            {/* Base template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modèle de base
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BUILT_IN.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => { setBase(b.key); setAccent(b.accent); }}
                    className={[
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium',
                      base === b.key
                        ? 'border-[#9c27b0] bg-[#f3e5f5] text-[#9c27b0]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <b.icon className="h-5 w-5" strokeWidth={1.5} />
                    <span className="text-xs text-center leading-tight">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur accent
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    title={c}
                    className="w-7 h-7 rounded-full flex-shrink-0 transition-transform hover:scale-110 relative"
                    style={{ backgroundColor: c }}
                  >
                    {accent === c && (
                      <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white" strokeWidth={3} />
                    )}
                  </button>
                ))}
                {/* Custom color input */}
                <label className="w-7 h-7 rounded-full cursor-pointer overflow-hidden flex-shrink-0 border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors relative"
                  title="Couleur personnalisée">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px] font-bold">+</span>
                </label>
                {/* Current color preview */}
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-7 h-7 rounded-full border border-white shadow-sm" style={{ backgroundColor: accent }} />
                  <span className="text-xs font-mono text-gray-500">{accent}</span>
                </div>
              </div>
            </div>

            {/* Header note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Note d&apos;introduction <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <textarea
                value={headerNote}
                onChange={(e) => setHeaderNote(e.target.value)}
                rows={2}
                placeholder="Ex : À la suite de notre entretien, voici notre proposition personnalisée…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors resize-none"
              />
            </div>

            {/* Footer note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Conditions / pied de page <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <textarea
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                rows={2}
                placeholder="Ex : Devis valable 30 jours. Acompte de 30% à la commande…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors resize-none"
              />
            </div>

            {/* Default toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none py-1">
              <div
                role="checkbox"
                aria-checked={isDefault}
                onClick={() => setIsDefault((v) => !v)}
                className={[
                  'relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0',
                  isDefault ? 'bg-[#9c27b0]' : 'bg-gray-200',
                ].join(' ')}
                style={{ height: '22px', width: '40px' }}
              >
                <span className={[
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  isDefault ? 'translate-x-5' : 'translate-x-0.5',
                ].join(' ')} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Modèle par défaut</p>
                <p className="text-xs text-gray-400">Pré-sélectionné lors de la création d&apos;un devis</p>
              </div>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>

          {/* Right: live preview */}
          <div className="w-48 flex-shrink-0 border-l border-gray-100 p-4 flex flex-col gap-3 hidden sm:flex">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Aperçu</p>
            <div className="w-full aspect-[3/4]">
              <MiniPreview base={base} accent={accent} />
            </div>
            <div className="text-center">
              <div
                className="inline-block w-3 h-3 rounded-full mb-1"
                style={{ backgroundColor: accent }}
              />
              <p className="text-xs font-medium text-gray-700 truncate">{name || 'Nom du modèle'}</p>
              <p className="text-[10px] text-gray-400">{BUILT_IN.find(b => b.key === base)?.label}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {initial ? 'Enregistrer' : 'Créer le modèle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Custom template card ──────────────────────────────────────────────────────
function CustomTemplateCard({
  t,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  t: CustomTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const baseInfo = BUILT_IN.find((b) => b.key === t.base_template);

  return (
    <div className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-gray-300 transition-all flex flex-col">
      {/* Default badge */}
      {t.is_default && (
        <div
          className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 text-white"
          style={{ backgroundColor: t.accent_color }}
        >
          Par défaut
        </div>
      )}

      {/* Actions */}
      <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={onEdit}
          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-gray-500 hover:text-[#9c27b0] hover:bg-white shadow-sm transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-gray-500 hover:text-red-500 hover:bg-white shadow-sm transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preview */}
      <div className="h-36 p-4 flex items-center justify-center" style={{ backgroundColor: `${t.accent_color}12` }}>
        <div className="w-full max-w-[140px] h-full max-h-[110px]">
          <MiniPreview base={t.base_template} accent={t.accent_color} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.accent_color }} />
          <h3 className="text-sm font-bold text-gray-900 truncate">{t.name}</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Basé sur {baseInfo?.label ?? t.base_template}
        </p>
        {(t.header_note || t.footer_note) && (
          <div className="space-y-1 mb-3">
            {t.header_note && (
              <p className="text-[11px] text-gray-500 line-clamp-1 italic">&ldquo;{t.header_note}&rdquo;</p>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2">
          <Link
            href={`/devis/nouveau?templateId=${t.id}`}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ backgroundColor: `${t.accent_color}15`, color: t.accent_color }}
          >
            Utiliser
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {!t.is_default && (
            <button
              onClick={onSetDefault}
              title="Définir comme modèle par défaut"
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#9c27b0] hover:border-[#9c27b0]/30 transition-colors text-xs"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ModelesPage() {
  const { user } = useAuth();
  const [customs,    setCustoms]   = useState<CustomTemplate[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [modal,      setModal]     = useState<{ open: boolean; editing: CustomTemplate | null }>({
    open: false, editing: null,
  });

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('quote_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCustoms((data ?? []) as CustomTemplate[]);
        setLoading(false);
      });
  }, [user]);

  const handleSaved = (t: CustomTemplate) => {
    setCustoms((prev) =>
      modal.editing
        ? prev.map((x) => (x.id === t.id ? t : x))
        : [t, ...prev],
    );
    setModal({ open: false, editing: null });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce modèle ?')) return;
    const supabase = createClient();
    await supabase.from('quote_templates').delete().eq('id', id);
    setCustoms((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    const supabase = createClient();
    // Unset all defaults, then set the chosen one
    await supabase.from('quote_templates').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('quote_templates').update({ is_default: true }).eq('id', id);
    setCustoms((prev) =>
      prev.map((t) => ({ ...t, is_default: t.id === id })),
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Modèles de devis</h1>
          <p className="text-sm text-gray-500 mt-1">
            Modèles prédéfinis et vos modèles personnalisés
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#9c27b0] text-white text-sm font-semibold rounded-xl hover:bg-[#7b1fa2] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Créer un modèle
        </button>
      </div>

      {/* ── Built-in templates ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Modèles prédéfinis
          </p>
          <Lock className="h-3 w-3 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BUILT_IN.map(({ key, label, icon: Icon, accent, accentLight, description, ...rest }) => {
            const badge = 'badge' in rest ? rest.badge : undefined;
            return (
              <div
                key={key}
                className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col"
              >
                {badge && (
                  <div
                    className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full z-10"
                    style={{ backgroundColor: `${accent}20`, color: accent }}
                  >
                    {badge}
                  </div>
                )}

                {/* Preview */}
                <div className="h-36 p-4 flex items-center justify-center" style={{ backgroundColor: accentLight }}>
                  <div className="w-full max-w-[140px] h-full max-h-[110px]">
                    <MiniPreview base={key} accent={accent} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accent}15` }}
                    >
                      <Icon strokeWidth={1.6} style={{ width: 13, height: 13, color: accent }} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4 flex-1">{description}</p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/devis/nouveau?template=${key}`}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-colors"
                      style={{ backgroundColor: `${accent}12`, color: accent }}
                    >
                      Utiliser
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Custom templates ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Mes modèles {!loading && customs.length > 0 && `(${customs.length})`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 text-[#9c27b0] animate-spin" />
          </div>
        ) : customs.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Plus className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">Aucun modèle personnalisé</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Créez vos propres modèles avec vos couleurs et textes favoris.
            </p>
            <button
              onClick={() => setModal({ open: true, editing: null })}
              className="px-4 py-2 bg-[#9c27b0] text-white text-sm font-medium rounded-xl hover:bg-[#7b1fa2] transition-colors"
            >
              Créer mon premier modèle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customs.map((t) => (
              <CustomTemplateCard
                key={t.id}
                t={t}
                onEdit={() => setModal({ open: true, editing: t })}
                onDelete={() => handleDelete(t.id)}
                onSetDefault={() => handleSetDefault(t.id)}
              />
            ))}
            {/* Add new card */}
            <button
              onClick={() => setModal({ open: true, editing: null })}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#9c27b0]/40 hover:text-[#9c27b0] hover:bg-[#f3e5f5]/30 transition-all min-h-[200px]"
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Nouveau modèle</span>
            </button>
          </div>
        )}
      </section>

      {/* Modal */}
      {modal.open && (
        <TemplateModal
          initial={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
