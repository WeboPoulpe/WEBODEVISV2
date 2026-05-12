# WeboWord — Page de garde, Page photos & Photos dans le devis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page de garde paramétrable (5 templates + builder libre), une page photos finale, et des photos dans le corps du devis (par prestation + blocs libres insérables).

**Architecture:** Quatre nouveaux composants React modulaires (`PhotoBuilder`, `CoverPage`, `PhotosPage`, `PhotoBlock`) dans `components/devis/weboword/`. La page de garde et la page photos sont des composants React rendus au-dessus/en-dessous du `contentEditable` existant dans `WeboWordEditor`. Le `PhotoBuilder` est un modal global partagé par tous les contextes. Les configurations sont stockées en JSONB dans Supabase (`cover_page_config`, `photos_page_config`). La fonction `buildPrintHtml()` combine les trois sections pour le PDF. Il n'y a pas de framework de test dans ce projet — vérification manuelle uniquement.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Storage (bucket `storage`), @dnd-kit/sortable, Tailwind CSS, Lucide React.

---

## File Structure

**New files:**
- `components/devis/weboword/weboword.types.ts` — Shared types
- `components/devis/weboword/PhotoBuilder.tsx` — Photo crop/zoom/pan/rotate modal
- `components/devis/weboword/CoverPage.tsx` — Cover page (templates + builder toggle)
- `components/devis/weboword/CoverPage.templates.ts` — 5 template HTML generators
- `components/devis/weboword/CoverPageBuilder.tsx` — Free drag-and-drop builder
- `components/devis/weboword/PhotosPage.tsx` — Final photo page
- `components/devis/weboword/PhotoBlock.tsx` — Insertable photo block for devis body
- `components/devis/weboword/PageBreakIndicator.tsx` — Visual page break marker
- `sql/add_cover_photos_pages.sql` — DB migration

**Modified files:**
- `components/devis/WeboWordEditor.tsx` — State + render + save/load + toolbar
- `components/devis/WeboWordSidePanels.tsx` — New panels cover/photos + prestation photo
- `lib/generateQuoteHtml.ts` — Add cover page + photos page HTML functions

---

## Task 1: Install @dnd-kit + SQL migration

**Files:**
- Create: `sql/add_cover_photos_pages.sql`
- Run: `npm install`

- [ ] **Step 1: Install @dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages installed, no errors.

- [ ] **Step 2: Create migration SQL**

Create `sql/add_cover_photos_pages.sql`:

```sql
-- Page de garde config (JSON: template, clientName, address, eventDate, title, subtitle, photoUrl, photoTransform, customLayout)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS cover_page_config JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS photos_page_config JSONB DEFAULT NULL;

-- Photo par prestation
ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL;
```

- [ ] **Step 3: Run migration in Supabase Dashboard**

Copier le contenu de `sql/add_cover_photos_pages.sql` dans Supabase Dashboard → SQL Editor → Run.

Vérifier : `SELECT column_name FROM information_schema.columns WHERE table_name = 'quotes' AND column_name IN ('cover_page_config', 'photos_page_config');` doit retourner 2 lignes.

- [ ] **Step 4: Commit**

```bash
git add sql/add_cover_photos_pages.sql package.json package-lock.json
git commit -m "feat: install @dnd-kit + SQL migration for cover/photos pages"
```

---

## Task 2: Shared TypeScript types

**Files:**
- Create: `components/devis/weboword/weboword.types.ts`

- [ ] **Step 1: Create types file**

```typescript
// components/devis/weboword/weboword.types.ts

export type PhotoTransform = {
  zoom: number      // 1.0 = original, max 3.0
  x: number         // % offset horizontal (-50..50)
  y: number         // % offset vertical (-50..50)
  rotation: number  // degrees (-180..180)
}

export type PhotoItem = {
  id: string
  url: string
  caption?: string
  transform: PhotoTransform
}

export const DEFAULT_TRANSFORM: PhotoTransform = { zoom: 1, x: 0, y: 0, rotation: 0 }

export type CoverPageTemplate = 'mariage' | 'gastronomique' | 'business' | 'provence' | 'luxe'

export type CoverPageLayoutElement = {
  id: string
  type: 'text' | 'photo' | 'shape'
  x: number         // px from left of A4 canvas (794px wide)
  y: number         // px from top
  width: number     // px
  height: number    // px
  content: string   // text content, photo URL, or shape color
  fontSize?: number
  fontWeight?: string
  color?: string
  bgColor?: string
}

export type CoverPageConfig = {
  enabled: boolean
  mode: 'template' | 'builder'
  template: CoverPageTemplate
  clientName: string
  address: string
  eventDate: string
  title: string
  subtitle: string
  photoUrl: string
  photoTransform: PhotoTransform
  customLayout: CoverPageLayoutElement[]
}

export const DEFAULT_COVER_CONFIG: CoverPageConfig = {
  enabled: false,
  mode: 'template',
  template: 'mariage',
  clientName: '',
  address: '',
  eventDate: '',
  title: 'Proposition gastronomique',
  subtitle: '',
  photoUrl: '',
  photoTransform: { zoom: 1, x: 0, y: 0, rotation: 0 },
  customLayout: [],
}

export type PhotosPageCell = {
  id: string
  url: string
  caption?: string
  size: 'small' | 'medium' | 'large'
  transform: PhotoTransform
}

export type PhotosPageLayout = '1col' | '2col' | '3col' | 'mosaic'

export type PhotosPagePage = {
  id: string
  layout: PhotosPageLayout
  cells: PhotosPageCell[]
}

export type PhotosPageConfig = {
  enabled: boolean
  pages: PhotosPagePage[]
}

export const DEFAULT_PHOTOS_CONFIG: PhotosPageConfig = {
  enabled: false,
  pages: [],
}
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/weboword.types.ts
git commit -m "feat: shared types for weboword photo/cover features"
```

