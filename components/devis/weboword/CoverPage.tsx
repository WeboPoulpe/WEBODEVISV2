// components/devis/weboword/CoverPage.tsx
'use client'

import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import type { CoverPageConfig } from './weboword.types'
import { COVER_TEMPLATES } from './CoverPage.templates'
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
