/**
 * Generates a two-page HTML document for the WeboWord editor.
 *
 * PAGE 1 — Devis Financier  : header violet pleine largeur, client/event,
 *           tableau avec descriptions (class="svc-desc"), totaux, signatures.
 * PAGE 2 — Carte Gastronomique : noms + descriptions des prestations, sans prix.
 *
 * Les éléments `.svc-desc` peuvent être masqués via CSS dans l'éditeur.
 * Le séparateur `.screen-sep` est visible à l'écran mais caché à l'impression.
 */

export interface QuoteHtmlData {
  companyName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  eventLocation?: string | null;
  guestCount?: number | null;
  services: Array<{
    name: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    hideDescOnPdf?: boolean;
  }>;
  vatRate: number;
  remarks?: string | null;
  hidePrice?: boolean;
}

export interface QuoteHtmlOptions {
  font?: string;
  template?: 'standard' | 'mariage' | 'business';
}

const money = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const dateFr = (s?: string | null) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return s;
  }
};

export function generateQuoteHtml(d: QuoteHtmlData, opts: QuoteHtmlOptions = {}): string {
  const ht  = d.services.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
  const vat = ht * (d.vatRate / 100);
  const ttc = ht + vat;
  const today = new Date().toLocaleDateString('fr-FR');

  // ── Template / theme vars ──────────────────────────────────────────────────
  const tmpl = opts.template ?? 'standard';
  let headerGradient: string;
  let accentColor: string;
  let lightBg: string;
  let lightBorder: string;
  let fontFamily: string;
  let menuItemColor: string;

  if (tmpl === 'mariage') {
    headerGradient = 'background:linear-gradient(135deg,#8b5a2b 0%,#c8956c 60%,#e2b99a 100%);';
    accentColor = '#c8956c';
    lightBg = '#fffdf7';
    lightBorder = '#f5e6d3';
    fontFamily = opts.font ? `'${opts.font}',serif` : "'Playfair Display',Georgia,serif";
    menuItemColor = '#a0522d';
  } else if (tmpl === 'business') {
    headerGradient = 'background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#334155 100%);';
    accentColor = '#1e293b';
    lightBg = '#f8fafc';
    lightBorder = '#e2e8f0';
    fontFamily = opts.font ? `'${opts.font}',sans-serif` : "'Montserrat',Arial,sans-serif";
    menuItemColor = '#0f172a';
  } else {
    // standard (default purple)
    headerGradient = 'background:linear-gradient(135deg,#6a1080 0%,#9c27b0 60%,#ab47bc 100%);';
    accentColor = '#9c27b0';
    lightBg = '#faf5ff';
    lightBorder = '#e9d5ff';
    fontFamily = opts.font ? `'${opts.font}',serif` : "'Georgia',serif";
    menuItemColor = '#9c27b0';
  }

  // ── Google Font import (if custom font selected) ───────────────────────────
  const googleFontImport = opts.font && opts.font !== 'Georgia'
    ? `<style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(opts.font)}:wght@400;600;700&display=swap');</style>`
    : '';

  // ── Table rows Page 1 ──────────────────────────────────────────────────────
  const tableRows = d.services.map((s) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid ${lightBorder};vertical-align:top;">
        <strong style="font-size:12px;color:#1a1a1a;">${s.name || '—'}</strong>
        ${s.description && !s.hideDescOnPdf
          ? `<p class="svc-desc" style="font-size:11px;color:#9e9e9e;font-style:italic;margin:3px 0 0;line-height:1.4;">${s.description}</p>`
          : ''}
      </td>
      <td style="padding:9px 12px;text-align:center;border-bottom:1px solid ${lightBorder};font-size:12px;vertical-align:top;">${s.quantity}</td>
      ${!d.hidePrice ? `
      <td style="padding:9px 12px;text-align:right;border-bottom:1px solid ${lightBorder};font-size:12px;vertical-align:top;">${money(s.unitPrice)}</td>
      <td style="padding:9px 12px;text-align:right;border-bottom:1px solid ${lightBorder};font-size:12px;font-weight:600;vertical-align:top;">${money(s.quantity * s.unitPrice)}</td>
      ` : ''}
    </tr>`).join('');

  // ── Menu items Page 2 — descriptions always shown regardless of hideDescOnPdf ──
  const menuItems = d.services
    .filter((s) => s.name)
    .map((s) => `
      <div style="margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid ${lightBorder};text-align:center;">
        <h3 style="font-size:15px;font-weight:bold;color:${menuItemColor};margin:0 0 5px;letter-spacing:0.3px;">${s.name}</h3>
        ${s.description
          ? `<p class="svc-desc" style="font-size:12px;color:#777;font-style:italic;margin:0;line-height:1.55;">${s.description}</p>`
          : ''}
      </div>`).join('');

  return `${googleFontImport}
<!-- ═══════════════════════ PAGE 1 — DEVIS FINANCIER ═══════════════════════ -->
<div style="font-family:${fontFamily};color:#1a1a1a;line-height:1.65;min-height:257mm;">

  <!-- ── Header pleine largeur (marges négatives pour échapper au padding de la feuille A4) ── -->
  <div style="${headerGradient}margin:-20mm -20mm 0;padding:13mm 20mm 11mm;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 style="font-size:22px;font-weight:bold;color:white;margin:0 0 3px;letter-spacing:-0.5px;">${d.companyName}</h1>
        <p style="color:rgba(255,255,255,0.65);margin:0;font-size:11px;">Traiteur &amp; Chef à domicile</p>
      </div>
      <div style="text-align:right;">
        <div style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.5);color:white;padding:5px 16px;border-radius:5px;font-size:18px;font-weight:bold;letter-spacing:3px;display:inline-block;">DEVIS</div>
        <p style="color:rgba(255,255,255,0.65);margin:6px 0 0;font-size:11px;">Date : ${today}</p>
      </div>
    </div>
  </div>

  <!-- ── Client + Événement ── -->
  <div style="display:flex;gap:14px;margin-top:18px;margin-bottom:16px;">
    <div style="flex:1;background:${lightBg};border:1px solid ${lightBorder};border-radius:8px;padding:13px;">
      <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">CLIENT</p>
      <p style="font-size:14px;font-weight:bold;margin:0 0 3px;">${d.clientName || 'À compléter'}</p>
      ${d.clientEmail   ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${d.clientEmail}</p>` : ''}
      ${d.clientPhone   ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${d.clientPhone}</p>` : ''}
      ${d.clientAddress ? `<p style="color:#555;margin:0;font-size:11px;">${d.clientAddress}</p>` : ''}
    </div>
    <div style="flex:1;background:${lightBg};border:1px solid ${lightBorder};border-radius:8px;padding:13px;">
      <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">ÉVÉNEMENT</p>
      <p style="font-size:14px;font-weight:bold;margin:0 0 3px;">${d.eventType || 'À préciser'}</p>
      ${d.eventDate     ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">📅 ${dateFr(d.eventDate)}</p>` : ''}
      ${d.guestCount    ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">👥 ${d.guestCount} invité${d.guestCount > 1 ? 's' : ''}</p>` : ''}
      ${d.eventLocation ? `<p style="color:#555;margin:0;font-size:11px;">📍 ${d.eventLocation}</p>` : ''}
    </div>
  </div>

  <!-- ── Intro ── -->
  <div style="margin-bottom:16px;padding:11px 14px;border-left:4px solid ${accentColor};background:#fafafa;border-radius:0 5px 5px 0;">
    <p style="margin:0;font-style:italic;color:#555;font-size:12px;">
      Madame, Monsieur ${d.clientName || ''},<br><br>
      Nous vous remercions de votre confiance et avons le plaisir de vous soumettre notre proposition pour votre ${d.eventType || 'événement'}${d.eventDate ? ` du ${dateFr(d.eventDate)}` : ''}${d.eventLocation ? ` à ${d.eventLocation}` : ''}.
      Vous trouverez ci-dessous le détail de nos prestations.
    </p>
  </div>

  <!-- ── Tableau des prestations ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
    <thead>
      <tr style="${headerGradient}color:white;">
        <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.4px;">Désignation</th>
        <th style="padding:9px 12px;text-align:center;width:50px;font-size:11px;font-weight:600;">Qté</th>
        ${!d.hidePrice ? `
        <th style="padding:9px 12px;text-align:right;width:88px;font-size:11px;font-weight:600;">PU HT</th>
        <th style="padding:9px 12px;text-align:right;width:95px;font-size:11px;font-weight:600;">Total HT</th>
        ` : ''}
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="4" style="padding:14px;color:#bbb;font-style:italic;text-align:center;">Aucune prestation</td></tr>`}
    </tbody>
  </table>

  ${!d.hidePrice ? `
  <!-- ── Totaux ── -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
    <div style="min-width:195px;background:${lightBg};border:1px solid ${lightBorder};border-radius:8px;padding:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px;color:#666;">
        <span>Sous-total HT</span><span>${money(ht)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;color:#666;padding-bottom:10px;border-bottom:1px solid ${lightBorder};">
        <span>TVA (${d.vatRate}%)</span><span>${money(vat)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;color:${accentColor};">
        <span>Total TTC</span><span>${money(ttc)}</span>
      </div>
    </div>
  </div>
  ` : ''}

  ${d.remarks ? `
  <!-- ── Remarques ── -->
  <div style="margin-bottom:16px;">
    <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">REMARQUES</p>
    <p style="font-size:12px;color:#555;white-space:pre-line;margin:0;">${d.remarks}</p>
  </div>
  ` : ''}

  <!-- ── Signatures ── -->
  <div style="display:flex;gap:14px;margin-top:16px;">
    <div style="flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:12px;min-height:60px;">
      <p style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">BON POUR ACCORD — Client</p>
      <p style="font-size:10px;color:#bbb;font-style:italic;margin:0;">Date et signature :</p>
    </div>
    <div style="flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:12px;min-height:60px;">
      <p style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">PRESTATAIRE</p>
      <p style="font-size:12px;font-weight:600;margin:0;">${d.companyName}</p>
    </div>
  </div>

  <!-- ── Conditions ── -->
  <div style="margin-top:14px;padding:7px 12px;background:#fafafa;border-radius:5px;border:1px solid #f0f0f0;">
    <p style="font-size:10px;color:#aaa;margin:0;text-align:center;">Ce devis est valable 30 jours. Toute commande implique l'acceptation de nos conditions générales de vente.</p>
  </div>
</div>

<!-- ─── SÉPARATEUR : visible écran · page-break à l'impression ─── -->
<div class="screen-sep" style="page-break-after:always;break-after:page;margin:26px -20mm;border-top:2px dashed #e9d5ff;padding:7px 20mm;text-align:center;color:#9c27b0;font-size:10px;letter-spacing:0.08em;user-select:none;">
  ✂&nbsp;&nbsp;SAUT DE PAGE — Carte Gastronomique ci-dessous
</div>

<!-- ═══════════════════════ PAGE 2 — CARTE GASTRONOMIQUE ═══════════════════════ -->
<div style="font-family:${fontFamily};color:#1a1a1a;line-height:1.7;min-height:257mm;">

  <!-- ── Header Carte (pleine largeur) ── -->
  <div style="${headerGradient}margin:-20mm -20mm 28px;padding:14mm 20mm 12mm;text-align:center;">
    <p style="font-size:9px;font-weight:bold;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:3px;margin:0 0 5px;">
      ${d.eventType || 'Réception'}${d.eventDate ? ` — ${dateFr(d.eventDate)}` : ''}
    </p>
    <h2 style="font-size:24px;font-weight:bold;color:white;margin:0 0 4px;font-style:italic;letter-spacing:0.5px;">Menu de votre Réception</h2>
    ${d.eventLocation ? `<p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:11px;">📍 ${d.eventLocation}</p>` : ''}
    <div style="width:36px;height:2px;background:rgba(255,255,255,0.35);margin:12px auto 0;"></div>
  </div>

  <!-- ── Plats ── -->
  <div class="gastro-menu" style="max-width:400px;margin:0 auto;">
    ${menuItems || `<p style="text-align:center;color:#bbb;font-style:italic;">Menu à compléter</p>`}
  </div>

  <!-- ── Pied de carte ── -->
  <div style="margin-top:28px;text-align:center;padding-top:14px;border-top:1px solid #f3e5f5;">
    <p style="font-size:11px;color:#ccc;font-style:italic;margin:0;">${d.companyName} — Traiteur &amp; Chef à domicile</p>
  </div>
</div>
`.trim();
}