---

## Task 3: PhotoBuilder modal

**Files:**
- Create: `components/devis/weboword/PhotoBuilder.tsx`

Le PhotoBuilder est un modal réutilisable. Il permet d'uploader une photo, de la zoomer, la faire pivoter et la repositionner dans un cadre. Il appelle `onApply(photo: PhotoItem)` quand l'utilisateur valide.

- [ ] **Step 1: Create PhotoBuilder.tsx**

```tsx
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
```

- [ ] **Step 2: Vérification manuelle**

Importer et rendre `<PhotoBuilder onApply={console.log} onClose={() => {}} />` temporairement dans une page, vérifier :
- Le modal s'affiche
- On peut uploader une photo (elle apparaît dans le preview)
- Le drag repositionne l'image
- Les sliders zoom/rotation fonctionnent
- "Appliquer" appelle onApply avec `{ id, url, caption, transform }`

- [ ] **Step 3: Commit**

```bash
git add components/devis/weboword/PhotoBuilder.tsx
git commit -m "feat: PhotoBuilder modal shared component"
```

---

## Task 4: CoverPage templates

**Files:**
- Create: `components/devis/weboword/CoverPage.templates.ts`

Les templates génèrent du HTML avec styles inline (compatible browser preview ET PDF via `buildPrintHtml`). Chaque template est une fonction `(config: CoverPageConfig) => string`.

- [ ] **Step 1: Create CoverPage.templates.ts**

```typescript
// components/devis/weboword/CoverPage.templates.ts

import type { CoverPageConfig } from './weboword.types'

function photoStyle(transform: CoverPageConfig['photoTransform']) {
  return `transform: scale(${transform.zoom}) translate(${transform.x}%, ${transform.y}%) rotate(${transform.rotation}deg); transform-origin: center;`
}

function dateFr(s: string) {
  if (!s) return ''
  try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return s }
}

// ── Template 1: Mariage ─────────────────────────────────────────────────────
export function templateMariage(c: CoverPageConfig): string {
  return `
<div style="width:100%;min-height:1100px;background:#fdf8f0;font-family:Georgia,serif;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
  ${c.photoUrl ? `
  <div style="width:100%;height:420px;overflow:hidden;position:relative;">
    <img src="${c.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;${photoStyle(c.photoTransform)}" />
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,#fdf8f0 100%);"></div>
  </div>` : '<div style="height:120px;"></div>'}
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 60px;text-align:center;">
    <div style="width:60px;height:2px;background:#c9a96e;margin-bottom:32px;"></div>
    <h1 style="font-size:36px;font-weight:400;color:#2c1810;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">${c.title}</h1>
    ${c.subtitle ? `<p style="font-size:16px;color:#8b6a4a;font-style:italic;margin:0 0 32px;">${c.subtitle}</p>` : '<div style="margin-bottom:32px;"></div>'}
    <div style="width:60px;height:2px;background:#c9a96e;margin-bottom:40px;"></div>
    ${c.clientName ? `<p style="font-size:22px;color:#2c1810;margin:0 0 8px;font-weight:600;">${c.clientName}</p>` : ''}
    ${c.address ? `<p style="font-size:14px;color:#8b6a4a;margin:0 0 6px;">${c.address}</p>` : ''}
    ${c.eventDate ? `<p style="font-size:14px;color:#8b6a4a;margin:0;">${dateFr(c.eventDate)}</p>` : ''}
  </div>
  <div style="position:absolute;bottom:40px;left:0;right:0;text-align:center;">
    <div style="width:30px;height:1px;background:#c9a96e;display:inline-block;vertical-align:middle;margin-right:12px;"></div>
    <span style="font-size:11px;color:#c9a96e;letter-spacing:4px;text-transform:uppercase;">Proposition</span>
    <div style="width:30px;height:1px;background:#c9a96e;display:inline-block;vertical-align:middle;margin-left:12px;"></div>
  </div>
</div>`
}

// ── Template 2: Gastronomique ──────────────────────────────────────────────
export function templateGastronomique(c: CoverPageConfig): string {
  return `
<div style="width:100%;min-height:1100px;background:#1a1a1a;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;page-break-after:always;break-after:page;padding:60px 40px;box-sizing:border-box;">
  ${c.photoUrl ? `
  <div style="width:280px;height:280px;border-radius:50%;overflow:hidden;border:3px solid #c9a96e;margin-bottom:48px;flex-shrink:0;position:relative;">
    <img src="${c.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;${photoStyle(c.photoTransform)}" />
  </div>` : '<div style="margin-bottom:48px;"></div>'}
  <div style="text-align:center;">
    <p style="font-size:11px;color:#c9a96e;letter-spacing:6px;text-transform:uppercase;margin:0 0 20px;">— Gastronomie —</p>
    <h1 style="font-size:42px;font-weight:300;color:#ffffff;letter-spacing:1px;margin:0 0 16px;">${c.title}</h1>
    ${c.subtitle ? `<p style="font-size:16px;color:#c9a96e;font-style:italic;margin:0 0 48px;">${c.subtitle}</p>` : '<div style="margin-bottom:48px;"></div>'}
    <div style="width:40px;height:1px;background:#c9a96e;margin:0 auto 40px;"></div>
    ${c.clientName ? `<p style="font-size:24px;color:#ffffff;font-weight:300;letter-spacing:2px;margin:0 0 10px;">${c.clientName}</p>` : ''}
    ${c.address ? `<p style="font-size:13px;color:#888;margin:0 0 6px;">${c.address}</p>` : ''}
    ${c.eventDate ? `<p style="font-size:13px;color:#888;margin:0;">${dateFr(c.eventDate)}</p>` : ''}
  </div>
