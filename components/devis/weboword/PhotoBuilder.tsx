// components/devis/weboword/PhotoBuilder.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { X, RotateCw, ZoomIn, ZoomOut, Upload, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { PhotoItem, PhotoTransform } from './weboword.types'
import { DEFAULT_TRANSFORM } from './weboword.types'

type Props = {
  initial?: PhotoItem
  frameAspect?: number  // width/height ratio of target frame, default 4/3
  onApply: (photo: PhotoItem) => void
  onClose: () => void
}

export function PhotoBuilder({ initial, frameAspect = 4 / 3, onApply, onClose }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '')
  const [transform, setTransform] = useState<PhotoTransform>(initial?.transform ?? DEFAULT_TRANSFORM)
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ mouseX: number; mouseY: number; tx: number; ty: number } | null>(null)
  const supabase = createClient()

  // ── Drag to reposition ─────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, tx: transform.x, ty: transform.y }
  }, [transform.x, transform.y])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current) return
    const dx = (e.clientX - dragStart.current.mouseX) / 5
    const dy = (e.clientY - dragStart.current.mouseY) / 5
    setTransform(t => ({
      ...t,
      x: Math.max(-50, Math.min(50, dragStart.current!.tx + dx)),
      y: Math.max(-50, Math.min(50, dragStart.current!.ty + dy)),
    }))
  }, [isDragging])

  const onMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStart.current = null
  }, [])

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    setIsUploading(true)
    const ext = file.name.split('.').pop()
    const path = `cover-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('storage').upload(path, file, { upsert: false })
    if (error) { console.error(error); setIsUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('storage').getPublicUrl(path)
    setUrl(publicUrl)
    setTransform(DEFAULT_TRANSFORM)
    setIsUploading(false)
  }

  function handleApply() {
    if (!url) return
    onApply({
      id: initial?.id ?? crypto.randomUUID(),
      url,
      caption: caption.trim() || undefined,
      transform,
    })
  }

  const imgStyle: React.CSSProperties = {
    transform: `scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%) rotate(${transform.rotation}deg)`,
    transformOrigin: 'center',
    transition: isDragging ? 'none' : 'transform 0.15s ease',
    userSelect: 'none',
    pointerEvents: 'none',
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="font-semibold text-lg text-gray-800">Éditeur de photo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Preview zone */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center p-8 overflow-hidden">
            {url ? (
              <div
                className="relative overflow-hidden rounded-xl shadow-lg w-full cursor-grab active:cursor-grabbing select-none"
                style={{ aspectRatio: frameAspect }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                <img
                  src={url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={imgStyle}
                  draggable={false}
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-xl pointer-events-none" />
              </div>
            ) : (
              <label className="flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed border-gray-300 rounded-2xl p-16 hover:border-purple-400 hover:bg-purple-50/30 transition-all w-full">
                <Upload className="w-10 h-10 text-gray-400" />
                <div className="text-center">
                  <p className="text-gray-600 font-medium">Cliquer ou glisser une photo</p>
                  <p className="text-gray-400 text-sm mt-1">JPG, PNG, WEBP</p>
                </div>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </label>
            )}
          </div>

          {/* Controls */}
          <div className="w-64 border-l p-5 flex flex-col gap-5 overflow-y-auto flex-shrink-0">
            {url && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-3 py-2.5 hover:border-purple-400 hover:text-purple-600 transition-colors">
                <Upload className="w-4 h-4" />
                Changer la photo
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </label>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Zoom</label>
              <div className="flex items-center gap-2">
                <ZoomOut className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input type="range" min="0.5" max="3" step="0.05"
                  value={transform.zoom}
                  onChange={e => setTransform(t => ({ ...t, zoom: parseFloat(e.target.value) }))}
                  className="flex-1 accent-purple-600" />
                <ZoomIn className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
              <span className="text-xs text-gray-400">{Math.round(transform.zoom * 100)}%</span>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Rotation</label>
              <div className="flex items-center gap-2">
                <input type="range" min="-180" max="180" step="1"
                  value={transform.rotation}
                  onChange={e => setTransform(t => ({ ...t, rotation: parseFloat(e.target.value) }))}
                  className="flex-1 accent-purple-600" />
                <button
                  onClick={() => setTransform(t => ({ ...t, rotation: ((Math.round(t.rotation / 90) + 1) * 90) % 360 }))}
                  className="p-1.5 rounded-lg border hover:bg-gray-50 flex-shrink-0"
                  title="Rotation +90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs text-gray-400">{transform.rotation}°</span>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2">Glisser l'image dans l'aperçu pour la repositionner</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Légende</label>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Ajouter une légende…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <button
              onClick={() => setTransform(DEFAULT_TRANSFORM)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm font-medium">
            Annuler
          </button>
          <button
            onClick={handleApply}
            disabled={!url || isUploading}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Upload en cours…' : 'Appliquer'}
          </button>
        </div>
      </div>
    </div>
  )
}
