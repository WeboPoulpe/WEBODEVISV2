// components/devis/weboword/PhotoBlock.tsx
'use client'

import { useState } from 'react'
import { PhotoBuilder } from './PhotoBuilder'
import type { PhotoItem } from './weboword.types'

// ── HTML generator (used for insertion into contentEditable) ──────────────────

export function generatePhotoBlockHtml(photos: PhotoItem[], cols: 1 | 2 | 3 | 4 = 2): string {
  const gap = 12
  const colWidth = `calc(${100 / cols}% - ${gap * (cols - 1) / cols}px)`

  const cells = photos.map(p => {
    const imgStyle = `transform:scale(${p.transform.zoom}) translate(${p.transform.x}%,${p.transform.y}%) rotate(${p.transform.rotation}deg);transform-origin:center;`
    return `<div style="width:${colWidth};display:inline-block;vertical-align:top;margin-bottom:${gap}px;">
  <div style="width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:6px;background:#f0f0f0;">
    <img src="${p.url}" alt="" style="width:100%;height:100%;object-fit:cover;${imgStyle}" />
  </div>
  ${p.caption ? `<p style="text-align:center;font-size:11px;color:#666;margin:4px 0 0;">${p.caption}</p>` : ''}
</div>`
  }).join(`\n`)

  return `<div class="weboword-photo-block" style="margin:16px 0;display:flex;flex-wrap:wrap;gap:${gap}px;">
${cells}
</div>`
}

// ── React component — photo picker shown before insertion ──────────────────────

type PhotoBlockPickerProps = {
  onInsert: (html: string) => void
  onClose: () => void
}

export function PhotoBlockPicker({ onInsert, onClose }: PhotoBlockPickerProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [cols, setCols] = useState<1 | 2 | 3 | 4>(2)

  function addPhoto() { setEditingIdx(-1) }  // -1 means new

  function savePhoto(photo: PhotoItem) {
    if (editingIdx === -1) {
      setPhotos(prev => [...prev, photo])
    } else if (editingIdx !== null) {
      setPhotos(prev => prev.map((p, i) => i === editingIdx ? photo : p))
    }
    setEditingIdx(null)
  }

  function handleInsert() {
    if (photos.length === 0) return
    onInsert(generatePhotoBlockHtml(photos, cols))
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Insérer un bloc photo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {/* Cols selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Colonnes :</span>
            {([1, 2, 3, 4] as const).map(n => (
              <button key={n} onClick={() => setCols(n)}
                className={`w-8 h-8 rounded-lg border text-sm font-medium ${cols === n ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-gray-50'}`}>
                {n}
              </button>
            ))}
          </div>

          {/* Photos grid */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {photos.map((p, i) => (
              <div key={p.id} className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => setEditingIdx(i)}>
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="text-white text-xs font-medium">Modifier</span>
                </div>
              </div>
            ))}
            <button onClick={addPhoto}
              className="aspect-[4/3] rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-colors text-sm">
              + Photo
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Annuler</button>
          <button onClick={handleInsert} disabled={photos.length === 0}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
            Insérer
          </button>
        </div>
      </div>

      {editingIdx !== null && (
        <PhotoBuilder
          initial={editingIdx >= 0 && photos[editingIdx] ? photos[editingIdx] : undefined}
          frameAspect={4 / 3}
          onApply={savePhoto}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  )
}
