// Mesure des pages imprimées d'un devis, dans un document à part (cadre caché de l'éditeur) qui reprend la
// feuille de style et les repères de la sortie papier. Lecture du DOM seulement ; le calcul des fins de page est
// dans lib/pageBreaks.ts. Voir usePrintPreview pour l'usage.

import { computePageBreaks, type PageBlock, type PageBreakResult } from '@/lib/pageBreaks';
import {
  A4_PAGE_PX, LONG_DISH_PX, PAGE_CONTENT_PX, googleFontHref, markLongDishes, markSignature, quoteOutputCss, wrapQuoteDoc,
  type QuoteOutputSettings,
} from '@/lib/quoteOutput';
import { documentHasCgv } from '@/lib/cgvDetect';

/** Document du cadre de mesure : mêmes enveloppes que la page d'impression (logo, document, mentions, CGV). */
export const MEASURE_FRAME_DOC = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">`
  + `<style>html, body { margin: 0; padding: 0; background: #fff; overflow: hidden; }</style><style id="out"></style><link id="font" rel="stylesheet">`
  + `</head><body class="quote-out"><div id="m-before"></div>${wrapQuoteDoc('')}<div id="m-legal"></div><div id="m-cgv"></div></body></html>`;

const isPageBreak = (v: string) => v === 'page' || v === 'always' || v === 'left' || v === 'right' || v === 'recto' || v === 'verso';

function isSideBySide(cs: CSSStyleDeclaration): boolean {
  if (cs.display === 'grid' || cs.display === 'inline-grid') return true;
  return (cs.display === 'flex' || cs.display === 'inline-flex') && !cs.flexDirection.startsWith('column');
}

/** Bloc sans bloc enfant (texte, image…) : on le mesure d'un seul tenant. */
function isLeaf(el: Element, win: Window): boolean {
  for (const c of Array.from(el.children)) {
    if (c.tagName === 'BR') continue;
    const d = win.getComputedStyle(c).display;
    if (d !== 'none' && !d.startsWith('inline')) return false;
  }
  return true;
}

/** Les blocs du document mesuré, dans l'ordre, avec pour chacun le chemin de l'élément (index des enfants). */
export function collectBlocks(root: HTMLElement, win: Window, rootTop: number, pageHeight = Infinity): { blocks: PageBlock[]; paths: number[][] } {
  const blocks: PageBlock[] = [];
  const paths: number[][] = [];
  let pendingForce = false;

  const walk = (parent: Element, path: number[]) => {
    Array.from(parent.children).forEach((child, i) => {
      const cs = win.getComputedStyle(child);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') return;
      const force = pendingForce || isPageBreak(cs.breakBefore);
      const avoid = cs.breakInside.startsWith('avoid');
      const row = child.tagName === 'TR';
      const sideBySide = isSideBySide(cs);
      const leaf = row || child.tagName === 'IMG' || sideBySide || isLeaf(child, win);
      const childPath = [...path, i];
      const rect = child.getBoundingClientRect();
      // Un bloc « à ne pas couper » plus haut qu'une page est coupé quand même par le navigateur, entre ses
      // enfants (lignes du tableau…) : on descend dedans.
      const keepWhole = avoid && !(rect.height > pageHeight && !leaf);

      if (keepWhole || leaf) {
        // Un repère de saut sans hauteur (séparateur de l'éditeur) occupe quand même une page : s'il tombe juste
        // après la fin d'une page, le navigateur l'y pose seul, puis change de page (page blanche).
        const marker = rect.height === 0 && isPageBreak(cs.breakAfter);
        if (rect.height > 0 || force || marker) {
          const hasImg = child.tagName === 'IMG' || !!child.querySelector('img');
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          let repeatHeader: number | undefined;
          if (row && child.parentElement?.tagName === 'TBODY') {
            const thead = child.closest('table')?.querySelector(':scope > thead');
            if (thead) repeatHeader = thead.getBoundingClientRect().height;
          }
          blocks.push({
            top: rect.top - rootTop,
            height: marker ? 1 : rect.height,
            unbreakable: keepWhole || row || hasImg || marker,
            forceBreakBefore: force,
            keepWithNext: cs.breakAfter === 'avoid',
            lineHeight: keepWhole || row || hasImg ? undefined : lh,
            repeatHeader,
          });
          paths.push(childPath);
          pendingForce = false;
        }
      } else {
        if (force) pendingForce = true;
        const before = blocks.length;
        walk(child, childPath);
        // « Ne pas couper après » un conteneur : son dernier bloc part avec la suite.
        if (cs.breakAfter === 'avoid' && blocks.length > before) blocks[blocks.length - 1].keepWithNext = true;
      }
      if (isPageBreak(cs.breakAfter)) pendingForce = true;
    });
  };
  walk(root, []);
  return { blocks, paths };
}

