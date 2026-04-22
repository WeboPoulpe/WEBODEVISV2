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
    isFree?: boolean;
    isOption?: boolean;
    removed?: boolean;
    gastroCardHtml?: string | null;
    gastroCardHtmlEn?: string | null;
  }>;
  vatRate: number;
  remarks?: string | null;
  hidePrice?: boolean;
  cgv?: string | null;
  language?: 'fr' | 'en';
}

export interface QuoteHtmlOptions {
  font?: string;
  template?: 'standard' | 'mariage' | 'business';
}

const money = (n: number, lang: 'fr' | 'en' = 'fr') =>
  new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const dateFmt = (s?: string | null, lang: 'fr' | 'en' = 'fr') => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return s;
  }
};

// Translations dictionary
const T = {
  fr: {
    devis: 'DEVIS',
    date: 'Date',
    traiteurChef: 'Traiteur & Chef à domicile',
    client: 'CLIENT',
    aCompleter: 'À compléter',
    evenement: 'ÉVÉNEMENT',
    aPreciser: 'À préciser',
    invite: (n: number) => `${n} invité${n > 1 ? 's' : ''}`,
    intro: (clientName: string, eventType: string, dateStr: string, locStr: string) =>
      `Madame, Monsieur ${clientName},<br><br>Nous vous remercions de votre confiance et avons le plaisir de vous soumettre notre proposition pour votre ${eventType || 'événement'}${dateStr ? ` du ${dateStr}` : ''}${locStr ? ` à ${locStr}` : ''}. Vous trouverez ci-dessous le détail de nos prestations.`,
    designation: 'Désignation',
    qte: 'Qté',
    puHt: 'PU HT',
    totalHt: 'Total HT',
    aucunePrestation: 'Aucune prestation',
    sousTotalHt: 'Sous-total HT',
    siOptionsHt: 'si Options HT',
    tva: 'TVA',
    totalTtc: 'Total TTC',
    sautPage: '✂  SAUT DE PAGE — Carte Gastronomique ci-dessous',
    eventLabel: (type: string, date: string) => `${(type || 'ÉVÉNEMENT').toUpperCase()}${date ? ` — ${date.toUpperCase()}` : ''}`,
    menuTitle: (eventType: string) => `Menu de votre ${eventType || 'Réception'}`,
    inclus: 'Inclus',
    option: 'OPTION',
    inclusBadge: 'INCLUS',
    bonAccord: 'BON POUR ACCORD — CLIENT',
    dateSignature: 'Date et signature :',
    prestataire: 'PRESTATAIRE',
    devisValide: 'Ce devis est valable 30 jours. Toute commande implique l\'acceptation de nos conditions générales de vente.',
    menuCompleter: 'Menu à compléter',
    remarques: 'REMARQUES',
    cgv: 'Conditions Générales de Vente',
  },
  en: {
    devis: 'QUOTE',
    date: 'Date',
    traiteurChef: 'Catering & Private Chef',
    client: 'CLIENT',
    aCompleter: 'To be completed',
    evenement: 'EVENT',
    aPreciser: 'To be specified',
    invite: (n: number) => `${n} guest${n > 1 ? 's' : ''}`,
    intro: (clientName: string, eventType: string, dateStr: string, locStr: string) =>
      `Dear ${clientName},<br><br>Thank you for your trust. We are pleased to submit our proposal for your ${eventType || 'event'}${dateStr ? ` on ${dateStr}` : ''}${locStr ? ` at ${locStr}` : ''}. You will find below the details of our services.`,
    designation: 'Description',
    qte: 'Qty',
    puHt: 'Unit Price',
    totalHt: 'Total',
    aucunePrestation: 'No service',
    sousTotalHt: 'Subtotal',
    siOptionsHt: 'incl. Options',
    tva: 'VAT',
    totalTtc: 'Total (incl. VAT)',
    sautPage: '✂  PAGE BREAK — Gastronomic Menu below',
    eventLabel: (type: string, date: string) => `${(type || 'EVENT').toUpperCase()}${date ? ` — ${date.toUpperCase()}` : ''}`,
    menuTitle: (eventType: string) => `${eventType || 'Reception'} Menu`,
    inclus: 'Included',
    option: 'OPTION',
    inclusBadge: 'INCLUDED',
    bonAccord: 'AGREEMENT — CLIENT',
    dateSignature: 'Date and signature:',
    prestataire: 'PROVIDER',
    devisValide: 'This quote is valid for 30 days. Any order implies acceptance of our terms and conditions of sale.',
    menuCompleter: 'Menu to be defined',
    remarques: 'REMARKS',
    cgv: 'Terms & Conditions',
  },
};