</div>`
}

// ── Template 3: Business ──────────────────────────────────────────────────
export function templateBusiness(c: CoverPageConfig): string {
  return `
<div style="width:100%;min-height:1100px;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:row;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
  <div style="width:8px;background:#9c27b0;flex-shrink:0;"></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px 60px;">
    <p style="font-size:11px;color:#9c27b0;letter-spacing:4px;text-transform:uppercase;margin:0 0 24px;">Proposition commerciale</p>
    <h1 style="font-size:40px;font-weight:700;color:#1a1a1a;line-height:1.15;margin:0 0 16px;">${c.title}</h1>
    ${c.subtitle ? `<p style="font-size:18px;color:#555;margin:0 0 48px;">${c.subtitle}</p>` : '<div style="margin-bottom:48px;"></div>'}
    <div style="width:48px;height:3px;background:#9c27b0;margin-bottom:40px;"></div>
    <div style="border-left:3px solid #e8e8e8;padding-left:20px;">
      ${c.clientName ? `<p style="font-size:20px;color:#1a1a1a;font-weight:600;margin:0 0 6px;">${c.clientName}</p>` : ''}
      ${c.address ? `<p style="font-size:14px;color:#666;margin:0 0 4px;">${c.address}</p>` : ''}
      ${c.eventDate ? `<p style="font-size:14px;color:#9c27b0;margin:0;">${dateFr(c.eventDate)}</p>` : ''}
    </div>
  </div>
  ${c.photoUrl ? `
  <div style="width:340px;flex-shrink:0;overflow:hidden;position:relative;">
    <img src="${c.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;${photoStyle(c.photoTransform)}" />
    <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(255,255,255,0.3),transparent);"></div>
  </div>` : ''}
</div>`
}

// ── Template 4: Provence ──────────────────────────────────────────────────
export function templateProvence(c: CoverPageConfig): string {
  return `
<div style="width:100%;min-height:1100px;background:#f7f3ec;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;box-sizing:border-box;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
  <div style="position:absolute;top:24px;left:24px;right:24px;bottom:24px;border:1px solid #c8b89a;pointer-events:none;"></div>
  <div style="position:absolute;top:30px;left:30px;right:30px;bottom:30px;border:1px solid #e8dcc8;pointer-events:none;"></div>
  ${c.photoUrl ? `
  <div style="width:260px;height:200px;overflow:hidden;border:4px solid #fff;box-shadow:0 4px 20px rgba(0,0,0,0.12);margin-bottom:40px;position:relative;">
    <img src="${c.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;${photoStyle(c.photoTransform)}" />
  </div>` : '<div style="margin-bottom:40px;"></div>'}
  <div style="text-align:center;max-width:480px;">
    <p style="font-size:12px;color:#a07840;letter-spacing:4px;text-transform:uppercase;margin:0 0 20px;font-style:italic;">✦ Saveurs du terroir ✦</p>
    <h1 style="font-size:34px;font-weight:400;color:#3d2b1a;margin:0 0 12px;line-height:1.3;">${c.title}</h1>
    ${c.subtitle ? `<p style="font-size:15px;color:#7a5c38;font-style:italic;margin:0 0 36px;">${c.subtitle}</p>` : '<div style="margin-bottom:36px;"></div>'}
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:36px;">
      <div style="flex:1;height:1px;background:#c8b89a;"></div>
      <span style="color:#a07840;font-size:16px;">❧</span>
      <div style="flex:1;height:1px;background:#c8b89a;"></div>
    </div>
    ${c.clientName ? `<p style="font-size:20px;color:#3d2b1a;font-weight:600;margin:0 0 8px;">${c.clientName}</p>` : ''}
    ${c.address ? `<p style="font-size:13px;color:#7a5c38;margin:0 0 4px;">${c.address}</p>` : ''}
    ${c.eventDate ? `<p style="font-size:13px;color:#a07840;font-style:italic;margin:0;">${dateFr(c.eventDate)}</p>` : ''}
  </div>
</div>`
}

// ── Template 5: Luxe ──────────────────────────────────────────────────────
export function templateLuxe(c: CoverPageConfig): string {
  return `
