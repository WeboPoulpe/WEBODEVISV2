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
<div style="width:100%;height:297mm;background:#fdf8f0;font-family:Georgia,serif;display:flex;flex-direction:column;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
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
<div style="width:100%;height:297mm;background:#1a1a1a;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;page-break-after:always;break-after:page;padding:60px 40px;box-sizing:border-box;">
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
<div style="width:100%;height:297mm;background:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:row;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
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
<div style="width:100%;height:297mm;background:#f7f3ec;font-family:Georgia,serif;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;box-sizing:border-box;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
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
<div style="width:100%;height:297mm;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;position:relative;overflow:hidden;page-break-after:always;break-after:page;">
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
