'use client';

/** Sélecteur d'arborescence « Déplacer vers… » pour un devis. */

import { useMemo, useState } from 'react';
import { X, Home, Check, Search, FolderInput, Loader2 } from 'lucide-react';
import { QuoteFolder, buildFolderTree, flattenTree } from '@/lib/quoteFolders';
import { FolderGlyph } from './folderVisuals';

interface Props {
  open: boolean;
  folders: QuoteFolder[];
  /** Dossier actuel du devis (null = racine) */
  currentFolderId: string | null;
  quoteName: string;
  onClose: () => void;
  onMove: (folderId: string | null) => Promise<void> | void;
}

export default function MoveToFolderModal({ open, folders, currentFolderId, quoteName, onClose, onMove }: Props) {
  const [search, setSearch] = useState('');
  const [moving, setMoving] = useState<string | null>(null); // id ou '__root__'

  const rows = useMemo(() => flattenTree(buildFolderTree(folders)), [folders]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((f) => f.name.toLowerCase().includes(q));
  }, [rows, search]);

  if (!open) return null;

  const move = async (id: string | null) => {
    setMoving(id ?? '__root__');
    try { await onMove(id); onClose(); } finally { setMoving(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-[#f3e5f5] rounded-xl flex-shrink-0">
              <FolderInput className="h-4 w-4 text-[#9c27b0]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 text-sm">Déplacer vers…</h2>
              <p className="text-[11px] text-gray-400 truncate">{quoteName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {folders.length > 6 && (
          <div className="px-5 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un dossier…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0] transition-colors"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <button
            onClick={() => move(null)}
            disabled={moving !== null}
            className={[
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors',
              currentFolderId === null ? 'bg-[#f3e5f5] text-[#9c27b0] font-semibold' : 'text-gray-700 hover:bg-gray-50',
            ].join(' ')}
          >
            <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Home className="h-3.5 w-3.5 text-gray-500" />
            </span>
            <span className="flex-1 text-left">Aucun dossier (racine)</span>
            {moving === '__root__' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : currentFolderId === null && <Check className="h-4 w-4" />}
          </button>

          {visible.map((f) => (
            <button
              key={f.id}
              onClick={() => move(f.id)}
              disabled={moving !== null}
              style={{ paddingLeft: 10 + (search ? 0 : f.depth * 16) }}
              className={[
                'w-full flex items-center gap-2.5 pr-2.5 py-2 rounded-xl text-sm transition-colors',
                currentFolderId === f.id ? 'bg-[#f3e5f5] text-[#9c27b0] font-semibold' : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              <FolderGlyph icon={f.icon} color={f.color} size="sm" />
              <span className="flex-1 text-left truncate">{f.name}</span>
              {moving === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : currentFolderId === f.id && <Check className="h-4 w-4" />}
            </button>
          ))}

          {folders.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-6">
              Aucun dossier pour l’instant. Créez-en un depuis la barre « Nouveau dossier ».
            </p>
          )}
          {folders.length > 0 && visible.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-6">Aucun dossier ne correspond.</p>
          )}
        </div>
      </div>
    </div>
  );
}