<div style="width:100%;min-height:1100px;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
  ${c.photoUrl ? `
  <div style="position:absolute;inset:0;overflow:hidden;">
    <img src="${c.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;${photoStyle(c.photoTransform)}" />
    <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.92) 0%,rgba(0,0,0,0.3) 60%,rgba(0,0,0,0.1) 100%);"></div>
  </div>` : '<div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a1a1a,#0a0a0a);"></div>'}
  <div style="position:relative;z-index:1;text-align:center;padding:80px 60px;width:100%;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:32px;">
      <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to right,transparent,#d4af37);"></div>
      <span style="color:#d4af37;font-size:18px;">◆</span>
      <div style="flex:1;max-width:80px;height:1px;background:linear-gradient(to left,transparent,#d4af37);"></div>
    </div>
    <h1 style="font-size:44px;font-weight:200;color:#ffffff;letter-spacing:6px;text-transform:uppercase;margin:0 0 16px;">${c.title}</h1>
    ${c.subtitle ? `<p style="font-size:15px;color:#d4af37;letter-spacing:3px;text-transform:uppercase;margin:0 0 48px;">${c.subtitle}</p>` : '<div style="margin-bottom:48px;"></div>'}
    <div style="width:40px;height:1px;background:#d4af37;margin:0 auto 40px;"></div>
    ${c.clientName ? `<p style="font-size:22px;color:#ffffff;font-weight:300;letter-spacing:3px;margin:0 0 10px;">${c.clientName}</p>` : ''}
    ${c.address ? `<p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 6px;">${c.address}</p>` : ''}
    ${c.eventDate ? `<p style="font-size:13px;color:#d4af37;margin:0;">${dateFr(c.eventDate)}</p>` : ''}
  </div>
</div>`
}

export const COVER_TEMPLATES: Record<CoverPageConfig['template'], (c: CoverPageConfig) => string> = {
  mariage: templateMariage,
  gastronomique: templateGastronomique,
  business: templateBusiness,
  provence: templateProvence,
  luxe: templateLuxe,
}

export const TEMPLATE_LABELS: Record<CoverPageConfig['template'], string> = {
  mariage: 'Mariage',
  gastronomique: 'Gastronomique',
  business: 'Business',
  provence: 'Provence',
  luxe: 'Luxe',
}
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/CoverPage.templates.ts
git commit -m "feat: cover page templates (5 designs)"
```

---

## Task 5: CoverPage component

**Files:**
- Create: `components/devis/weboword/CoverPage.tsx`

Ce composant affiche la page de garde dans l'éditeur (aperçu live). Il switche entre mode template et mode builder. Il reçoit `config` et `onChange` depuis WeboWordEditor.

- [ ] **Step 1: Create CoverPage.tsx**

```tsx
// components/devis/weboword/CoverPage.tsx
'use client'

import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import type { CoverPageConfig } from './weboword.types'
import { COVER_TEMPLATES, TEMPLATE_LABELS } from './CoverPage.templates'
import { PhotoBuilder } from './PhotoBuilder'
import { CoverPageBuilder } from './CoverPageBuilder'

type Props = {
  config: CoverPageConfig
  onChange: (config: CoverPageConfig) => void
}

export function CoverPage({ config, onChange }: Props) {
  const [showPhotoBuilder, setShowPhotoBuilder] = useState(false)

  const templateHtml = COVER_TEMPLATES[config.template](config)

  if (config.mode === 'builder') {
    return (
      <>
        <CoverPageBuilder config={config} onChange={onChange} />
        {showPhotoBuilder && (
          <PhotoBuilder
            initial={config.photoUrl ? { id: 'cover', url: config.photoUrl, transform: config.photoTransform } : undefined}
            frameAspect={16 / 9}
            onApply={photo => {
              onChange({ ...config, photoUrl: photo.url, photoTransform: photo.transform })
              setShowPhotoBuilder(false)
            }}
            onClose={() => setShowPhotoBuilder(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      {/* Template preview via dangerouslySetInnerHTML */}
      <div
        className="relative group"
        dangerouslySetInnerHTML={{ __html: templateHtml }}
      />
      {/* Photo edit overlay button */}
      {config.photoUrl && (
        <button
          onClick={() => setShowPhotoBuilder(true)}
          className="absolute top-4 right-4 z-10 bg-black/60 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          Modifier la photo
        </button>
      )}
      {!config.photoUrl && (
        <button
          onClick={() => setShowPhotoBuilder(true)}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors"
        >
          <span className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-700 shadow-sm">
            <ImagePlus className="w-4 h-4" />
            Ajouter une photo de couverture
          </span>
        </button>
      )}
      {showPhotoBuilder && (
        <PhotoBuilder
          initial={config.photoUrl ? { id: 'cover', url: config.photoUrl, transform: config.photoTransform } : undefined}
          frameAspect={config.template === 'business' ? 3 / 4 : 16 / 9}
          onApply={photo => {
            onChange({ ...config, photoUrl: photo.url, photoTransform: photo.transform })
            setShowPhotoBuilder(false)
          }}
          onClose={() => setShowPhotoBuilder(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/CoverPage.tsx
git commit -m "feat: CoverPage component with template preview"
```

---

## Task 6: CoverPageBuilder (free layout builder)

**Files:**
- Create: `components/devis/weboword/CoverPageBuilder.tsx`

Builder libre sur canevas A4 (794×1123px). L'utilisateur peut ajouter des blocs texte, photo et forme, les déplacer avec la souris.

- [ ] **Step 1: Create CoverPageBuilder.tsx**

```tsx
// components/devis/weboword/CoverPageBuilder.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { Plus, Type, ImagePlus, Square, Trash2 } from 'lucide-react'
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
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/CoverPageBuilder.tsx
git commit -m "feat: CoverPageBuilder free layout drag-and-drop"
```

---

## Task 7: PhotosPage component

**Files:**
- Create: `components/devis/weboword/PhotosPage.tsx`

