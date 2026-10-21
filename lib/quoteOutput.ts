// Mise en page de sortie d'un devis : une seule feuille de style pour l'impression depuis l'éditeur,
// la page d'impression et le lien envoyé au client. Ce qu'on voit dans l'éditeur est ce qui sort.

import { lightenImagesForPrint } from './printImages';

/** Polices présentes sur les appareils ; toutes les autres viennent de Google Fonts. */
const SYSTEM_FONTS = ['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Courier New', 'Trebuchet MS', 'Garamond'];

/** Polices proposées pour un devis (les mêmes que dans l'éditeur). */
export const QUOTE_FONTS = [
  'Georgia', 'Times New Roman', 'Garamond', 'Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond', 'EB Garamond',
  'Crimson Text', 'Libre Baskerville', 'Spectral', 'Arial', 'Helvetica', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Poppins',
  'Inter', 'Raleway', 'Nunito', 'Source Sans 3', 'Work Sans', 'Dancing Script', 'Great Vibes', 'Pinyon Script', 'Cinzel',
  'Abril Fatface', 'Bebas Neue', 'Oswald',
];

export interface QuoteOutputSettings {
  font: string;
  /** Taille de base du texte, en pixels. */
  fontSize: number;
  lineHeight: string;
  /** Afficher les descriptions des prestations. */
  showDesc: boolean;
  /** Un plat de la carte peut continuer page suivante (entre deux paragraphes) au lieu de partir entier. */
  splitDishes?: boolean;
}

/** Réglages de l'éditeur gardés avec le devis (colonne `editor_settings`). */
export interface QuoteEditorSettings {
  lineHeight?: string;
  showDesc?: boolean;
  menuWidth?: string;
  splitDishes?: boolean;
}

export const DEFAULT_LINE_HEIGHT = '1.4';

/** Interlignes proposés pour un paragraphe (repère data-webo-lh posé par l'éditeur). */
export const PARAGRAPH_LINE_HEIGHTS = ['1', '1.2', '1.4', '1.6', '1.8', '2'];

/**
 * Interligne propre à un paragraphe : il passe devant celui du devis, pour le bloc et tout ce qu'il contient.
 * Les règles « contenu » viennent d'abord : un bloc qui a son propre repère garde le sien dans un bloc repéré.
 */
function paragraphLineHeightCss(): string {
  const inner = PARAGRAPH_LINE_HEIGHTS.map((v) =>
    `.quote-doc [data-webo-lh="${v}"] :where(p, li, div, span, td, th, h1, h2, h3, h4, h5, h6):not([data-webo-lh]) { line-height: ${v} !important; }`);
  const own = PARAGRAPH_LINE_HEIGHTS.map((v) => `.quote-doc [data-webo-lh="${v}"][data-webo-lh] { line-height: ${v} !important; }`);
  return [...inner, ...own].join('\n    ');
}

export function outputSettings(quote: { selected_font?: string | null; selected_font_size?: number | null; editor_settings?: unknown }): QuoteOutputSettings {
  const saved = (quote.editor_settings && typeof quote.editor_settings === 'object' ? quote.editor_settings : {}) as QuoteEditorSettings;
  return {
    font: quote.selected_font || 'Georgia',
    fontSize: quote.selected_font_size || 12,
    lineHeight: /^\d(\.\d)?$/.test(saved.lineHeight ?? '') ? saved.lineHeight! : DEFAULT_LINE_HEIGHT,
    showDesc: saved.showDesc !== false,
    splitDishes: saved.splitDishes === true,
  };
}

/** Feuille de style de la police choisie, ou null pour une police déjà présente sur l'appareil. */
export function googleFontHref(font: string): string | null {
  return googleFontsHref([font]);
}

