// Mise en page de sortie d'un devis : une seule feuille de style pour l'impression depuis l'éditeur,
// la page d'impression et le lien envoyé au client. Ce qu'on voit dans l'éditeur est ce qui sort.

/** Polices présentes sur les appareils ; toutes les autres viennent de Google Fonts. */
const SYSTEM_FONTS = ['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Courier New', 'Trebuchet MS', 'Garamond'];

/** Polices proposées pour un devis (les mêmes que dans l'éditeur). */
export const QUOTE_FONTS = [
  'Georgia', 'Times New Roman', 'Garamond', 'Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond', 'EB Garamond',
  'Crimson Text', 'Libre Baskerville', 'Spectral', 'Arial', 'Helvetica', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  'Inter', 'Raleway', 'Nunito', 'Source Sans 3', 'Work Sans',
];

export interface QuoteOutputSettings {
  font: string;
  /** Taille de base du texte, en pixels. */
  fontSize: number;
  lineHeight: string;
  /** Afficher les descriptions des prestations. */
  showDesc: boolean;
}

/** Réglages de l'éditeur gardés avec le devis (colonne `editor_settings`). */
export interface QuoteEditorSettings {
  lineHeight?: string;
  showDesc?: boolean;
  menuWidth?: string;
}

export const DEFAULT_LINE_HEIGHT = '1.4';

export function outputSettings(quote: { selected_font?: string | null; selected_font_size?: number | null; editor_settings?: unknown }): QuoteOutputSettings {
  const saved = (quote.editor_settings && typeof quote.editor_settings === 'object' ? quote.editor_settings : {}) as QuoteEditorSettings;
  return {
    font: quote.selected_font || 'Georgia',
    fontSize: quote.selected_font_size || 12,
    lineHeight: /^\d(\.\d)?$/.test(saved.lineHeight ?? '') ? saved.lineHeight! : DEFAULT_LINE_HEIGHT,
    showDesc: saved.showDesc !== false,
  };
}

