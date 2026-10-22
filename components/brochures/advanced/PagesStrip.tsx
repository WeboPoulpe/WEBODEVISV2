'use client';

// Bandeau des pages de l'éditeur avancé : vignettes (rendu réel à petite échelle), sélection, glisser pour réordonner,
// alerte « page trop pleine », et les commandes de la page sélectionnée.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LayoutPage } from '@/lib/brochureLayout';

const KIND_LABEL: Record<LayoutPage['kind'], string> = { cover: 'couverture', blocks: 'contenu', contact: 'contact', form: 'formulaire' };

/** Vrai si le contenu de la page dépasse sa hauteur (mesuré dans le rendu). */
export function useOverflow(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const scroll = ref.current?.querySelector<HTMLElement>('[data-page-scroll]');
    setOver(!!scroll && scroll.scrollHeight > scroll.clientHeight + 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, over };
}

function Thumb({ index, page, selected, onSelect, onDropPage, render }: {
  index: number; page: LayoutPage; selected: boolean; onSelect: () => void; onDropPage: (from: string) => void; render: ReactNode;
}) {
  const { ref, over } = useOverflow([render]);
  const fixed = page.kind === 'cover' || page.kind === 'form';
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      aria-label={`Page ${index + 1}, ${KIND_LABEL[page.kind]}${over ? ', trop pleine' : ''}`}
      draggable={!fixed}
      onDragStart={(e) => e.dataTransfer.setData('text/x-webo-page', page.id)}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/x-webo-page')) e.preventDefault(); }}
      onDrop={(e) => { const from = e.dataTransfer.getData('text/x-webo-page'); if (from) { e.preventDefault(); onDropPage(from); } }}
      className="flex flex-shrink-0 flex-col items-center gap-1">
      <div ref={ref} className={cn('relative w-[64px] overflow-hidden rounded-[3px] bg-[#FBF7F0] shadow-sm', selected ? 'ring-2 ring-primary' : 'ring-1 ring-[#E6DFD3]', over && 'ring-2 ring-danger')}
        style={{ aspectRatio: '210 / 297', containerType: 'inline-size', fontFamily: 'Georgia, serif' }}>
        <div className="pointer-events-none absolute inset-0">{render}</div>
      </div>
      <span className={cn('text-[11px] tabular-nums', over ? 'text-danger font-semibold' : 'text-gray-500')}>{index + 1}{over ? ' !' : ''}</span>
    </button>
  );
}

export default function PagesStrip({ pages, selectedId, onSelect, renderPage, onAdd, onMove, onDuplicate, onRemove, onReorder }: {
  pages: LayoutPage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderPage: (page: LayoutPage) => ReactNode;
  onAdd: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** Page glissée (`from`) déposée sur une autre (`to`). */
  onReorder: (from: string, to: string) => void;
}) {
  const selected = pages.find((p) => p.id === selectedId);
  const movable = selected?.kind === 'blocks' || selected?.kind === 'contact';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="flex items-end gap-2 overflow-x-auto pb-1">
        {pages.map((p, i) => (
          <Thumb key={p.id} index={i} page={p} selected={p.id === selectedId} onSelect={() => onSelect(p.id)}
            onDropPage={(from) => onReorder(from, p.id)} render={renderPage(p)} />
        ))}
        <button type="button" onClick={onAdd} aria-label="Ajouter une page"
          className="flex h-[90px] w-[64px] flex-shrink-0 items-center justify-center rounded-[3px] border border-dashed border-primary/50 text-primary hover:bg-primary-50">
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {selected && (
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2 text-sm">
          <span className="mr-2 text-gray-500">Page {pages.indexOf(selected) + 1} ({KIND_LABEL[selected.kind]})</span>
          <button type="button" disabled={!movable} onClick={() => onMove(-1)} aria-label="Avancer la page" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" disabled={!movable} onClick={() => onMove(1)} aria-label="Reculer la page" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
          <button type="button" disabled={selected.kind !== 'blocks'} onClick={onDuplicate} aria-label="Dupliquer la page" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Copy className="h-4 w-4" /></button>
          <button type="button" disabled={selected.kind === 'form'} onClick={onRemove} aria-label="Supprimer la page" className="rounded-lg p-1.5 text-danger hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