/** Une seule feuille de style Google Fonts pour plusieurs polices, ou null si toutes sont sur l'appareil. */
export function googleFontsHref(fonts: string[]): string | null {
  const families = fonts.filter((f) => f && !SYSTEM_FONTS.includes(f))
    .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,400;0,600;0,700;1,400`);
  return families.length ? `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap` : null;
}

/** Polices d'un document : celle du devis, puis celles choisies pour des paragraphes (repère data-webo-font). */
export function documentFonts(font: string, html?: string | null): string[] {
  const marked = Array.from((html ?? '').matchAll(/data-webo-font="([^"]+)"/g), (m) => m[1]).filter((f) => QUOTE_FONTS.includes(f));
  return Array.from(new Set([font, ...marked]));
}

/** Police propre à un paragraphe : la variable passe au bloc et à son contenu, le bloc repéré le plus proche gagne. */
function paragraphFontCss(): string {
  return QUOTE_FONTS.map((f) => `.quote-doc [data-webo-font="${f}"] { --webo-font: '${cssFont(f)}'; }`).join('\n    ');
}

const cssFont = (font: string) => font.replace(/[^\w\s-]/g, '');

/** Marge haute et basse de chaque page imprimée (hauteur de .quote-gap à l'impression), en millimètres. */
export const PRINT_GAP_MM = 14;

const MM_TO_PX = 96 / 25.4;

/** Hauteur d'une feuille A4 entière, en pixels CSS. */
export const A4_PAGE_PX = 297 * MM_TO_PX;

/** Hauteur utile d'une page du document imprimé (A4 moins les marges haute et basse), en pixels CSS. */
export const PAGE_CONTENT_PX = (297 - 2 * PRINT_GAP_MM) * MM_TO_PX;

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
    .quote-doc, .quote-doc * { font-family: var(--webo-font, '${font}'), Georgia, serif !important; }
    ${paragraphFontCss()}
    .quote-doc, .quote-doc p, .quote-doc li, .quote-doc div, .quote-doc span, .quote-doc td, .quote-doc th { line-height: ${s.lineHeight} !important; }
    .quote-doc h1, .quote-doc h2, .quote-doc h3 { line-height: 1.25 !important; }
    /* Un paragraphe sans marge écrite n'en a pas, comme dans les éditeurs où il est saisi (description, CGV, carte) :
       sans cela, chaque ligne d'une description (un <p> par ligne) était séparée d'une ligne vide. */
    .quote-doc p { margin: 0; }
    ${paragraphLineHeightCss()}
    .quote-doc * { min-height: 0 !important; }
    .quote-doc ul { list-style: disc outside; padding-left: 1.6em; margin: 6px 0; }
    .quote-doc ol { list-style: decimal outside; padding-left: 1.6em; margin: 6px 0; }
    .quote-doc li { display: list-item; }
    .quote-doc img { max-width: 100%; }
    .quote-doc table { max-width: 100%; }
    /* Repère « Saut de page » : absent du papier, c'est l'élément qui le suit qui commence la nouvelle page.
       (Quand le repère, même sans hauteur, tombait juste après une fin de page, il y était posé seul puis faisait
       changer de page : une page blanche.) */
    .quote-doc .screen-sep { display: none !important; }
    .quote-doc .screen-sep + * { page-break-before: always !important; break-before: page !important; }
    .quote-doc .gastro-page { page-break-before: always !important; break-before: page !important; }
    /* Une ligne du tableau ou le bloc des totaux ne sont jamais coupés entre deux pages. */
    .quote-doc tr, .quote-doc [data-webo-financials] > div { page-break-inside: avoid; break-inside: avoid; }
    /* Le papier ne coupe jamais un bloc de texte (paragraphe, titre, élément de liste, ligne de cases côte à côte,
       bloc sans bloc enfant) : l'éditeur, qui montre les pages, ne sait pas couper un paragraphe en deux. Seul un
       bloc plus haut qu'une page reste coupé ; l'éditeur le signale. Les coupures tombent donc entre deux blocs. */
    .quote-doc p, .quote-doc li, .quote-doc h1, .quote-doc h2, .quote-doc h3, .quote-doc h4, .quote-doc h5, .quote-doc h6,
    .quote-doc blockquote, .quote-doc pre, .quote-doc figure, .quote-doc img,
    .quote-doc [style*="display:flex"], .quote-doc [style*="display: flex"], .quote-doc [style*="display:grid"], .quote-doc [style*="display: grid"],
    .quote-doc div:not(:has(div, p, ul, ol, table, h1, h2, h3, h4, h5, h6, blockquote, pre, figure, section, article)) {
      page-break-inside: avoid; break-inside: avoid;
    }
    /* Un titre reste avec ce qui le suit. */
    .quote-doc h1, .quote-doc h2, .quote-doc h3, .quote-doc h4 { page-break-after: avoid; break-after: avoid; }
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
    /* L'en-tête d'un tableau n'est pas répété en haut de la page suivante (l'éditeur ne pourrait pas le montrer). */
    .quote-doc thead { display: table-row-group; }
    /* Le cadre « Bon pour accord » n'est pas coupé, et ne commence pas seul en haut d'une page quand le texte
       qui le précède peut l'accompagner (repère posé par generateQuoteHtml ou par markSignature). */
    .quote-doc [data-webo-sign], .quote-doc .webo-sign { page-break-inside: avoid; break-inside: avoid; }
    .quote-doc :has(+ [data-webo-sign]), .quote-doc :has(+ .webo-sign) { page-break-after: avoid; break-after: avoid; }
    .quote-doc p, .quote-doc li { orphans: 2; widows: 2; }
    ${s.showDesc ? '' : '.quote-doc .svc-desc { display: none !important; }'}
    ${s.splitDishes ? `/* Plats coupés d'une page à l'autre : la coupure tombe entre deux paragraphes, que l'éditeur montre. */
    .quote-doc .gastro-menu > div { page-break-inside: auto; break-inside: auto; }` : ''}
    @media print {
      .quote-gap { height: ${PRINT_GAP_MM}mm; }
      .quote-doc { padding-top: 0; padding-bottom: 0; }
      /* Le bandeau d'en-tête remonte jusqu'au bord de la feuille, par-dessus la marge haute de la première page. */
      .quote-doc [style*="-20mm -20mm 0"] { margin-top: -${PRINT_GAP_MM}mm !important; }
    }
  `;
}