export function resolvePath(root: Element, path: number[]): Element | null {
  let el: Element | null = root;
  for (const i of path) {
    el = el?.children[i] ?? null;
    if (!el) return null;
  }
  return el;
}

export interface MeasureInput {
  /** Contenu du document (HTML de la feuille de l'éditeur). */
  html: string;
  settings: QuoteOutputSettings;
  coverEnabled: boolean;
  photoPages: number;
  logoHtml: string;
  legalHtml: string;
  cgvHtml: string;
  cgvText: string | null;
}

export interface MeasureResult {
  blocks: PageBlock[];
  /** Chemin de chaque bloc dans le document ([] : mentions légales, sous le document). */
  paths: number[][];
  result: PageBreakResult;
  /** Pages avant le document (page de garde). */
  coverPages: number;
  totalPages: number;
}

/**
 * Recopie le devis dans le document de mesure (créé avec MEASURE_FRAME_DOC), applique les règles de l'impression
 * et calcule les fins de page. `written` garde ce qui a déjà été recopié, pour ne réécrire que ce qui change.
 */
export function measurePrintPages(idoc: Document, iwin: Window, input: MeasureInput, written: Map<Element, string>): MeasureResult | null {
  const { html, settings, coverEnabled, photoPages, logoHtml, legalHtml, cgvHtml, cgvText } = input;
  const qd = idoc.querySelector<HTMLElement>('.quote-doc');
  if (!qd) return null;
    // Même feuille de style que l'impression, règles d'impression appliquées à l'écran du cadre.
    const style = idoc.getElementById('out');
    const css = quoteOutputCss(settings).replace('@media print', '@media all');
    if (style && style.textContent !== css) style.textContent = css;
    const link = idoc.getElementById('font') as HTMLLinkElement | null;
    const href = googleFontHref(settings.font) ?? '';
    if (link && link.getAttribute('href') !== (href || null)) {
      if (href) link.setAttribute('href', href); else link.removeAttribute('href');
    }

    const before = idoc.getElementById('m-before');
    const legal = idoc.getElementById('m-legal');
    const cgv = idoc.getElementById('m-cgv');
    const addCgv = !!cgvHtml && !documentHasCgv(html, cgvText);
    const beforeHtml = coverEnabled ? '' : logoHtml;
    const write = (el: Element | null, content: string) => {
      if (!el || written.get(el) === content) return;
      el.innerHTML = content;
      written.set(el, content);
    };
    write(before, beforeHtml);
    write(legal, legalHtml);
    write(cgv, addCgv ? cgvHtml : '');
    write(qd, html);
    markLongDishes(idoc, LONG_DISH_PX);
    markSignature(idoc);

    // Origine : le haut de la zone utile de la page (la cellule qui porte le document). Le bandeau d'en-tête
    // remonte au-dessus (marge négative), comme sur la feuille imprimée.
    const origin = (qd.parentElement ?? qd).getBoundingClientRect().top;
    const { blocks, paths } = collectBlocks(qd, iwin, origin, PAGE_CONTENT_PX);
    const qdRect = qd.getBoundingClientRect();
    // Mentions légales : juste sous le document, sur sa dernière page si elles y tiennent.
    const legalBox = legal?.firstElementChild;
    if (legalBox) {
      const r = legalBox.getBoundingClientRect();
      const mt = parseFloat(iwin.getComputedStyle(legalBox).marginTop) || 0;
      if (r.height > 0) {
        blocks.push({ top: qdRect.bottom - origin + mt, height: r.height, unbreakable: true });
        paths.push([]);
      }
    }
    const firstUsed = before ? before.getBoundingClientRect().height : 0;
    const result = computePageBreaks(blocks, PAGE_CONTENT_PX, firstUsed);

    const cover = coverEnabled ? 1 : 0;
    const cgvPages = addCgv && cgv ? Math.max(1, Math.ceil((cgv.getBoundingClientRect().height - 1) / A4_PAGE_PX)) : 0;
    const totalPages = cover + result.pages + photoPages + cgvPages;

  return { blocks, paths, result, coverPages: cover, totalPages };
}
