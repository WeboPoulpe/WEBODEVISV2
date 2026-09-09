'use client';

/**
 * Barre de dossiers de la page Devis : fil d'Ariane + tuiles des sous-dossiers
 * du niveau courant. Les tuiles et les segments du fil d'Ariane sont des cibles
 * de dépôt (devis ou dossier).
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, Home, Loader2, X, FolderPlus } from 'lucide-react';
import { QuoteFolder, childrenOf, folderPath, isSelfOrDescendant } from '@/lib/quoteFolders';
import { FolderGlyph, FolderStylePicker, folderColor } from './folderVisuals';

export type DragItem = { type: 'quote' | 'folder'; id: string } | null;

interface FolderBarProps {
  folders: QuoteFolder[];
  currentId: string | null;
  /** Nombre de devis par dossier, sous-dossiers inclus */
  counts: Map<string, number>;
  totalCount: number;
  dragItem: DragItem;
  onNavigate: (id: string | null) => void;
  onCreate: (data: { name: string; color: string; icon: string; parentId: string | null }) => Promise<void>;
  onUpdate: (id: string, patch: { name: string; color: string; icon: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Dépôt d'un devis ou d'un dossier sur un dossier (null = racine) */
  onDropInto: (target: string | null) => void;
  onDragStart: (item: DragItem) => void;
  onDragEnd: () => void;
}

export default function FolderBar({
  folders, currentId, counts, totalCount, dragItem,
  onNavigate, onCreate, onUpdate, onDelete, onDropInto, onDragStart, onDragEnd,
}: FolderBarProps) {
  const [overTarget, setOverTarget] = useState<string | null | undefined>(undefined); // undefined = rien
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; id?: string; name: string; color: string; icon: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const path = folderPath(folders, currentId);
  const subFolders = childrenOf(folders, currentId);

  /** Un dossier ne peut pas être déposé sur lui-même ni dans sa propre descendance. */
  const canDropOn = (target: string | null): boolean => {
    if (!dragItem) return false;
    if (dragItem.type === 'folder') {
      if (target === dragItem.id) return false;
      if (isSelfOrDescendant(folders, dragItem.id, target)) return false;
      const current = folders.find((f) => f.id === dragItem.id)?.parent_id ?? null;
      if (current === target) return false;
    }
    return true;
  };

  const dropProps = (target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDropOn(target)) return;
      e.preventDefault();
      setOverTarget(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverTarget(undefined);
    },
    onDrop: (e: React.DragEvent) => {
      if (!canDropOn(target)) return;
      e.preventDefault();
      e.stopPropagation();
      setOverTarget(undefined);
      onDropInto(target);
    },
  });

  const isOver = (target: string | null) => overTarget !== undefined && overTarget === target;

  const submitForm = async () => {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      if (form.mode === 'create') {
        await onCreate({ name: form.name.trim(), color: form.color, icon: form.icon, parentId: currentId });
      } else if (form.id) {
        await onUpdate(form.id, { name: form.name.trim(), color: form.color, icon: form.icon });
      }
      setForm(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: QuoteFolder) => {
    const nb = counts.get(f.id) ?? 0;
    const msg = nb > 0
      ? `Supprimer le dossier « ${f.name} » ?\n\nLes ${nb} devis qu'il contient ne seront PAS supprimés : ils remonteront dans le dossier parent, comme ses éventuels sous-dossiers.`
      : `Supprimer le dossier « ${f.name} » ?`;
    if (!confirm(msg)) return;
    setDeleting(f.id);
    try { await onDelete(f.id); } finally { setDeleting(null); }
  };

  return (
    <div className="mb-5">
      {/* ── Fil d'Ariane ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <nav className="flex items-center gap-0.5 text-sm min-w-0 flex-wrap">
          <button
            onClick={() => onNavigate(null)}
            {...dropProps(null)}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium transition-colors border',
              isOver(null) ? 'border-[#9c27b0] bg-[#f3e5f5] text-[#9c27b0]' : 'border-transparent',
              currentId === null ? 'text-gray-900' : 'text-gray-500 hover:text-[#9c27b0] hover:bg-gray-50',
            ].join(' ')}
          >
            <Home className="h-3.5 w-3.5" />
            Mes devis
            <span className="text-xs text-gray-400 font-normal">({totalCount})</span>
          </button>
          {path.map((f, i) => (
            <span key={f.id} className="flex items-center gap-0.5 min-w-0">
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
              <button
                onClick={() => onNavigate(f.id)}
                {...dropProps(f.id)}
                className={[
                  'flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium transition-colors border truncate max-w-[180px]',
                  isOver(f.id) ? 'border-[#9c27b0] bg-[#f3e5f5]' : 'border-transparent',
                  i === path.length - 1 ? 'text-gray-900' : 'text-gray-500 hover:text-[#9c27b0] hover:bg-gray-50',
                ].join(' ')}
              >
                <FolderGlyph icon={f.icon} color={f.color} size="sm" />
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-gray-400 font-normal">({counts.get(f.id) ?? 0})</span>
              </button>
            </span>
          ))}
        </nav>

        <button
          onClick={() => setForm({ mode: 'create', name: '', color: 'purple', icon: 'folder' })}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-[#9c27b0]/40 hover:text-[#9c27b0] transition-colors flex-shrink-0"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Nouveau dossier
        </button>
      </div>

      {/* ── Tuiles des sous-dossiers ──────────────────────────────────── */}
      {subFolders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {subFolders.map((f) => {
            const c = folderColor(f.color);
            const nb = counts.get(f.id) ?? 0;
            const nbSub = childrenOf(folders, f.id).length;
            const over = isOver(f.id);
            return (
              <div
                key={f.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', f.id);
                  onDragStart({ type: 'folder', id: f.id });
                }}
                onDragEnd={onDragEnd}
                onClick={() => onNavigate(f.id)}
                {...dropProps(f.id)}
                className={[
                  'group relative flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none',
                  over ? `${c.drop} scale-[1.02]` : `${c.tile} ${c.hover} hover:shadow-sm`,
                  dragItem?.type === 'folder' && dragItem.id === f.id ? 'opacity-40' : '',
                ].join(' ')}
                title={`Ouvrir « ${f.name} »`}
              >
                <FolderGlyph icon={f.icon} color={f.color} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {nb} devis{nbSub > 0 ? ` · ${nbSub} sous-dossier${nbSub > 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setForm({ mode: 'edit', id: f.id, name: f.name, color: f.color, icon: f.icon }); }}
                    title="Renommer / personnaliser"
                    className="p-1.5 text-gray-400 hover:text-[#9c27b0] hover:bg-white rounded-lg transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(f); }}
                    title="Supprimer le dossier"
                    disabled={deleting === f.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                  >
                    {deleting === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subFolders.length === 0 && folders.length === 0 && (
        <button
          onClick={() => setForm({ mode: 'create', name: '', color: 'purple', icon: 'folder' })}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-[#9c27b0]/40 hover:text-[#9c27b0] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un dossier pour organiser vos devis (mariages, entreprises, 2026…)
        </button>
      )}

      {/* ── Modale création / édition ─────────────────────────────────── */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setForm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#f3e5f5] rounded-xl">
                  <FolderPlus className="h-4 w-4 text-[#9c27b0]" />
                </div>
                <h2 className="font-semibold text-gray-900 text-sm">
                  {form.mode === 'create' ? 'Nouveau dossier' : 'Modifier le dossier'}
                </h2>
              </div>
              <button onClick={() => !saving && setForm(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {form.mode === 'create' && currentId && (
                <p className="text-[11px] text-gray-400">
                  Sera créé dans <span className="font-medium text-gray-600">{folderPath(folders, currentId).map((f) => f.name).join(' › ')}</span>
                </p>
              )}
              <div className="flex items-center gap-3">
                <FolderGlyph icon={form.icon} color={form.color} />
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitForm(); if (e.key === 'Escape') setForm(null); }}
                  placeholder="Nom du dossier"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
                />
              </div>

              <FolderStylePicker
                color={form.color}
                icon={form.icon}
                onColor={(color) => setForm({ ...form, color })}
                onIcon={(icon) => setForm({ ...form, icon })}
              />
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setForm(null)} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={submitForm} disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#9c27b0] text-white text-sm font-semibold rounded-lg hover:bg-[#7b1fa2] disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {form.mode === 'create' ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