/**
 * Annule, dans `paper`, les styles de l'application qui changent la mise en page des balises (remise à zéro de
 * Tailwind : marges des paragraphes et titres, taille des titres, puces, images en bloc, bordures… ; police et
 * espacement des titres de l'application) : on revient aux valeurs par défaut du navigateur, celles de la fenêtre
 * d'impression de l'éditeur. À placer avant quoteOutputCss, dont les règles gardent le dessus.
 */
export function appResetCss(paper: string): string {
  const reset = (tags: string, props: string[]) => `${paper} :is(${tags}) { ${props.map((p) => `${p}: revert;`).join(' ')} }`;
  return [
    // Texte hors du document (logo, mentions, conditions) : police par défaut du navigateur, comme à l'impression.
    `${paper} { font: initial; letter-spacing: normal; }`,
    `${paper} *, ${paper} *::before, ${paper} *::after { border-width: revert; border-style: revert; border-color: revert; }`,
    reset('h1, h2, h3, h4, h5, h6', ['font-size', 'font-weight', 'font-family', 'margin', 'letter-spacing']),
    reset('blockquote, dl, dd, figure, p, pre, hr', ['margin']),
    reset('hr', ['height', 'color', 'border-top-width']),
    reset('ol, ul, menu', ['list-style', 'margin', 'padding']),
    reset('a', ['color', 'text-decoration']),
    reset('b, strong', ['font-weight']),
    reset('code, kbd, samp, pre, small', ['font-size']),
    reset('sub, sup', ['font-size', 'line-height', 'position', 'vertical-align', 'top', 'bottom']),
    reset('table', ['text-indent', 'border-color', 'border-collapse']),
    reset('img, svg, video, canvas, audio, iframe, embed, object', ['display', 'vertical-align']),
    reset('img, video', ['max-width', 'height']),
  ].join('\n');
}

/**
 * Feuille de style de l'éditeur : la feuille à l'écran a exactement la mise en page du papier.
 *  • Les styles de l'application qui changent la mise en page des balises (remise à zéro de Tailwind : marges
 *    des paragraphes et titres, taille des titres, puces, images en bloc, bordures…, et l'espacement des titres
 *    de l'application) sont annulés dans `paper` : on revient aux valeurs par défaut du navigateur, celles de la
 *    fenêtre d'impression.
 *  • Les règles de la sortie (quoteOutputCss), règles d'impression comprises, s'appliquent à la zone de texte
 *    `root` (qui porte aussi la classe quote-doc), avec la marge haute et basse du papier (14 mm).
 *  • Le repère « Saut de page » n'occupe aucune hauteur : il est dessiné par-dessus le texte.
 * @param paper Sélecteur de la feuille (logo, zone de texte, mentions légales).
 * @param root Sélecteur de la zone de texte.
 */
