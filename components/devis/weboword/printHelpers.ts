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
