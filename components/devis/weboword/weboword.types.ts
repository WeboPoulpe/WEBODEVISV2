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