Page photos finale avec layout builder et drag-and-drop pour réordonner. Utilise @dnd-kit/sortable.

- [ ] **Step 1: Create PhotosPage.tsx**

```tsx
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

function SortableCell({ cell, pageId, onEdit, onRemove }: {
  cell: PhotosPageCell
  pageId: string
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
      {/* Hover controls */}
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
          <div className={`grid gap-3 mb-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {page.cells.map(cell => (
              <SortableCell
                key={cell.id}
                cell={cell}
                pageId={page.id}
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
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/PhotosPage.tsx
git commit -m "feat: PhotosPage component with dnd sortable grid"
```

---

## Task 8: PhotoBlock component (blocs libres dans le devis)

**Files:**
- Create: `components/devis/weboword/PhotoBlock.tsx`

`PhotoBlock` génère du HTML injecté dans le contentEditable du devis. Ce n'est pas un composant React interactif — c'est une fonction qui retourne un string HTML. Le toolbar de WeboWordEditor appellera `insertPhotoBlock()` qui insère ce HTML au niveau du curseur.

- [ ] **Step 1: Create PhotoBlock.tsx**

```tsx
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
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/PhotoBlock.tsx
git commit -m "feat: PhotoBlock HTML generator + PhotoBlockPicker"
```

---

## Task 9: PageBreakIndicator component

**Files:**
- Create: `components/devis/weboword/PageBreakIndicator.tsx`

Marqueur visuel non imprimable affiché entre les sections de pages dans l'éditeur.

- [ ] **Step 1: Create PageBreakIndicator.tsx**

```tsx
// components/devis/weboword/PageBreakIndicator.tsx

type Props = {
  label: string  // ex: "Page 2", "Page photos"
}

export function PageBreakIndicator({ label }: Props) {
  return (
    <div
      className="flex items-center gap-2 my-1 select-none print:hidden"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Left line */}
      <div className="flex-1 h-px bg-purple-200" />
      {/* Dot + label */}
      <div className="flex items-center gap-1.5 text-purple-400 text-xs font-medium">
        <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
        {label}
        <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
      </div>
      {/* Right line */}
      <div className="flex-1 h-px bg-purple-200" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/devis/weboword/PageBreakIndicator.tsx
git commit -m "feat: PageBreakIndicator visual marker"
```

---

## Task 10: WeboWordSidePanels — nouveaux panels

**Files:**
- Modify: `components/devis/WeboWordSidePanels.tsx`

Ajouter les panels `cover` et `photos` + photo par prestation dans le panel `services`.

- [ ] **Step 1: Mettre à jour PanelKey dans WeboWordSidePanels.tsx**

Ligne 12, remplacer :
```typescript
type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images';
```
par :
```typescript
type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images' | 'cover' | 'photos';
```

- [ ] **Step 2: Mettre à jour Props pour passer les configs**

Ajouter dans l'interface `Props` :
```typescript
  coverConfig?: import('./weboword/weboword.types').CoverPageConfig
  onCoverChange?: (c: import('./weboword/weboword.types').CoverPageConfig) => void
  photosConfig?: import('./weboword/weboword.types').PhotosPageConfig
  onPhotosChange?: (c: import('./weboword/weboword.types').PhotosPageConfig) => void
```

- [ ] **Step 3: Ajouter le panel Cover dans le switch de rendu**

Dans la fonction `WeboWordSidePanels`, trouver l'endroit où les panels sont rendus (le switch/if-else sur `activePanel`) et ajouter :

```tsx
{activePanel === 'cover' && coverConfig && onCoverChange && (
  <div className="flex flex-col gap-4 p-4">
    <h3 className="font-semibold text-gray-800 text-base">Page de garde</h3>

    {/* Enable/disable toggle */}
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={coverConfig.enabled}
        onChange={e => onCoverChange({ ...coverConfig, enabled: e.target.checked })}
        className="w-4 h-4 accent-purple-600" />
      <span className="text-sm text-gray-700">Activer la page de garde</span>
    </label>

    {coverConfig.enabled && (
      <>
        {/* Mode toggle */}
        <div className="flex rounded-lg border overflow-hidden text-sm">
          <button
            onClick={() => onCoverChange({ ...coverConfig, mode: 'template' })}
            className={`flex-1 py-2 font-medium transition-colors ${coverConfig.mode === 'template' ? 'bg-purple-600 text-white' : 'hover:bg-gray-50'}`}>
            Templates
          </button>
          <button
            onClick={() => onCoverChange({ ...coverConfig, mode: 'builder' })}
            className={`flex-1 py-2 font-medium transition-colors ${coverConfig.mode === 'builder' ? 'bg-purple-600 text-white' : 'hover:bg-gray-50'}`}>
            Builder libre
          </button>
        </div>

        {coverConfig.mode === 'template' && (
          <>
            {/* Template selector */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Template</p>
              <div className="grid grid-cols-2 gap-2">
                {(['mariage', 'gastronomique', 'business', 'provence', 'luxe'] as const).map(t => (
                  <button key={t}
                    onClick={() => onCoverChange({ ...coverConfig, template: t })}
                    className={`py-2 px-3 rounded-lg border text-sm capitalize transition-colors ${coverConfig.template === t ? 'bg-purple-100 border-purple-400 text-purple-700 font-medium' : 'hover:bg-gray-50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            {[
              { key: 'clientName', label: 'Nom du client', placeholder: 'M. et Mme Dupont' },
              { key: 'address', label: 'Lieu / adresse', placeholder: 'Château de Versailles' },
              { key: 'eventDate', label: 'Date', placeholder: '', type: 'date' },
              { key: 'title', label: 'Titre', placeholder: 'Proposition gastronomique' },
              { key: 'subtitle', label: 'Sous-titre', placeholder: 'Mariage — 120 couverts' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type={type ?? 'text'}
                  value={(coverConfig as Record<string, string>)[key] ?? ''}
                  placeholder={placeholder}
                  onChange={e => onCoverChange({ ...coverConfig, [key]: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            ))}
          </>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 4: Ajouter le panel Photos**

Le panel photos ne fait qu'activer/désactiver. L'édition complète (ajout de photos, layouts, réordonnancement) se fait directement dans la page photos rendue en bas du document.

```tsx
{activePanel === 'photos' && photosConfig && onPhotosChange && (
  <div className="flex flex-col gap-4 p-4">
    <h3 className="font-semibold text-gray-800 text-base">Page photos</h3>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={photosConfig.enabled}
        onChange={e => onPhotosChange({ ...photosConfig, enabled: e.target.checked })}
        className="w-4 h-4 accent-purple-600" />
      <span className="text-sm text-gray-700">Activer la page photos</span>
    </label>
    {photosConfig.enabled && (
      <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">
        Gérez vos photos directement dans la page photos en bas du document.
      </p>
    )}
  </div>
)}
```

- [ ] **Step 5: Photo par prestation dans le panel services**

Dans le panel `services`, pour chaque ligne de service, ajouter un bouton photo. Trouver le bloc qui rend chaque service (chercher `services.map`) et ajouter après le nom/prix de chaque service :

```tsx
{/* Photo per prestation — shown in service edit area */}
<div className="mt-2 flex items-center gap-2">
  {(svc as { photo_url?: string }).photo_url ? (
    <div className="relative w-12 h-12 rounded overflow-hidden border">
      <img src={(svc as { photo_url?: string }).photo_url} className="w-full h-full object-cover" alt="" />
      <button
        onClick={() => setEditingServicePhotoIdx(idx)}
        className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
      >Modifier</button>
    </div>
  ) : (
    <button
      onClick={() => setEditingServicePhotoIdx(idx)}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 border border-dashed border-gray-200 rounded px-2 py-1"
    >
      + Photo
    </button>
  )}
</div>
```

Ajouter state dans le composant :
```typescript
const [editingServicePhotoIdx, setEditingServicePhotoIdx] = useState<number | null>(null)
```

Et le PhotoBuilder conditionnel :
```tsx
{editingServicePhotoIdx !== null && (
  <PhotoBuilder
    initial={services[editingServicePhotoIdx]?.photo_url
      ? { id: String(editingServicePhotoIdx), url: services[editingServicePhotoIdx].photo_url!, transform: DEFAULT_TRANSFORM }
      : undefined
    }
    frameAspect={1}
    onApply={async (photo) => {
      // Save photo_url to prestations table
      const svcId = services[editingServicePhotoIdx]?.id
      if (svcId) {
        await supabase.from('prestations').update({ photo_url: photo.url }).eq('id', svcId)
      }
      // Update local state
      setServices(prev => prev.map((s, i) => i === editingServicePhotoIdx ? { ...s, photo_url: photo.url } : s))
      setEditingServicePhotoIdx(null)
    }}
    onClose={() => setEditingServicePhotoIdx(null)}
  />
)}
```

Ajouter l'import :
```typescript
import { PhotoBuilder } from './weboword/PhotoBuilder'
import { DEFAULT_TRANSFORM } from './weboword/weboword.types'
```

- [ ] **Step 6: Commit**

```bash
git add components/devis/WeboWordSidePanels.tsx
git commit -m "feat: WeboWordSidePanels — cover/photos panels + per-prestation photo"
```

---

## Task 11: WeboWordEditor — intégration complète

**Files:**
- Modify: `components/devis/WeboWordEditor.tsx`

- [ ] **Step 1: Ajouter les imports**

En haut de `WeboWordEditor.tsx`, ajouter les imports :

```typescript
import { CoverPage } from './weboword/CoverPage'
import { PhotosPage } from './weboword/PhotosPage'
import { PageBreakIndicator } from './weboword/PageBreakIndicator'
import { PhotoBlockPicker } from './weboword/PhotoBlock'
import {
  type CoverPageConfig, type PhotosPageConfig,
  DEFAULT_COVER_CONFIG, DEFAULT_PHOTOS_CONFIG,
} from './weboword/weboword.types'
import { Image as ImageIcon } from 'lucide-react'
```

- [ ] **Step 2: Ajouter le state**

Dans le corps de `WeboWordEditor`, après les états existants (après `const [menuWidth, setMenuWidth] = useState('100%')`), ajouter :

```typescript
const [coverConfig, setCoverConfig] = useState<CoverPageConfig>(DEFAULT_COVER_CONFIG)
const [photosConfig, setPhotosConfig] = useState<PhotosPageConfig>(DEFAULT_PHOTOS_CONFIG)
const [showPhotoBlockPicker, setShowPhotoBlockPicker] = useState(false)
```

- [ ] **Step 3: Charger les configs depuis Supabase au montage**

Trouver le `useEffect` qui charge les données au montage (chercher `useEffect` avec `quoteId` en dépendance ou le premier useEffect qui fetch les données). Ajouter la lecture des colonnes JSONB :

```typescript
// Dans le useEffect de chargement initial, après le fetch de la quote :
const { data: quoteData } = await supabase
  .from('quotes')
  .select('cover_page_config, photos_page_config')
  .eq('id', quoteId)
  .single()

if (quoteData?.cover_page_config) {
  setCoverConfig(quoteData.cover_page_config as CoverPageConfig)
}
if (quoteData?.photos_page_config) {
  setPhotosConfig(quoteData.photos_page_config as PhotosPageConfig)
}
```

- [ ] **Step 4: Sauvegarder les configs dans handleSave**

Dans `handleSave()`, après la ligne `update({ content_html: html, selected_font: font, selected_font_size: fontSize })`, ajouter la sauvegarde des nouvelles configs :

```typescript
// Après la sauvegarde existante du content_html :
await supabase
  .from('quotes')
  .update({ cover_page_config: coverConfig, photos_page_config: photosConfig })
  .eq('id', quoteId)
```

- [ ] **Step 5: Mettre à jour PanelKey**

Ligne 18, remplacer :
```typescript
type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images';
```
par :
```typescript
type PanelKey = 'client' | 'services' | 'event' | 'style' | 'images' | 'cover' | 'photos';
```

- [ ] **Step 6: Mettre à jour la vérification URL dans useEffect**

Trouver le `useEffect` qui lit le paramètre `panel` depuis l'URL (ligne ~192) et remplacer la condition :
```typescript
if (p === 'client' || p === 'services' || p === 'event' || p === 'style' || p === 'images') {
```
par :
```typescript
if (p === 'client' || p === 'services' || p === 'event' || p === 'style' || p === 'images' || p === 'cover' || p === 'photos') {
```

- [ ] **Step 7: Ajouter boutons toolbar**

Dans la barre d'outils du `return` JSX, ajouter deux boutons après les boutons existants (chercher le bouton `LayoutTemplate` ou `images`) :

```tsx
<Sep />
<TB onClick={() => setActivePanel(activePanel === 'cover' ? null : 'cover')} title="Page de garde"
  active={activePanel === 'cover'}>
  <LayoutTemplate className="w-4 h-4" />
</TB>
<TB onClick={() => setActivePanel(activePanel === 'photos' ? null : 'photos')} title="Page photos"
  active={activePanel === 'photos'}>
  <ImageIcon className="w-4 h-4" />
</TB>
<Sep />
<TB onClick={() => setShowPhotoBlockPicker(true)} title="Insérer un bloc photo">
  <ImageIcon className="w-3.5 h-3.5" />
</TB>
```

- [ ] **Step 8: Passer les nouvelles props à WeboWordSidePanels**

Trouver le rendu de `<WeboWordSidePanels ... />` et ajouter les props :
```tsx
coverConfig={coverConfig}
onCoverChange={setCoverConfig}
photosConfig={photosConfig}
onPhotosChange={setPhotosConfig}
```

- [ ] **Step 9: Rendre CoverPage, PageBreakIndicators et PhotosPage dans le JSX**

Trouver la zone de rendu principale (le `<div id="weboword-sheet" ...>` ou la zone de l'éditeur). Entourer le contenu actuel et ajouter les nouvelles pages :

```tsx
{/* Page de garde — rendue AVANT l'éditeur */}
{coverConfig.enabled && (
  <>
    <div className="w-full relative">
      <CoverPage config={coverConfig} onChange={setCoverConfig} />
    </div>
    <PageBreakIndicator label={`Page ${1 + 1} — Devis`} />
  </>
)}

{/* Éditeur existant — inchangé */}
<div
  id="weboword-sheet"
  ref={editorRef}
  contentEditable
  suppressContentEditableWarning
  ... (props existants inchangés)
/>

{/* Page photos — rendue APRÈS l'éditeur */}
{photosConfig.enabled && photosConfig.pages.length > 0 && (
  <>
    <PageBreakIndicator label="Page photos" />
    <div className="bg-white p-8 w-full">
      <PhotosPage config={photosConfig} onChange={setPhotosConfig} />
    </div>
  </>
)}

{/* PhotoBlockPicker modal */}
{showPhotoBlockPicker && (
  <PhotoBlockPicker
    onInsert={html => {
      document.execCommand('insertHTML', false, html)
      setShowPhotoBlockPicker(false)
    }}
    onClose={() => setShowPhotoBlockPicker(false)}
  />
)}
```

- [ ] **Step 10: Vérification manuelle**

1. Ouvrir un devis en mode WeboWord
2. Cliquer sur le bouton "Page de garde" dans la toolbar → panel s'ouvre
3. Activer la page de garde → la page apparaît au-dessus du devis avec un indicateur "● Page 2 — Devis"
4. Changer de template → aperçu se met à jour
5. Cliquer sur la photo → PhotoBuilder s'ouvre, upload une image, appliquer → photo apparaît
6. Activer la page photos → ajouter une photo → grille s'affiche
7. Bouton "Insérer un bloc photo" → PhotoBlockPicker → insérer → bloc HTML inséré dans le devis
8. Sauvegarder → recharger la page → configs persistées

- [ ] **Step 11: Commit**

```bash
git add components/devis/WeboWordEditor.tsx
git commit -m "feat: WeboWordEditor — cover/photos pages integration"
```

---

## Task 12: Fonctions HTML pour PDF

**Files:**
- Create: `components/devis/weboword/printHelpers.ts`
- Modify: `components/devis/WeboWordEditor.tsx`

Les fonctions de génération HTML pour PDF vivent dans le dossier `weboword/` pour éviter une dépendance `lib → components`. Elles sont importées directement dans `WeboWordEditor.tsx`.

- [ ] **Step 1: Créer printHelpers.ts**

```typescript
// components/devis/weboword/printHelpers.ts

import type { CoverPageConfig, PhotosPageConfig } from './weboword.types'
import { COVER_TEMPLATES } from './CoverPage.templates'

export function buildCoverPageHtml(config: CoverPageConfig): string {
  if (!config.enabled) return ''
  if (config.mode === 'builder') {
    const elements = config.customLayout.map(el => {
      const s = `position:absolute;left:${(el.x / 794) * 100}%;top:${(el.y / 1123) * 100}%;width:${(el.width / 794) * 100}%;height:${(el.height / 1123) * 100}%;`
      if (el.type === 'text') return `<div style="${s}font-size:${el.fontSize ?? 24}px;color:${el.color ?? '#1a1a1a'};font-weight:${el.fontWeight ?? 'normal'};">${el.content}</div>`
      if (el.type === 'photo' && el.content) return `<div style="${s}overflow:hidden;"><img src="${el.content}" style="width:100%;height:100%;object-fit:cover;" /></div>`
      if (el.type === 'shape') return `<div style="${s}background:${el.content};"></div>`
      return ''
    }).join('\n')
    return `<div style="width:100%;height:1123px;position:relative;background:#fff;page-break-after:always;break-after:page;">${elements}</div>`
  }
  return COVER_TEMPLATES[config.template](config)
}

export function buildPhotosPageHtml(config: PhotosPageConfig): string {
  if (!config.enabled || config.pages.length === 0) return ''
  return config.pages.map(page => {
    const cols = page.layout === '1col' ? 1 : page.layout === '3col' ? 3 : 2
    const gap = 12
    const colW = `calc(${100 / cols}% - ${gap * (cols - 1) / cols}px)`
    const cells = page.cells.map(cell => {
      const imgStyle = `transform:scale(${cell.transform.zoom}) translate(${cell.transform.x}%,${cell.transform.y}%) rotate(${cell.transform.rotation}deg);transform-origin:center;`
      return `<div style="display:inline-block;vertical-align:top;width:${colW};margin-bottom:${gap}px;">
  <div style="width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:6px;background:#f0f0f0;"><img src="${cell.url}" alt="" style="width:100%;height:100%;object-fit:cover;${imgStyle}" /></div>
  ${cell.caption ? `<p style="text-align:center;font-size:11px;color:#666;margin:4px 0 0;">${cell.caption}</p>` : ''}
</div>`
    }).join('\n')
    return `<div style="padding:20mm;page-break-before:always;break-before:page;page-break-after:always;break-after:page;"><div style="display:flex;flex-wrap:wrap;gap:${gap}px;">${cells}</div></div>`
  }).join('\n')
}
```

- [ ] **Step 2: Mettre à jour buildPrintHtml() et handleSavePdf() dans WeboWordEditor.tsx**

Ajouter l'import en haut du fichier :
```typescript
import { buildCoverPageHtml, buildPhotosPageHtml } from './weboword/printHelpers'
```

Dans `buildPrintHtml()` (ligne ~693), modifier le corps du HTML retourné. Avant le `return`, ajouter :
```typescript
const coverHtml = buildCoverPageHtml(coverConfig)
const photosHtml = buildPhotosPageHtml(photosConfig)
```

Puis dans le HTML retourné, remplacer :
```html
<body>
  <div class="pdf-wrap">${content}</div>
```
par :
```html
<body>
  ${coverHtml}
  <div class="pdf-wrap">${content}</div>
  ${photosHtml}
```

Faire exactement la même modification dans `handleSavePdf()` (ligne ~764).

- [ ] **Step 3: Vérification manuelle**

1. Activer la page de garde avec une photo
2. Activer la page photos avec quelques photos
3. Cliquer "Imprimer" ou "Télécharger PDF"
4. Vérifier que le PDF généré contient : page de garde → devis → page photos

- [ ] **Step 4: Commit**

```bash
git add lib/generateQuoteHtml.ts components/devis/WeboWordEditor.tsx
git commit -m "feat: PDF integration — cover page + photos page in print/PDF output"
```

---

## Checklist de vérification finale

- [ ] Page de garde : 5 templates affichés et sélectionnables
- [ ] Page de garde : champs (nom client, adresse, date, titre, sous-titre) mis à jour en temps réel
- [ ] Page de garde : clic photo → PhotoBuilder → upload + zoom/pan/rotate → photo affichée dans le template
- [ ] Page de garde : mode builder libre → drag des éléments → position sauvegardée
- [ ] Page photos : ajout de pages, layout selector (1col/2col/3col/mosaïque)
- [ ] Page photos : ajout de photos via PhotoBuilder, drag-and-drop pour réordonner
- [ ] Devis : photo par prestation via panel services → sauvegardée en DB
- [ ] Devis : bouton "Insérer bloc photo" → PhotoBlockPicker → bloc HTML inséré dans le contentEditable
- [ ] Indicateurs de rupture de page visibles entre les sections, absents à l'impression
- [ ] Sauvegarde : cover_page_config et photos_page_config persistés en Supabase
- [ ] PDF/Print : page de garde + devis + page photos dans le bon ordre
