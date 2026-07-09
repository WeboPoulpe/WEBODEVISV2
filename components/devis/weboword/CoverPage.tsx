// components/devis/weboword/CoverPage.tsx
'use client'

import { useState } from 'react'
import { ImagePlus, Type } from 'lucide-react'
import { sanitizeHtml } from '@/lib/sanitize'
import type { CoverPageConfig } from './weboword.types'
import { COVER_TEMPLATES } from './CoverPage.templates'
import { PhotoBuilder } from './PhotoBuilder'
import { CoverPageBuilder } from './CoverPageBuilder'
import { buildCoverPageHtml } from './printHelpers'

type Props = {
  config: CoverPageConfig
  onChange: (config: CoverPageConfig) => void
}

export function CoverPage({ config, onChange }: Props) {
  const [showPhotoBuilder, setShowPhotoBuilder] = useState(false)
  const [editingText, setEditingText] = useState(false)

  const templateHtml = COVER_TEMPLATES[config.template](config)

  if (config.mode === 'builder') {
    return <CoverPageBuilder config={config} onChange={onChange} />
  }

  if (editingText) {
    return (
      <div>
        <div className="flex justify-end p-2 bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => setEditingText(false)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#9c27b0] rounded-lg hover:bg-[#7b1fa2] transition-colors"
          >
            Terminer l&apos;édition du texte
          </button>
        </div>
        <CoverPageBuilder config={config} onChange={onChange} backgroundHtml={templateHtml} />
      </div>
    )
  }

  const previewHtml = buildCoverPageHtml(config) || templateHtml

  return (
    <div className="relative group">
      {/* Template preview with overlays */}
      <div
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
      />
      {/* Add/edit text overlay button */}
      <button
        onClick={() => setEditingText(true)}
        className="absolute top-4 left-4 z-10 bg-[#9c27b0]/80 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Type className="w-3.5 h-3.5" />
        {(config.customLayout && config.customLayout.length > 0) ? 'Modifier le texte' : '+ Ajouter du texte'}
      </button>
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
    </div>
  )
}