export function generateQuoteHtml(d: QuoteHtmlData, opts: QuoteHtmlOptions = {}): string {
  const lang: 'fr' | 'en' = d.language === 'en' ? 'en' : 'fr';
  const t = T[lang];
  const m = (n: number) => money(n, lang);
  const dateFr = (s?: string | null) => dateFmt(s, lang);
  const activeServices = d.services.filter((s) => !s.removed);
  const htSansOption = activeServices.reduce((sum, s) => sum + (s.isFree || s.isOption ? 0 : s.quantity * s.unitPrice), 0);
  const optionHt = activeServices.filter((s) => s.isOption && !s.isFree).reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
  const ht  = htSansOption + optionHt;
  const vat = ht * (d.vatRate / 100);
  const ttc = ht + vat;
  const today = new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR');

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

  // ── Table rows Page 1 (titre uniquement, descriptions en page 2) ───────────
  const tableRows = activeServices.map((s) => {
    const badge = s.isFree
      ? `<span style="display:inline-block;font-size:9px;font-weight:700;color:#16a34a;background:#dcfce7;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;letter-spacing:0.3px;">${t.inclusBadge}</span>`
      : s.isOption
      ? `<span style="display:inline-block;font-size:9px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;letter-spacing:0.3px;">${t.option}</span>`
      : '';
    const isOpt = s.isOption;
    const rowBg = isOpt ? `background-color:#fffbeb;` : '';
    const nameColor = isOpt ? 'color:#92400e;' : 'color:#1a1a1a;';
    const priceStyle = s.isFree ? 'text-decoration:line-through;color:#9ca3af;' : isOpt ? 'color:#d97706;' : '';
    return `
    <tr style="${rowBg}">
      <td style="padding:9px 12px;border-bottom:1px solid ${lightBorder};vertical-align:top;">
        <strong style="font-size:12px;${nameColor}">${s.name || '—'}</strong>${badge}
      </td>
      <td style="padding:9px 12px;text-align:center;border-bottom:1px solid ${lightBorder};font-size:12px;vertical-align:top;${isOpt ? 'color:#d97706;' : ''}">${s.quantity}</td>
      ${!d.hidePrice ? `
      <td style="padding:9px 12px;text-align:right;border-bottom:1px solid ${lightBorder};font-size:12px;vertical-align:top;${priceStyle}">${s.isFree ? t.inclus : m(s.unitPrice)}</td>
      <td style="padding:9px 12px;text-align:right;border-bottom:1px solid ${lightBorder};font-size:12px;font-weight:600;vertical-align:top;${priceStyle}">${s.isFree ? t.inclus : m(s.quantity * s.unitPrice)}</td>
      ` : ''}
    </tr>`;
  }).join('');

  // ── Menu items Page 2 — use gastroCardHtml if available, otherwise fallback ──
  const menuItems = d.services
    .filter((s) => s.name)
    .map((s) => {
      // If prestation has a custom gastro_card_html, use it as-is (wrapped in container)
      // Use English version if language is 'en' AND English version exists, otherwise French
      const cardHtml = d.language === 'en' ? (s.gastroCardHtmlEn || s.gastroCardHtml) : s.gastroCardHtml;
      if (cardHtml) {
        return `<div style="margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid ${lightBorder};">${cardHtml}</div>`;
      }
      const optBadge = s.isOption
        ? `<span style="display:inline-block;font-size:9px;font-weight:700;color:#d97706;background:#fef3c7;padding:1px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;letter-spacing:0.3px;">${t.option}</span>`
        : '';
      return `
      <div style="margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid ${lightBorder};text-align:center;">
        <p style="font-size:15px;font-weight:normal;color:${s.isOption ? '#d97706' : menuItemColor};margin:0 0 5px;letter-spacing:0.3px;">${s.name}${optBadge}</p>
        ${s.description
          ? `<p class="svc-desc" style="font-size:12px;color:#777;font-style:italic;font-weight:normal;margin:0;line-height:1.55;">${s.description}</p>`
          : ''}
      </div>`;
    }).join('');

  return `${googleFontImport}
<!-- ═══════════════════════ PAGE 1 — DEVIS FINANCIER ═══════════════════════ -->
<div style="font-family:${fontFamily};color:#1a1a1a;line-height:1.65;">

  <!-- ── Header pleine largeur (marges négatives pour échapper au padding de la feuille A4) ── -->
  <div style="${headerGradient}margin:-20mm -20mm 0;padding:13mm 20mm 11mm;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 style="font-size:22px;font-weight:bold;color:white;margin:0 0 3px;letter-spacing:-0.5px;">${d.companyName}</h1>
        <p style="color:rgba(255,255,255,0.65);margin:0;font-size:11px;">${t.traiteurChef}</p>
      </div>
      <div style="text-align:right;">
        <div style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.5);color:white;padding:5px 16px;border-radius:5px;font-size:18px;font-weight:bold;letter-spacing:3px;display:inline-block;">${t.devis}</div>
        <p style="color:rgba(255,255,255,0.65);margin:6px 0 0;font-size:11px;">${t.date} : ${today}</p>
      </div>
    </div>
  </div>

  <!-- ── Client + Événement ── -->
  <div style="display:flex;gap:14px;margin-top:18px;margin-bottom:16px;">
    <div style="flex:1;background:${lightBg};border:1px solid ${lightBorder};border-radius:8px;padding:13px;">
      <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">${t.client}</p>
      <p style="font-size:14px;font-weight:bold;margin:0 0 3px;">${d.clientName || t.aCompleter}</p>
      ${d.clientEmail   ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${d.clientEmail}</p>` : ''}
      ${d.clientPhone   ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">${d.clientPhone}</p>` : ''}
      ${d.clientAddress ? `<p style="color:#555;margin:0;font-size:11px;">${d.clientAddress}</p>` : ''}
    </div>
    <div style="flex:1;background:${lightBg};border:1px solid ${lightBorder};border-radius:8px;padding:13px;">
      <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">${t.evenement}</p>
      <p style="font-size:14px;font-weight:bold;margin:0 0 3px;">${d.eventType || t.aPreciser}</p>
      ${d.eventDate     ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">📅 ${dateFr(d.eventDate)}</p>` : ''}
      ${d.guestCount    ? `<p style="color:#555;margin:0 0 2px;font-size:11px;">👥 ${t.invite(d.guestCount)}</p>` : ''}
      ${d.eventLocation ? `<p style="color:#555;margin:0;font-size:11px;">📍 ${d.eventLocation}</p>` : ''}
    </div>
  </div>

  <!-- ── Intro ── -->
  <div style="margin-bottom:16px;padding:11px 14px;border-left:4px solid ${accentColor};background:#fafafa;border-radius:0 5px 5px 0;">
    <p style="margin:0;font-style:italic;color:#555;font-size:12px;">
      ${t.intro(d.clientName || '', d.eventType || '', d.eventDate ? dateFr(d.eventDate) : '', d.eventLocation || '')}
    </p>
  </div>

  <!-- ── Tableau des prestations ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
    <thead>
      <tr style="${headerGradient}color:white;">
        <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.4px;">${t.designation}</th>
        <th style="padding:9px 12px;text-align:center;width:50px;font-size:11px;font-weight:600;">${t.qte}</th>
        ${!d.hidePrice ? `
        <th style="padding:9px 12px;text-align:right;width:88px;font-size:11px;font-weight:600;">${t.puHt}</th>
        <th style="padding:9px 12px;text-align:right;width:95px;font-size:11px;font-weight:600;">${t.totalHt}</th>
        ` : ''}
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="4" style="padding:14px;color:#bbb;font-style:italic;text-align:center;">${t.aucunePrestation}</td></tr>`}
    </tbody>
  </table>

  ${!d.hidePrice ? `
  <!-- ── Totaux ── -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
    <div style="min-width:220px;background:${lightBg};border:1px solid ${lightBorder};border-radius:8px;padding:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px;color:#666;">
        <span>${t.sousTotalHt}</span><span>${m(htSansOption)}</span>
      </div>
      ${optionHt > 0 ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px;color:#d97706;background:#fffbeb;padding:3px 6px;border-radius:4px;">
        <span>${t.siOptionsHt}</span><span>${m(optionHt)}</span>
      </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:12px;color:#666;padding-bottom:10px;border-bottom:1px solid ${lightBorder};">
        <span>${t.tva} (${d.vatRate}%)</span><span>${m(vat)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:bold;color:${accentColor};">
        <span>${t.totalTtc}</span><span>${m(ttc)}</span>
      </div>
    </div>
  </div>
  ` : ''}

</div>

<!-- ─── SÉPARATEUR : visible écran · page-break à l'impression ─── -->
<div class="screen-sep" style="page-break-after:always;break-after:page;margin:26px -20mm;border-top:2px dashed #e9d5ff;padding:7px 20mm;text-align:center;color:#9c27b0;font-size:10px;letter-spacing:0.08em;user-select:none;">
  ${t.sautPage.replace('✂  ', '✂&nbsp;&nbsp;')}
</div>

<!-- ═══════════════════════ CARTE GASTRONOMIQUE ═══════════════════════ -->
<div class="gastro-page" style="font-family:${fontFamily};color:#1a1a1a;line-height:1.7;">

  <!-- ── Header Carte (pleine largeur) ── -->
  <div class="gastro-header" style="${headerGradient}margin:24px -20mm 28px;padding:14mm 20mm 12mm;text-align:center;">
    <p style="font-size:9px;font-weight:bold;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:3px;margin:0 0 5px;">
      ${t.eventLabel(d.eventType || '', d.eventDate ? dateFr(d.eventDate) : '')}
    </p>
    <h2 style="font-size:24px;font-weight:bold;color:white;margin:0 0 4px;font-style:italic;letter-spacing:0.5px;">${t.menuTitle(d.eventType || '')}</h2>
    ${d.eventLocation ? `<p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:11px;">📍 ${d.eventLocation}</p>` : ''}
    <div style="width:36px;height:2px;background:rgba(255,255,255,0.35);margin:12px auto 0;"></div>
  </div>

  <!-- ── Plats ── -->
  <div class="gastro-menu" style="max-width:400px;margin:0 auto;">
    ${menuItems || `<p style="text-align:center;color:#bbb;font-style:italic;">${t.menuCompleter}</p>`}
  </div>

  <!-- ── Pied de carte ── -->
  <div style="margin-top:28px;text-align:center;padding-top:14px;border-top:1px solid #f3e5f5;">
    <p style="font-size:11px;color:#ccc;font-style:italic;margin:0;">${d.companyName} — ${t.traiteurChef}</p>
  </div>
</div>

<!-- ═══════════════════════ REMARQUES + SIGNATURES + CONDITIONS ═══════════════════════ -->
${d.remarks ? `
<div style="margin:20px 0 16px;">
  <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 5px;">${t.remarques}</p>
  <p style="font-size:12px;color:#555;white-space:pre-line;margin:0;">${d.remarks}</p>
</div>
` : ''}

<div style="display:flex;gap:14px;margin-top:16px;">
  <div style="flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:12px;min-height:60px;">
    <p style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">${t.bonAccord}</p>
    <p style="font-size:10px;color:#bbb;font-style:italic;margin:0;">${t.dateSignature}</p>
  </div>
  <div style="flex:1;border:1px solid #e0e0e0;border-radius:8px;padding:12px;min-height:60px;">
    <p style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">${t.prestataire}</p>
    <p style="font-size:12px;font-weight:600;margin:0;">${d.companyName}</p>
  </div>
</div>

<div style="margin-top:14px;padding:7px 12px;background:#fafafa;border-radius:5px;border:1px solid #f0f0f0;">
  <p style="font-size:10px;color:#aaa;margin:0;text-align:center;">${t.devisValide}</p>
</div>

${d.cgv ? `
<!-- ═══════════════════════ CONDITIONS GÉNÉRALES DE VENTE ═══════════════════════ -->
<div style="page-break-before:always;break-before:page;margin-top:24px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
    <div style="flex:1;height:1px;background:#e0e0e0;"></div>
    <p style="font-size:9px;font-weight:bold;color:${accentColor};text-transform:uppercase;letter-spacing:2px;margin:0;">${t.cgv}</p>
    <div style="flex:1;height:1px;background:#e0e0e0;"></div>
  </div>
  <div style="font-size:10px;color:#555;line-height:1.6;">${d.cgv}</div>
</div>
` : ''}
`.trim();
}
