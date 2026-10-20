// components/devis/weboword/printHelpers.ts

import type { CoverPageConfig, CoverPageLayoutElement, PhotosPageConfig } from './weboword.types'
import { COVER_TEMPLATES } from './CoverPage.templates'
import { sellerIdentityLine } from '@/lib/invoiceMentions'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildLayoutElementsHtml(layout: CoverPageLayoutElement[]): string {
  return layout.map(el => {
    const s = `position:absolute;left:${(el.x / 794) * 100}%;top:${(el.y / 1123) * 100}%;width:${(el.width / 794) * 100}%;height:${(el.height / 1123) * 100}%;`
    if (el.type === 'text') return `<div style="${s}font-size:${el.fontSize ?? 24}px;font-family:${esc(el.fontFamily ?? 'Georgia')};color:${esc(el.color ?? '#1a1a1a')};font-weight:${esc(el.fontWeight ?? 'normal')};font-style:${esc(el.fontStyle ?? 'normal')};text-decoration:${esc(el.textDecoration ?? 'none')};text-align:${esc(el.textAlign ?? 'left')};letter-spacing:${el.letterSpacing ?? 0}px;white-space:pre-wrap;word-break:break-word;overflow:hidden;">${esc(el.content)}</div>`
    if (el.type === 'photo' && el.content) return `<div style="${s}overflow:hidden;"><img src="${esc(el.content)}" style="width:100%;height:100%;object-fit:cover;" /></div>`
    if (el.type === 'shape') return `<div style="${s}background:${esc(el.content)};"></div>`
    return ''
  }).join('\n')
}

export function buildCoverPageHtml(config: CoverPageConfig): string {
  if (!config.enabled) return ''
  if (config.mode === 'builder') {
    const elements = buildLayoutElementsHtml(config.customLayout)
    return `<div style="width:100%;height:1123px;position:relative;background:#fff;page-break-after:always;break-after:page;">${elements}</div>`
  }
  const tpl = COVER_TEMPLATES[config.template](config)
  if (!config.customLayout || config.customLayout.length === 0) return tpl
  return `<div style="position:relative;">${tpl}${buildLayoutElementsHtml(config.customLayout)}</div>`
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

/** Colonnes du profil qui portent l'identité légale de l'entreprise (à lire avec le reste du profil). */
export const LEGAL_PROFILE_COLUMNS = 'company_name, company_address, siret, company_siret, legal_form, share_capital, rcs, vat_number, vat_exempt'

export interface LegalProfile {
  company_name?: string | null
  company_address?: string | null
  siret?: string | null
  company_siret?: string | null
  legal_form?: string | null
  share_capital?: string | null
  rcs?: string | null
  vat_number?: string | null
  vat_exempt?: boolean | null
}

/**
 * Pied de document du devis : nom et adresse de l'entreprise, puis sa ligne d'identité légale (forme, capital, RCS,
 * SIRET, n° de TVA ou mention de franchise), la même que sur les factures. Vide si rien n'est renseigné.
 */
export function buildLegalFooterHtml(p: LegalProfile | null | undefined): string {
  if (!p) return ''
  const identity = sellerIdentityLine({
    name: p.company_name ?? '',
    siret: p.siret || p.company_siret || null,
    vatNumber: p.vat_exempt ? null : (p.vat_number ?? null),
    vatExempt: !!p.vat_exempt,
    legalForm: p.legal_form ?? null,
    shareCapital: p.share_capital ?? null,
    rcs: p.rcs ?? null,
  })
  const head = [p.company_name, p.company_address].filter((x) => x && x.trim()).join(' · ')
  if (!identity && !head) return ''
  return `<div data-webo-legal="1" style="margin:6mm 16mm 0;padding-top:3mm;border-top:1px solid #e5e5e5;font-family:system-ui,sans-serif;font-size:8px;line-height:1.5;color:#777;text-align:center;break-inside:avoid;">${[head, identity].filter(Boolean).map(esc).join('<br>')}</div>`
}
