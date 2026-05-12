// components/devis/weboword/PhotosPage.tsx
'use client'

import { useState } from 'react'
import {
  DndContext, closestCenter, DragEndEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Trash2, ImagePlus, LayoutGrid } from 'lucide-react'
import type { PhotosPageConfig, PhotosPagePage, PhotosPageCell, PhotosPageLayout } from './weboword.types'
import { DEFAULT_TRANSFORM } from './weboword.types'
import { PhotoBuilder } from './PhotoBuilder'

type Props = {
  config: PhotosPageConfig
  onChange: (config: PhotosPageConfig) => void
}

const LAYOUT_OPTIONS: { value: PhotosPageLayout; label: string; cols: number }[] = [
  { value: '1col', label: '1 colonne', cols: 1 },
  { value: '2col', label: '2 colonnes', cols: 2 },
  { value: '3col', label: '3 colonnes', cols: 3 },
  { value: 'mosaic', label: 'Mosaïque', cols: 2 },
]

function SortableCell({ cell, onEdit, onRemove }: {
  cell: PhotosPageCell
  onEdit: (cell: PhotosPageCell) => void
  onRemove: (cellId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cell.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const imgStyle: React.CSSProperties = {
    transform: `scale(${cell.transform.zoom}) translate(${cell.transform.x}%, ${cell.transform.y}%) rotate(${cell.transform.rotation}deg)`,
    transformOrigin: 'center',
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-lg overflow-hidden bg-gray-100">
      <div className="w-full aspect-[4/3] overflow-hidden">
        {cell.url ? (
          <img src={cell.url} alt="" className="w-full h-full object-cover" style={imgStyle} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ImagePlus className="w-8 h-8" />
          </div>
        )}
      </div>
      {cell.caption && (
        <p className="text-xs text-center text-gray-600 px-2 py-1.5">{cell.caption}</p>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        <button onClick={() => onEdit(cell)}
          className="bg-white rounded-lg p-1.5 shadow text-gray-700 hover:text-purple-600">
          <ImagePlus className="w-4 h-4" />
        </button>
        <button onClick={() => onRemove(cell.id)}
          className="bg-white rounded-lg p-1.5 shadow text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
        <div {...attributes} {...listeners}
          className="bg-white rounded-lg p-1.5 shadow text-gray-400 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

function PhotosPageSection({ page, onChange, onRemovePage }: {
  page: PhotosPagePage
  onChange: (page: PhotosPagePage) => void
  onRemovePage: () => void
}) {
  const [editingCell, setEditingCell] = useState<PhotosPageCell | null>(null)
  const sensors = useSensors(useSensor(PointerSensor))

  function addCell() {
    setEditingCell({
      id: crypto.randomUUID(),
      url: '',
      caption: '',
      size: 'medium',
      transform: DEFAULT_TRANSFORM,
    })
  }

  function saveCell(photo: { id: string; url: string; caption?: string; transform: typeof DEFAULT_TRANSFORM }) {
    if (!editingCell) return
    const updated: PhotosPageCell = { ...editingCell, url: photo.url, caption: photo.caption, transform: photo.transform }
    const exists = page.cells.find(c => c.id === editingCell.id)
    onChange({
      ...page,
      cells: exists
        ? page.cells.map(c => c.id === editingCell.id ? updated : c)
        : [...page.cells, updated],
    })
    setEditingCell(null)
  }

  function removeCell(cellId: string) {
    onChange({ ...page, cells: page.cells.filter(c => c.id !== cellId) })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = page.cells.findIndex(c => c.id === active.id)
    const newIdx = page.cells.findIndex(c => c.id === over.id)
    onChange({ ...page, cells: arrayMove(page.cells, oldIdx, newIdx) })
  }

  const cols = LAYOUT_OPTIONS.find(o => o.value === page.layout)?.cols ?? 2

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-gray-400" />
          <select
            value={page.layout}
            onChange={e => onChange({ ...page, layout: e.target.value as PhotosPageLayout })}
            className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {LAYOUT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button onClick={onRemovePage} className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1">
          <Trash2 className="w-3.5 h-3.5" /> Supprimer la page
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={page.cells.map(c => c.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {page.cells.map(cell => (
              <SortableCell
                key={cell.id}
                cell={cell}
                onEdit={setEditingCell}
                onRemove={removeCell}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button onClick={addCell}
        className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 border border-dashed border-purple-300 rounded-lg px-4 py-2.5 w-full justify-center hover:bg-purple-50 transition-colors">
        <Plus className="w-4 h-4" /> Ajouter une photo
      </button>

      {editingCell && (
        <PhotoBuilder
          initial={editingCell.url ? { id: editingCell.id, url: editingCell.url, caption: editingCell.caption, transform: editingCell.transform } : undefined}
          frameAspect={4 / 3}
          onApply={saveCell}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  )
}

export function PhotosPage({ config, onChange }: Props) {
  function addPage() {
    const newPage: PhotosPagePage = { id: crypto.randomUUID(), layout: '2col', cells: [] }
    onChange({ ...config, pages: [...config.pages, newPage] })
  }

  function updatePage(pageId: string, page: PhotosPagePage) {
    onChange({ ...config, pages: config.pages.map(p => p.id === pageId ? page : p) })
  }

  function removePage(pageId: string) {
    onChange({ ...config, pages: config.pages.filter(p => p.id !== pageId) })
  }

  return (
    <div className="flex flex-col gap-4">
      {config.pages.map((page, idx) => (
        <div key={page.id}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Page photos {idx + 1}
          </p>
          <PhotosPageSection
            page={page}
            onChange={p => updatePage(page.id, p)}
            onRemovePage={() => removePage(page.id)}
          />
        </div>
      ))}
      <button onClick={addPage}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-purple-600 border border-dashed border-gray-300 rounded-xl px-4 py-3 w-full justify-center hover:border-purple-300 transition-colors">
        <Plus className="w-4 h-4" /> Nouvelle page photos
      </button>
    </div>
  )
}