/** Feuille de style de la police choisie, ou null pour une police déjà présente sur l'appareil. */
export function googleFontHref(font: string): string | null {
  if (!font || SYSTEM_FONTS.includes(font)) return null;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:ital,wght@0,400;0,600;0,700;1,400&display=swap`;
}

const cssFont = (font: string) => font.replace(/[^\w\s-]/g, '');

/**
 * Règles communes à toutes les sorties. Le document est dans `.quote-doc` ; à l'impression, il est placé dans un
 * tableau `.quote-pages` dont l'en-tête et le pied, répétés par le navigateur sur chaque page, servent de marges
 * haute et basse (les pages gardent ainsi des marges après la première, et les bandeaux restent à fond perdu).
 */
export function quoteOutputCss(s: QuoteOutputSettings): string {
  const font = cssFont(s.font);
  return `
    @page { size: A4; margin: 0; }
    .quote-out, .quote-out * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .quote-out { color: #1a1a1a; background: #fff; }
    .quote-pages { width: 100%; border-collapse: collapse; border-spacing: 0; table-layout: fixed; }
    .quote-pages > thead > tr > td, .quote-pages > tfoot > tr > td, .quote-pages > tbody > tr > td { padding: 0; border: 0; }
    .quote-gap { height: 0; }
    .quote-doc { padding: 20mm; font-size: ${s.fontSize}px; line-height: ${s.lineHeight}; }
    .quote-doc, .quote-doc * { font-family: '${font}', Georgia, serif !important; }
    .quote-doc, .quote-doc p, .quote-doc li, .quote-doc div, .quote-doc span, .quote-doc td, .quote-doc th { line-height: ${s.lineHeight} !important; }
    .quote-doc h1, .quote-doc h2, .quote-doc h3 { line-height: 1.25 !important; }
    .quote-doc * { min-height: 0 !important; }
    .quote-doc ul { list-style: disc outside; padding-left: 1.6em; margin: 6px 0; }
    .quote-doc ol { list-style: decimal outside; padding-left: 1.6em; margin: 6px 0; }
    .quote-doc li { display: list-item; }
    .quote-doc img { max-width: 100%; }
    .quote-doc table { max-width: 100%; }
    .quote-doc .screen-sep {
      visibility: hidden !important; height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important;
      font-size: 0 !important; line-height: 0 !important; overflow: hidden !important;
      page-break-after: always !important; break-after: page !important;
    }
    .quote-doc .gastro-page { page-break-before: always !important; break-before: page !important; }
    /* Une ligne du tableau ou le bloc des totaux ne sont jamais coupés entre deux pages. */
    .quote-doc tr, .quote-doc [data-webo-financials] > div { page-break-inside: avoid; break-inside: avoid; }
    /* Le bandeau du menu n'est jamais coupé (son fond s'étirerait sur la page). Un plat ne l'est pas non plus, sauf
       s'il est long : markLongDishes, lancé avant chaque impression, lui donne alors la classe webo-long et il
       continue page suivante au lieu de laisser le bandeau seul sur une page presque vide. */
    .quote-doc .gastro-header { page-break-inside: avoid; break-inside: avoid; }
    .quote-doc .gastro-menu > div, .quote-doc .gastro-menu p, .quote-doc .gastro-menu li,
    .quote-doc .gastro-menu h1, .quote-doc .gastro-menu h2, .quote-doc .gastro-menu h3,
    .quote-doc .gastro-menu .svc-desc { page-break-inside: avoid; break-inside: avoid; }
    .quote-doc .gastro-menu .webo-long { page-break-inside: auto; break-inside: auto; }
    /* Le nom d'un plat reste avec la suite. */
    .quote-doc .gastro-menu h1, .quote-doc .gastro-menu h2, .quote-doc .gastro-menu h3,
    .quote-doc .gastro-menu .webo-keep-next { page-break-after: avoid; break-after: avoid; }
    .quote-doc thead { display: table-header-group; }
    .quote-doc p, .quote-doc li { orphans: 2; widows: 2; }
    ${s.showDesc ? '' : '.quote-doc .svc-desc { display: none !important; }'}
    @media print {
      .quote-gap { height: 14mm; }
      .quote-doc { padding-top: 0; padding-bottom: 0; }
      /* Le bandeau d'en-tête remonte jusqu'au bord de la feuille, par-dessus la marge haute de la première page. */
      .quote-doc [style*="-20mm -20mm 0"] { margin-top: -14mm !important; }
    }
  `;
}

/**
 * Hauteur (px) au-delà de laquelle un plat de la carte peut continuer page suivante : la moitié de la hauteur
 * utile d'une page A4 (297 mm moins les deux marges de 14 mm de .quote-gap, à 96 px par pouce). Un plat plus court
 * n'est jamais coupé ; au pire, il laisse une demi-page blanche en passant à la page suivante.
 */
export const LONG_DISH_PX = Math.round(((297 - 2 * 14) * 96) / 25.4 / 2);

/**
 * Marque les plats trop hauts pour être gardés d'un seul tenant (classe webo-long, voir quoteOutputCss), et le
 * nom de chacun d'eux (webo-keep-next), pour qu'il ne reste pas seul en bas de page. Les hauteurs sont mesurées
 * à la largeur d'une feuille A4, quelle que soit celle de la fenêtre. À lancer avant chaque impression : la page
 * d'impression de l'éditeur l'embarque telle quelle (d'où l'écriture sans dépendance), les pages /imprimer et /d
 * l'appellent via PrintBreaks. Les classes ne vivent que dans la page imprimée, jamais dans le devis enregistré.
 */
export function markLongDishes(doc: Document, limit: number): void {
  doc.querySelectorAll('.webo-long, .webo-keep-next').forEach((el) => el.classList.remove('webo-long', 'webo-keep-next'));
  const tables = Array.from(doc.querySelectorAll<HTMLElement>('.quote-pages'));
  const widths = tables.map((t) => t.style.width);
  tables.forEach((t) => { t.style.width = '210mm'; });
  const long = Array.from(doc.querySelectorAll<HTMLElement>(
    '.quote-doc .gastro-menu > div, .quote-doc .gastro-menu p, .quote-doc .gastro-menu li, .quote-doc .gastro-menu .svc-desc',
  )).filter((el) => el.getBoundingClientRect().height > limit);
  tables.forEach((t, i) => { t.style.width = widths[i]; });
  long.forEach((el) => {
    el.classList.add('webo-long');
    if (!el.parentElement?.classList.contains('gastro-menu')) return;
    // Le nom du plat : premier élément de la fiche, en descendant dans les blocs qui l'enveloppent.
    let box: Element = el;
    while (box.children.length === 1 && /^(DIV|SECTION|ARTICLE)$/.test(box.children[0].tagName)) box = box.children[0];
    if (box.children.length > 1) box.children[0].classList.add('webo-keep-next');
  });
}

/** Le document, enveloppé pour que chaque page imprimée ait ses marges. */
export function wrapQuoteDoc(contentHtml: string): string {
  return `<table class="quote-pages" role="presentation"><thead><tr><td><div class="quote-gap"></div></td></tr></thead>`
    + `<tfoot><tr><td><div class="quote-gap"></div></td></tr></tfoot>`
    + `<tbody><tr><td><div class="quote-doc">${contentHtml}</div></td></tr></tbody></table>`;
}

/** Page complète pour la fenêtre d'impression de l'éditeur (Imprimer et Enregistrer en PDF sont la même sortie). */
export function buildQuotePrintPage(p: {
  title: string;
  /** Contenu du document, déjà nettoyé. */
  content: string;
  settings: QuoteOutputSettings;
  coverHtml?: string;
  logoHtml?: string;
  photosHtml?: string;
  cgvHtml?: string;
}): string {
  const fontHref = googleFontHref(p.settings.font);
  const title = p.title.replace(/[<>&"]/g, '');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  ${fontHref ? `<link rel="stylesheet" href="${fontHref}">` : ''}
  <style>
    html, body { margin: 0; padding: 0; background: #fff; color-scheme: light; }
    ${quoteOutputCss(p.settings)}
  </style>
</head>
<body class="quote-out">
  ${p.coverHtml ?? ''}
  ${p.coverHtml ? '' : (p.logoHtml ?? '')}
  ${wrapQuoteDoc(p.content)}
  ${p.photosHtml ?? ''}
  ${p.cgvHtml ?? ''}
  <script>
    var markLongDishes = ${markLongDishes.toString()};
    function pageBreaks() { markLongDishes(document, ${LONG_DISH_PX}); }
    window.addEventListener('beforeprint', pageBreaks);
    // L'impression part quand les polices et les images sont là : sinon la mise en page bouge pendant l'aperçu.
    window.onload = function () {
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      ready.then(function () { pageBreaks(); setTimeout(function () { window.print(); }, 250); });
    };
  </script>
</body>
</html>`;
}
