// components/devis/weboword/CoverPageBuilder.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Type, ImagePlus, Square, Trash2, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown, Copy,
} from 'lucide-react'
import type { CoverPageConfig, CoverPageLayoutElement } from './weboword.types'
import { PhotoBuilder } from './PhotoBuilder'

type Props = {
  config: CoverPageConfig
  onChange: (config: CoverPageConfig) => void
}

const CANVAS_W = 794
const CANVAS_H = 1123

type Corner = 'nw' | 'ne' | 'sw' | 'se'

type DragState =
  | { mode: 'move'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { mode: 'resize'; id: string; corner: Corner; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number }

const FONT_FAMILIES = [
  'Georgia', 'Times New Roman', 'Garamond', 'Palatino',
  'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Tahoma',
  'Courier New',
]

const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5'
const inputCls = 'w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400'

export function CoverPageBuilder({ config, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPhotoBuilder, setShowPhotoBuilder] = useState(false)
  const [addingPhotoId, setAddingPhotoId] = useState<string | null>(null)
  const [displayW, setDisplayW] = useState(CANVAS_W)
  const outerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)

  // Track canvas display width for coordinate conversion
  useEffect(() => {
    if (!outerRef.current) return
    const ro = new ResizeObserver(entries => setDisplayW(entries[0].contentRect.width))
    ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [])

  const scale = displayW / CANVAS_W

  function toCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = outerRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }

  function upd(id: string, patch: Partial<CoverPageLayoutElement>) {
    onChange({ ...config, customLayout: config.customLayout.map(el => el.id === id ? { ...el, ...patch } : el) })
  }

  function addElement(type: CoverPageLayoutElement['type']) {
    const id = crypto.randomUUID()
    const el: CoverPageLayoutElement = {
      id, type,
      x: 100, y: 100,
      width: type === 'text' ? 340 : type === 'photo' ? 300 : 240,
      height: type === 'text' ? 70 : type === 'photo' ? 220 : 80,
      content: type === 'text' ? 'Texte' : type === 'photo' ? '' : '#9c27b0',
      fontSize: 28, fontFamily: 'Georgia', color: '#1a1a1a',
      bgColor: 'transparent', opacity: 1,
    }
    onChange({ ...config, customLayout: [...config.customLayout, el] })
    setSelectedId(id)
    if (type === 'photo') { setAddingPhotoId(id); setShowPhotoBuilder(true) }
  }

  function remove(id: string) {
    onChange({ ...config, customLayout: config.customLayout.filter(el => el.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  function duplicate(id: string) {
    const el = config.customLayout.find(e => e.id === id)
    if (!el) return
    const copy = { ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }
    onChange({ ...config, customLayout: [...config.customLayout, copy] })
    setSelectedId(copy.id)
  }

  function moveLayer(id: string, dir: 'up' | 'down') {
    const arr = [...config.customLayout]
    const idx = arr.findIndex(el => el.id === id)
    if (idx === -1) return
    if (dir === 'up' && idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    if (dir === 'down' && idx > 0) [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]
    onChange({ ...config, customLayout: arr })
  }

  const onElemMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(id)
    const el = config.customLayout.find(x => x.id === id)
    if (!el) return
    dragState.current = { mode: 'move', id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y }
  }, [config.customLayout])

  const onHandleMouseDown = useCallback((e: React.MouseEvent, id: string, corner: Corner) => {
    e.stopPropagation()
    e.preventDefault()
    const el = config.customLayout.find(x => x.id === id)
    if (!el) return
    dragState.current = { mode: 'resize', id, corner, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.width, origH: el.height }
  }, [config.customLayout])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragState.current
    if (!d) return
    const dxC = (e.clientX - d.startX) / scale
    const dyC = (e.clientY - d.startY) / scale

    if (d.mode === 'move') {
      const el = config.customLayout.find(x => x.id === d.id)
      if (!el) return
      upd(d.id, {
        x: Math.max(0, Math.min(CANVAS_W - el.width, d.origX + dxC)),
        y: Math.max(0, Math.min(CANVAS_H - el.height, d.origY + dyC)),
      })
    } else {
      const { corner, origX, origY, origW, origH } = d
      let nx = origX, ny = origY, nw = origW, nh = origH
      if (corner === 'se') { nw = Math.max(20, origW + dxC); nh = Math.max(20, origH + dyC) }
      else if (corner === 'sw') { nx = origX + dxC; nw = Math.max(20, origW - dxC); nh = Math.max(20, origH + dyC) }
      else if (corner === 'ne') { nw = Math.max(20, origW + dxC); ny = origY + dyC; nh = Math.max(20, origH - dyC) }
      else { nx = origX + dxC; ny = origY + dyC; nw = Math.max(20, origW - dxC); nh = Math.max(20, origH - dyC) }
      upd(d.id, { x: nx, y: ny, width: nw, height: nh })
    }
  }, [config.customLayout, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseUp = useCallback(() => { dragState.current = null }, [])

  const selected = config.customLayout.find(el => el.id === selectedId)

  return (
    <div className="flex flex-col select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fond</span>
          <input type="color" value={config.canvasBg ?? '#ffffff'}
            onChange={e => onChange({ ...config, canvasBg: e.target.value })}
            className="w-7 h-7 rounded border cursor-pointer p-0.5" />
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <button onClick={() => addElement('text')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white hover:bg-purple-50 hover:border-purple-300 text-sm text-gray-700 transition-colors">
          <Type className="w-3.5 h-3.5 text-purple-500" /> Texte
        </button>
        <button onClick={() => addElement('photo')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white hover:bg-purple-50 hover:border-purple-300 text-sm text-gray-700 transition-colors">
          <ImagePlus className="w-3.5 h-3.5 text-purple-500" /> Photo
        </button>
        <button onClick={() => addElement('shape')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-white hover:bg-purple-50 hover:border-purple-300 text-sm text-gray-700 transition-colors">
          <Square className="w-3.5 h-3.5 text-purple-500" /> Forme
        </button>

        {selected && (
          <>
            <div className="w-px h-5 bg-gray-200" />
            <button onClick={() => duplicate(selected.id)} title="Dupliquer"
              className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
              <Copy className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button onClick={() => moveLayer(selected.id, 'up')} title="Avancer d'un calque"
              className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
              <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button onClick={() => moveLayer(selected.id, 'down')} title="Reculer d'un calque"
              className="p-1.5 rounded-lg border bg-white hover:bg-gray-50 transition-colors">
              <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button onClick={() => remove(selected.id)} title="Supprimer"
              className="p-1.5 rounded-lg border bg-white hover:bg-red-50 text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={outerRef}
        className="relative overflow-hidden cursor-default"
        style={{ width: '100%', aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={() => setSelectedId(null)}
      >
        {/* Inner canvas at native resolution, scaled via CSS transform */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: CANVAS_W, height: CANVAS_H,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            background: config.canvasBg ?? '#ffffff',
          }}
        >
          {config.customLayout.map(el => (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.width, height: el.height,
                background: el.type === 'shape' ? el.content : (el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : 'transparent'),
                opacity: el.opacity ?? 1,
                borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                border: (el.borderWidth && el.borderWidth > 0) ? `${el.borderWidth}px solid ${el.borderColor ?? '#000000'}` : undefined,
                cursor: 'move',
                boxSizing: 'border-box',
                outline: selectedId === el.id ? '2px solid #9c27b0' : undefined,
                outlineOffset: selectedId === el.id ? '1px' : undefined,
              }}
              onMouseDown={e => onElemMouseDown(e, el.id)}
              onClick={e => e.stopPropagation()}
            >
              {el.type === 'text' && (
                <div style={{
                  width: '100%', height: '100%', overflow: 'hidden',
                  padding: '4px', boxSizing: 'border-box',
                  fontSize: `${el.fontSize ?? 24}px`,
                  fontFamily: el.fontFamily ?? 'Georgia',
                  fontWeight: el.fontWeight ?? 'normal',
                  fontStyle: el.fontStyle ?? 'normal',
                  textDecoration: el.textDecoration ?? 'none',
                  textAlign: (el.textAlign as React.CSSProperties['textAlign']) ?? 'left',
                  letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                  color: el.color ?? '#1a1a1a',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {el.content}
                </div>
              )}
              {el.type === 'photo' && el.content && (
                <img src={el.content} alt="" draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined }} />
              )}
              {el.type === 'photo' && !el.content && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', color: '#9ca3af', fontSize: 14 }}>
                  Photo
                </div>
              )}

              {/* Resize handles */}
              {selectedId === el.id && (['nw', 'ne', 'sw', 'se'] as Corner[]).map(corner => (
                <div
                  key={corner}
                  style={{
                    position: 'absolute',
                    width: 12, height: 12,
                    background: '#ffffff',
                    border: '2px solid #9c27b0',
                    borderRadius: 2,
                    left: corner.includes('w') ? -6 : undefined,
                    right: corner.includes('e') ? -6 : undefined,
                    top: corner.includes('n') ? -6 : undefined,
                    bottom: corner.includes('s') ? -6 : undefined,
                    cursor: (corner === 'se' || corner === 'nw') ? 'nwse-resize' : 'nesw-resize',
                    zIndex: 10,
                  }}
                  onMouseDown={e => onHandleMouseDown(e, el.id, corner)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Properties panel ── */}
      {selected && (
        <div className="border-t bg-gray-50 p-4">

          {/* Position & size — always shown */}
          <div className="mb-4">
            <p className={labelCls}>Position &amp; Taille</p>
            <div className="grid grid-cols-4 gap-2">
              {([
                { label: 'X', key: 'x', min: 0, max: CANVAS_W },
                { label: 'Y', key: 'y', min: 0, max: CANVAS_H },
                { label: 'Larg.', key: 'width', min: 20, max: CANVAS_W },
                { label: 'Haut.', key: 'height', min: 20, max: CANVAS_H },
              ] as { label: string; key: keyof CoverPageLayoutElement; min: number; max: number }[]).map(({ label, key, min, max }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input type="number" min={min} max={max}
                    value={Math.round(selected[key] as number)}
                    onChange={e => upd(selected.id, { [key]: Math.max(min, Math.min(max, parseInt(e.target.value) || min)) })}
                    className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Text properties */}
          {selected.type === 'text' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Contenu</label>
                <textarea
                  value={selected.content}
                  onChange={e => upd(selected.id, { content: e.target.value })}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-400"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Police</label>
                  <select value={selected.fontFamily ?? 'Georgia'}
                    onChange={e => upd(selected.id, { fontFamily: e.target.value })}
                    className={inputCls}>
                    {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Taille (px)</label>
                  <input type="number" min={6} max={300} value={selected.fontSize ?? 24}
                    onChange={e => upd(selected.id, { fontSize: parseInt(e.target.value) || 24 })}
                    className={inputCls} />
                </div>
              </div>

              {/* Style toggles */}
              <div>
                <label className={labelCls}>Style</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { icon: <Bold className="w-3.5 h-3.5" />, prop: 'fontWeight', on: 'bold', off: 'normal', label: 'Gras' },
                    { icon: <Italic className="w-3.5 h-3.5" />, prop: 'fontStyle', on: 'italic', off: 'normal', label: 'Italique' },
                    { icon: <Underline className="w-3.5 h-3.5" />, prop: 'textDecoration', on: 'underline', off: 'none', label: 'Souligné' },
                  ] as { icon: React.ReactNode; prop: keyof CoverPageLayoutElement; on: string; off: string; label: string }[]).map(({ icon, prop, on, off, label }) => (
                    <button key={prop} title={label}
                      onClick={() => upd(selected.id, { [prop]: (selected[prop] as string) === on ? off : on })}
                      className={`p-1.5 rounded border transition-colors ${(selected[prop] as string) === on ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      {icon}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-gray-200 mx-0.5" />
                  {([
                    { icon: <AlignLeft className="w-3.5 h-3.5" />, value: 'left' },
                    { icon: <AlignCenter className="w-3.5 h-3.5" />, value: 'center' },
                    { icon: <AlignRight className="w-3.5 h-3.5" />, value: 'right' },
                  ]).map(({ icon, value }) => (
                    <button key={value} title={value}
                      onClick={() => upd(selected.id, { textAlign: value as 'left' | 'center' | 'right' })}
                      className={`p-1.5 rounded border transition-colors ${(selected.textAlign ?? 'left') === value ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Couleur texte</label>
                  <input type="color" value={selected.color ?? '#1a1a1a'}
                    onChange={e => upd(selected.id, { color: e.target.value })}
                    className="w-full h-8 rounded border cursor-pointer p-0.5" />
                </div>
                <div>
                  <label className={labelCls}>Fond bloc</label>
                  <input type="color" value={!selected.bgColor || selected.bgColor === 'transparent' ? '#ffffff' : selected.bgColor}
                    onChange={e => upd(selected.id, { bgColor: e.target.value })}
                    className="w-full h-8 rounded border cursor-pointer p-0.5" />
                </div>
                <div>
                  <label className={labelCls}>Espacement</label>
                  <input type="number" min={-5} max={30} value={selected.letterSpacing ?? 0}
                    onChange={e => upd(selected.id, { letterSpacing: parseInt(e.target.value) })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Opacité %</label>
                  <input type="number" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)}
                    onChange={e => upd(selected.id, { opacity: Math.max(0, Math.min(100, parseInt(e.target.value) || 100)) / 100 })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Arrondi (px)</label>
                  <input type="number" min={0} max={400} value={selected.borderRadius ?? 0}
                    onChange={e => upd(selected.id, { borderRadius: parseInt(e.target.value) || 0 })}
                    className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Photo properties */}
          {selected.type === 'photo' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setAddingPhotoId(selected.id); setShowPhotoBuilder(true) }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-purple-50 text-sm transition-colors w-full">
                <ImagePlus className="w-4 h-4 text-purple-600" />
                {selected.content ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Arrondi (px)</label>
                  <input type="number" min={0} max={600} value={selected.borderRadius ?? 0}
                    onChange={e => upd(selected.id, { borderRadius: parseInt(e.target.value) || 0 })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Opacité %</label>
                  <input type="number" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)}
                    onChange={e => upd(selected.id, { opacity: Math.max(0, Math.min(100, parseInt(e.target.value) || 100)) / 100 })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Bordure (px)</label>
                  <input type="number" min={0} max={30} value={selected.borderWidth ?? 0}
                    onChange={e => upd(selected.id, { borderWidth: parseInt(e.target.value) || 0 })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Couleur bordure</label>
                  <input type="color" value={selected.borderColor ?? '#000000'}
                    onChange={e => upd(selected.id, { borderColor: e.target.value })}
                    className="w-full h-8 rounded border cursor-pointer p-0.5" />
                </div>
              </div>
            </div>
          )}

          {/* Shape properties */}
          {selected.type === 'shape' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Couleur</label>
                <input type="color" value={selected.content || '#9c27b0'}
                  onChange={e => upd(selected.id, { content: e.target.value })}
                  className="w-full h-8 rounded border cursor-pointer p-0.5" />
              </div>
              <div>
                <label className={labelCls}>Opacité %</label>
                <input type="number" min={0} max={100} value={Math.round((selected.opacity ?? 1) * 100)}
                  onChange={e => upd(selected.id, { opacity: Math.max(0, Math.min(100, parseInt(e.target.value) || 100)) / 100 })}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Arrondi (px)</label>
                <input type="number" min={0} max={600} value={selected.borderRadius ?? 0}
                  onChange={e => upd(selected.id, { borderRadius: parseInt(e.target.value) || 0 })}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Bordure (px)</label>
                <input type="number" min={0} max={30} value={selected.borderWidth ?? 0}
                  onChange={e => upd(selected.id, { borderWidth: parseInt(e.target.value) || 0 })}
                  className={inputCls} />
              </div>
              {(selected.borderWidth ?? 0) > 0 && (
                <div>
                  <label className={labelCls}>Couleur bordure</label>
                  <input type="color" value={selected.borderColor ?? '#000000'}
                    onChange={e => upd(selected.id, { borderColor: e.target.value })}
                    className="w-full h-8 rounded border cursor-pointer p-0.5" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showPhotoBuilder && (
        <PhotoBuilder
          frameAspect={4 / 3}
          onApply={photo => {
            if (addingPhotoId) upd(addingPhotoId, { content: photo.url })
            setShowPhotoBuilder(false)
            setAddingPhotoId(null)
          }}
          onClose={() => { setShowPhotoBuilder(false); setAddingPhotoId(null) }}
        />
      )}
    </div>
  )
}
