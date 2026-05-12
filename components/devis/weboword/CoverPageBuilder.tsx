// components/devis/weboword/CoverPageBuilder.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { Type, ImagePlus, Square, Trash2 } from 'lucide-react'
import type { CoverPageConfig, CoverPageLayoutElement } from './weboword.types'
import { PhotoBuilder } from './PhotoBuilder'

type Props = {
  config: CoverPageConfig
  onChange: (config: CoverPageConfig) => void
}

const CANVAS_W = 794
const CANVAS_H = 1123

export function CoverPageBuilder({ config, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPhotoBuilder, setShowPhotoBuilder] = useState(false)
  const [addingPhotoId, setAddingPhotoId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ elemId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  function updateElement(id: string, patch: Partial<CoverPageLayoutElement>) {
    onChange({
      ...config,
      customLayout: config.customLayout.map(el => el.id === id ? { ...el, ...patch } : el),
    })
  }

  function removeElement(id: string) {
    onChange({ ...config, customLayout: config.customLayout.filter(el => el.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  function addElement(type: CoverPageLayoutElement['type']) {
    const id = crypto.randomUUID()
    const el: CoverPageLayoutElement = {
      id,
      type,
      x: 100,
      y: 100,
      width: type === 'text' ? 300 : type === 'photo' ? 280 : 200,
      height: type === 'text' ? 60 : type === 'photo' ? 200 : 100,
      content: type === 'text' ? 'Texte' : type === 'photo' ? '' : '#9c27b0',
      fontSize: 24,
      color: '#1a1a1a',
      bgColor: 'transparent',
    }
    onChange({ ...config, customLayout: [...config.customLayout, el] })
    setSelectedId(id)
    if (type === 'photo') {
      setAddingPhotoId(id)
      setShowPhotoBuilder(true)
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedId(id)
    const el = config.customLayout.find(x => x.id === id)
    if (!el || !canvasRef.current) return
    dragState.current = { elemId: id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y }
  }, [config.customLayout])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scale = CANVAS_W / rect.width
    const dx = (e.clientX - dragState.current.startX) * scale
    const dy = (e.clientY - dragState.current.startY) * scale
    const el = config.customLayout.find(x => x.id === dragState.current!.elemId)
    if (!el) return
    updateElement(dragState.current.elemId, {
      x: Math.max(0, Math.min(CANVAS_W - el.width, dragState.current.origX + dx)),
      y: Math.max(0, Math.min(CANVAS_H - el.height, dragState.current.origY + dy)),
    })
  }, [config.customLayout]) // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseUp = useCallback(() => { dragState.current = null }, [])

  const selected = config.customLayout.find(el => el.id === selectedId)

  return (
    <div className="flex gap-4 p-4">
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative bg-white shadow-xl flex-shrink-0 cursor-default"
        style={{ width: '100%', maxWidth: 595, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={() => setSelectedId(null)}
      >
        {config.customLayout.map(el => (
          <div
            key={el.id}
            className={`absolute cursor-move ${selectedId === el.id ? 'ring-2 ring-purple-500 ring-offset-1' : 'hover:ring-1 hover:ring-purple-300'}`}
            style={{
              left: `${(el.x / CANVAS_W) * 100}%`,
              top: `${(el.y / CANVAS_H) * 100}%`,
              width: `${(el.width / CANVAS_W) * 100}%`,
              height: `${(el.height / CANVAS_H) * 100}%`,
              background: el.type === 'shape' ? el.content : el.bgColor ?? 'transparent',
            }}
            onMouseDown={e => onMouseDown(e, el.id)}
          >
            {el.type === 'text' && (
              <span style={{ fontSize: `${(el.fontSize ?? 24) * 0.75}px`, color: el.color, fontWeight: el.fontWeight }}>{el.content}</span>
            )}
            {el.type === 'photo' && el.content && (
              <img src={el.content} alt="" className="w-full h-full object-cover" draggable={false} />
            )}
            {el.type === 'photo' && !el.content && (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs">Photo</div>
            )}
          </div>
        ))}
      </div>

      {/* Controls panel */}
      <div className="w-56 flex flex-col gap-3 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajouter</p>
        <button onClick={() => addElement('text')} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-purple-50 text-sm">
          <Type className="w-4 h-4 text-purple-600" /> Texte
        </button>
        <button onClick={() => addElement('photo')} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-purple-50 text-sm">
          <ImagePlus className="w-4 h-4 text-purple-600" /> Photo
        </button>
        <button onClick={() => addElement('shape')} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-purple-50 text-sm">
          <Square className="w-4 h-4 text-purple-600" /> Forme
        </button>

        {selected && (
          <>
            <hr className="border-gray-200 my-1" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Propriétés</p>
            {selected.type === 'text' && (
              <>
                <textarea
                  value={selected.content}
                  onChange={e => updateElement(selected.id, { content: e.target.value })}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm resize-none"
                  rows={2}
                />
                <div>
                  <label className="text-xs text-gray-500">Taille police</label>
                  <input type="number" min={8} max={120} value={selected.fontSize ?? 24}
                    onChange={e => updateElement(selected.id, { fontSize: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-2 py-1 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Couleur</label>
                  <input type="color" value={selected.color ?? '#1a1a1a'}
                    onChange={e => updateElement(selected.id, { color: e.target.value })}
                    className="w-full h-8 rounded border mt-1 cursor-pointer" />
                </div>
              </>
            )}
            {selected.type === 'photo' && (
              <button
                onClick={() => { setAddingPhotoId(selected.id); setShowPhotoBuilder(true) }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-purple-50 text-sm"
              >
                <ImagePlus className="w-4 h-4" />
                {selected.content ? 'Changer' : 'Ajouter photo'}
              </button>
            )}
            {selected.type === 'shape' && (
              <div>
                <label className="text-xs text-gray-500">Couleur</label>
                <input type="color" value={selected.content}
                  onChange={e => updateElement(selected.id, { content: e.target.value })}
                  className="w-full h-8 rounded border mt-1 cursor-pointer" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">Largeur (px)</label>
                <input type="number" value={Math.round(selected.width)}
                  onChange={e => updateElement(selected.id, { width: Math.max(20, parseInt(e.target.value) || 20) })}
                  className="w-full border rounded px-2 py-1 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Hauteur (px)</label>
                <input type="number" value={Math.round(selected.height)}
                  onChange={e => updateElement(selected.id, { height: Math.max(20, parseInt(e.target.value) || 20) })}
                  className="w-full border rounded px-2 py-1 text-sm mt-1" />
              </div>
            </div>
            <button
              onClick={() => removeElement(selected.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm mt-2"
            >
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          </>
        )}
      </div>

      {showPhotoBuilder && (
        <PhotoBuilder
          frameAspect={4 / 3}
          onApply={photo => {
            if (addingPhotoId) updateElement(addingPhotoId, { content: photo.url })
            setShowPhotoBuilder(false)
            setAddingPhotoId(null)
          }}
          onClose={() => { setShowPhotoBuilder(false); setAddingPhotoId(null) }}
        />
      )}
    </div>
  )
}
