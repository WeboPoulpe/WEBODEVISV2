'use client';

// Palette de l'éditeur avancé : les blocs à poser sur la page (clic : à la suite ; glisser : à l'endroit visé) et les
// pages spéciales (couverture, contact), une de chaque au plus.

import type { DragEvent } from 'react';
import { BookImage, Columns2, Columns3, Image as ImageIcon, Minus, MoveVertical, Phone, Type, Utensils, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Block } from '@/lib/brochureLayout';

export type PaletteItem = Block['type'] | 'columns3';

const ITEMS: { key: PaletteItem; label: string; icon: React.ElementType }[] = [
  { key: 'prestation', label: 'Prestation', icon: Utensils },
  { key: 'title', label: 'Titre', icon: Type },
  { key: 'text', label: 'Texte', icon: AlignLeft },
  { key: 'image', label: 'Image', icon: ImageIcon },
  { key: 'columns', label: '2 colonnes', icon: Columns2 },
  { key: 'columns3', label: '3 colonnes', icon: Columns3 },
  { key: 'separator', label: 'Séparateur', icon: Minus },
  { key: 'spacer', label: 'Espace', icon: MoveVertical },
];

const item = 'flex w-full items-center gap-2 rounded-lg border border-[#E6DFD3] bg-[#FBF7F0] px-2.5 py-2 text-left text-sm text-gray-800 hover:border-primary/40 disabled:opacity-40';

export default function BlockPalette({ onAdd, onAddPage, hasCover, hasContact, disabled }: {
  onAdd: (key: PaletteItem) => void;
  onAddPage: (kind: 'cover' | 'contact') => void;
  hasCover: boolean;
  hasContact: boolean;
  /** Page sélectionnée qui ne reçoit pas de blocs (couverture, contact, formulaire). */
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Blocs</p>
        {disabled && <p className="mb-2 text-xs text-gray-500">Choisissez une page de contenu pour y ajouter des blocs.</p>}
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {ITEMS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" disabled={disabled} aria-label={`Ajouter : ${label}`} onClick={() => onAdd(key)}
              draggable={!disabled}
              onDragStart={(e: DragEvent) => e.dataTransfer.setData('text/x-webo-block', `new:${key}`)}
              className={cn(item, 'cursor-grab')}>
              <Icon className="h-4 w-4 flex-shrink-0 text-primary" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Pages</p>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          <button type="button" disabled={hasCover} onClick={() => onAddPage('cover')} className={item}><BookImage className="h-4 w-4 text-primary" /> Couverture</button>
          <button type="button" disabled={hasContact} onClick={() => onAddPage('contact')} className={item}><Phone className="h-4 w-4 text-primary" /> Contact</button>
        </div>
      </div>
    </div>
  );
}