export function quoteEditorCss(s: QuoteOutputSettings, paper: string, root: string): string {
  const doc = `${root}.quote-doc`;
  const output = quoteOutputCss(s)
    .replace(/@page\s*\{[^}]*\}/, '')
    .replace('@media print', '@media all')
    .replace(/\.quote-doc/g, doc);
  return [
    appResetCss(paper),
    output,
    `${doc} { padding-top: ${PRINT_GAP_MM}mm !important; padding-bottom: ${PRINT_GAP_MM}mm !important; }`,
    `${doc} .screen-sep { display: block !important; position: relative !important; height: 0 !important; margin: 0 !important;`
      + ` padding: 0 !important; border: 0 !important; font-size: 0 !important; line-height: 0 !important; color: transparent !important;`
      + ` overflow: visible !important; visibility: visible !important; }`,
    `${doc} .screen-sep::after { content: 'Saut de page'; position: absolute; left: -20mm; right: -20mm; top: -1px;`
      + ` border-top: 2px dashed #E6DFD3; padding-top: 3px; text-align: center; color: #B4502D; letter-spacing: 0.08em;`
      + ` font: 10px/1 system-ui, sans-serif; pointer-events: none; }`,
  ].join('\n');
}

/**
 * Hauteur (px) au-delà de laquelle un plat de la carte peut continuer page suivante : la hauteur utile d'une page
 * A4 (297 mm moins les deux marges de 14 mm de .quote-gap, à 96 px par pouce). Un plat plus court n'est jamais
 * coupé (comme dans l'éditeur, qui montre les pages) ; un plat plus long ne tiendrait sur aucune page.
 */
export const LONG_DISH_PX = Math.floor(PAGE_CONTENT_PX);

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

/**
 * Repère le cadre « Bon pour accord » d'un devis qui n'a pas la balise data-webo-sign (devis rédigés avant elle) :
 * le plus petit bloc qui l'entoure reçoit la classe webo-sign (voir quoteOutputCss). Comme markLongDishes, à
 * lancer avant chaque impression, sans dépendance ; la classe ne vit que dans la page imprimée.
 */
export function markSignature(doc: Document): void {
  doc.querySelectorAll('.webo-sign').forEach((el) => el.classList.remove('webo-sign'));
  doc.querySelectorAll<HTMLElement>('.quote-doc').forEach((root) => {
    if (root.querySelector('[data-webo-sign]')) return;
    const label = /bon pour accord|agreement\s*[—–-]\s*client/i;
    // Le plus profond des blocs qui portent la mention, et le dernier du document.
    let box: HTMLElement | null = null;
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('p, span, strong, b, div, td, h1, h2, h3, h4, h5, h6'));
    for (const el of candidates) {
      if (el.closest('[data-webo-cgv]') || !label.test(el.textContent || '')) continue;
      if (!Array.from(el.children).some((c) => label.test(c.textContent || ''))) box = el;
    }
    if (!box) return;
    // On remonte jusqu'au cadre complet (les deux cases de signature), sans englober le reste du document.
    while (box.parentElement && box.parentElement !== root && (box.parentElement.textContent || '').length <= 400) box = box.parentElement;
    box.classList.add('webo-sign');
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
  /** Mentions légales de l'entreprise, sous le document. */
  legalHtml?: string;
}): string {
  const fontHref = googleFontsHref(documentFonts(p.settings.font, p.content));
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
  ${p.legalHtml ?? ''}
  ${p.photosHtml ?? ''}
  ${p.cgvHtml ?? ''}
  <script>
    var markLongDishes = ${markLongDishes.toString()};
    var markSignature = ${markSignature.toString()};
    var lightenImagesForPrint = ${lightenImagesForPrint.toString()};
    function pageBreaks() { markLongDishes(document, ${LONG_DISH_PX}); markSignature(document); }
    window.addEventListener('beforeprint', pageBreaks);
    // L'impression part quand les polices et les images sont là : sinon la mise en page bouge pendant l'aperçu.
    window.onload = function () {
      var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      // Photos recompressées en JPEG avant l'impression : le PDF reste léger (voir lib/printImages.ts).
      ready.then(function () { return lightenImagesForPrint(document).catch(function () {}); })
        .then(function () { pageBreaks(); setTimeout(function () { window.print(); }, 250); });
    };
  </script>
</body>
</html>`;
}
