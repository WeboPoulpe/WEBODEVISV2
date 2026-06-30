// components/devis/weboword/printHelpers.ts

import type { CoverPageConfig, PhotosPageConfig } from './weboword.types'
import { COVER_TEMPLATES } from './CoverPage.templates'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildCoverPageHtml(config: CoverPageConfig): string {
  if (!config.enabled) return ''
  if (config.mode === 'builder') {
    const elements = config.customLayout.map(el => {
      const s = `position:absolute;left:${(el.x / 794) * 100}%;top:${(el.y / 1123) * 100}%;width:${(el.width / 794) * 100}%;height:${(el.height / 1123) * 100}%;`
      if (el.type === 'text') return `<div style="${s}font-size:${el.fontSize ?? 24}px;color:${esc(el.color ?? '#1a1a1a')};font-weight:${esc(el.fontWeight ?? 'normal')};">${esc(el.content)}</div>`
      if (el.type === 'photo' && el.content) return `<div style="${s}overflow:hidden;"><img src="${esc(el.content)}" style="width:100%;height:100%;object-fit:cover;" /></div>`
      if (el.type === 'shape') return `<div style="${s}background:${esc(el.content)};"></div>`
      return ''
    }).join('\n')
    return `<div style="width:100%;height:1123px;position:relative;background:#fff;page-break-after:always;break-after:page;">${elements}</div>`
  }
  return COVER_TEMPLATES[config.template](config)
}

export function buildPhotosPageHtml(config: PhotosPageConfig): string {
  if (!config.enabled || config.pages.length === 0) return ''
  return config.pages.map((page, pageIdx) => {
    const isLast = pageIdx === config.pages.length - 1
    const cols = page.layout === '1col' ? 1 : page.layout === '3col' ? 3 : 2
    const gap = 12
    const colW = `calc(${100 / cols}% - ${gap * (cols - 1) / cols}px)`
    const cells = page.cells.map(cell => {
      const imgStyle = `transform:scale(${cell.transform.zoom}) translate(${cell.transform.x}%,${cell.transform.y}%) rotate(${cell.transform.rotation}deg);transform-origin:center;`
      return `<div style="flex:0 0 ${colW};max-width:${colW};">
  <div style="width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:6px;background:#f0f0f0;"><img src="${esc(cell.url)}" alt="" style="width:100%;height:100%;object-fit:cover;${imgStyle}" /></div>
  ${cell.caption ? `<p style="text-align:center;font-size:11px;color:#666;margin:4px 0 0;">${esc(cell.caption)}</p>` : ''}
</div>`
    }).join('\n')
    const breakAfter = isLast ? '' : 'page-break-after:always;break-after:page;'
    return `<div style="padding:20mm;page-break-before:always;break-before:page;${breakAfter}"><div style="display:flex;flex-wrap:wrap;gap:${gap}px;">${cells}</div></div>`
  }).join('\n')
}

export function buildLogoHeaderHtml(logoUrl: string | null | undefined): string {
  if (!logoUrl) return ''
  return `<div style="text-align:center;padding:10mm 0 4mm;"><img src="${esc(logoUrl)}" alt="Logo" style="max-height:80px;max-width:220px;object-fit:contain;" /></div>`
}

export function buildCgvHtml(cgv: string | null | undefined): string {
  if (!cgv || !cgv.trim()) return ''
  return `<div style="page-break-before:always;break-before:page;padding:18mm 16mm;">
  <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#666;border-bottom:1px solid #ddd;padding-bottom:6px;margin:0 0 10px;">Conditions Générales de Vente</h2>
  <div style="font-size:8.5px;line-height:1.45;color:#444;column-count:2;column-gap:10mm;text-align:justify;">${cgv}</div>
</div>`
}
