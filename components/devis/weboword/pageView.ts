// Vue en pages de l'éditeur : la feuille continue est découpée en feuilles A4, exactement comme le papier.
//
// La feuille de l'éditeur a la mise en page de la sortie papier (quoteEditorCss). Il reste à faire commencer
// chaque page sur sa propre feuille : une feuille de style à part (élément <style> dans <head>, hors du contenu)
// écarte l'élément qui ouvre chaque page, pour le poser à la même hauteur que sur le papier (marge haute de la
// page). Pour une ligne de tableau, sans marge possible, ce sont ses cellules qui grandissent vers le haut. Le
// contenu du devis n'est jamais modifié. Les bandes entre les feuilles sont dessinées par-dessus (PageSheets).

import { PRINT_GAP_MM, A4_PAGE_PX, PAGE_CONTENT_PX } from '@/lib/quoteOutput';
import { NEARLY_EMPTY_FILL } from '@/lib/pageBreaks';
import { resolvePath, type MeasureResult } from './printMeasure';

const MM_TO_PX = 96 / 25.4;
/** Marge haute et basse du papier, en pixels CSS. */
export const PAGE_MARGIN_PX = PRINT_GAP_MM * MM_TO_PX;
/** Espace entre deux feuilles à l'écran, en pixels CSS. */
export const SHEET_GAP_PX = 24;
/** Largeur de la feuille de l'éditeur (210 mm), en pixels CSS. */
export const SHEET_WIDTH_PX = 210 * MM_TO_PX;

export interface PageViewBreak {
  /** Élément qui commence la page suivante (null : on ne sait pas le retrouver). */
  el: Element | null;
  /** Sélecteur CSS de cet élément, pour la feuille de style de la vue en pages. */
  selector: string | null;
  /** Hauteur de l'élément sous le haut de la feuille, sur le papier (marge haute de la page, ou 0). */
  topGap: number;
  /** Numéro, dans le document imprimé, de la page qui commence. */
  nextPage: number;
  /** La page qui se termine est presque vide. */
  nearlyEmpty: boolean;
  /** Coupure à l'intérieur de l'élément (px depuis son haut) : bloc plus haut qu'une page, coupé sur le papier. */
  cutOffset?: number;
}

export interface PageBand {
  /** Haut de la bande entre deux feuilles (bas de la feuille précédente), en pixels CSS de la feuille. */
  top: number;
  nextPage: number;
  nearlyEmpty: boolean;
  /** Bloc trop long coupé à cet endroit : pas de bande, un simple repère. */
  cut?: boolean;
}

export interface PageViewResult {
  bands: PageBand[];
  /** Hauteur totale des feuilles (la dernière fait une page A4 entière). */
  height: number;
}

export interface PageViewRule {
  selector: string;
  /** margin : marge haute de l'élément ; cells : haut des cellules d'une ligne de tableau. */
  kind: 'margin' | 'cells';
  px: number;
}

/** Sélecteur CSS d'un élément d'après son chemin sous la racine (index des enfants, à partir de 0). */
export function pathSelector(root: string, path: number[]): string {
  return [root, ...path.map((i) => `:nth-child(${i + 1})`)].join(' > ');
}

/** Feuille de style de la vue en pages (écran seulement : l'impression de la page n'en tient pas compte). */
export function pageViewCss(rules: PageViewRule[]): string {
  if (rules.length === 0) return '';
  const lines = rules.map((r) => {
    const px = `${Math.max(0, Math.round(r.px * 100) / 100)}px`;
    return r.kind === 'cells'
      ? `${r.selector} > td, ${r.selector} > th { padding-top: ${px} !important; }`
      : `${r.selector} { margin-top: ${px} !important; }`;
  });
  return `@media screen {\n${lines.join('\n')}\n}`;
}

/**
 * Applique la vue en pages et renvoie la place des bandes entre les feuilles.
 * @param sheet Feuille blanche (origine des positions, affichée éventuellement avec un zoom).
 * @param style Élément <style> réservé à la vue en pages, hors du contenu.
 * @param contentEnd Bas du contenu imprimé dans la feuille (px CSS), lu après la pose des marges.
 */
export function applyPageView(sheet: HTMLElement, style: HTMLStyleElement, breaks: PageViewBreak[], contentEnd: () => number): PageViewResult {
  // La page défilante garde sa position pendant que les marges sont reposées.
  let scroller: HTMLElement | null = sheet.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  const scrollTop = scroller?.scrollTop ?? 0;

  const rules: PageViewRule[] = [];
  const apply = () => { style.textContent = pageViewCss(rules); };
  apply();

  const scale = () => {
    const w = sheet.getBoundingClientRect().width;
    return w > 0 ? w / SHEET_WIDTH_PX : 1;
  };
  const topOf = (el: Element) => (el.getBoundingClientRect().top - sheet.getBoundingClientRect().top) / scale();

  const bands: PageBand[] = [];
  let sheetTop = 0;
  for (const b of breaks) {
    const el = b.el;
    const display = el ? getComputedStyle(el).display : '';
    const movable = !!el && !!b.selector && display !== 'inline' && display !== 'contents' && display !== 'none';

    if (el && b.cutOffset !== undefined) {
      // Bloc plus haut qu'une page : le papier le coupe ; l'écran le laisse d'un tenant et marque la coupure.
      const cut = topOf(el) + b.cutOffset;
      bands.push({ top: cut, nextPage: b.nextPage, nearlyEmpty: b.nearlyEmpty, cut: true });
      sheetTop = cut - b.topGap;
      continue;
    }

    const start = movable ? topOf(el!) : contentEnd();
    // Une feuille fait une page A4 ; elle ne s'allonge que si le texte déborde (ce qui ne devrait pas arriver).
    const bandTop = Math.max(sheetTop + A4_PAGE_PX, start + (movable ? 0 : PAGE_MARGIN_PX));
    bands.push({ top: bandTop, nextPage: b.nextPage, nearlyEmpty: b.nearlyEmpty });
    sheetTop = bandTop + SHEET_GAP_PX;
    if (!movable) continue;

    const target = sheetTop + b.topGap;
    if (el!.tagName === 'TR') {
      // Le haut de la ligne ne bouge pas : ses cellules s'agrandissent vers le haut.
      const cell = el!.querySelector(':scope > td, :scope > th');
      const base = cell ? parseFloat(getComputedStyle(cell).paddingTop) || 0 : 0;
      rules.push({ selector: b.selector!, kind: 'cells', px: base + (target - start) });
      apply();
      continue;
    }
    // Marge haute : quelques passes, car elle peut se fondre avec celle de l'élément précédent.
    const rule: PageViewRule = { selector: b.selector!, kind: 'margin', px: (parseFloat(getComputedStyle(el!).marginTop) || 0) + (target - start) };
    rules.push(rule);
    for (let pass = 0; pass < 4; pass++) {
      apply();
      const diff = target - topOf(el!);
      if (Math.abs(diff) < 0.25) break;
      rule.px += diff;
    }
  }

  const height = Math.max(sheetTop + A4_PAGE_PX, contentEnd());
  if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
  return { bands, height };
}

/** Sélecteur des mentions légales affichées sous le texte, dans la feuille. */
export const LEGAL_SELECTOR = '[data-weboword-legal]';

/**
 * Vue en pages d'après la mesure du papier (measurePrintPages) : retrouve dans la feuille l'élément qui commence
 * chaque page et l'y place.
 * @param editor Zone de texte (racine des chemins mesurés), de sélecteur `editorSelector`.
 */
export function layoutPages(measured: MeasureResult, editor: HTMLElement, editorSelector: string, sheet: HTMLElement, style: HTMLStyleElement): PageViewResult {
  const legal = sheet.querySelector(LEGAL_SELECTOR);
  const breaks: PageViewBreak[] = measured.result.ends.map((end) => {
    const path = measured.paths[end.blockIndex];
    const block = measured.blocks[end.blockIndex];
    const isLegal = !!path && path.length === 0;
    const el = isLegal ? legal : path ? resolvePath(editor, path) : null;
    const tooLong = !!block && block.height > PAGE_CONTENT_PX + 0.5;
    return {
      el,
      selector: isLegal ? LEGAL_SELECTOR : path ? pathSelector(editorSelector, path) : null,
      // Les mentions légales sont hors du document : sur une nouvelle page, elles commencent en haut de la feuille.
      // Après un saut forcé, la marge haute de l'élément est gardée.
      topGap: isLegal ? 0 : PAGE_MARGIN_PX + (block?.forceBreakBefore ? block.forcedMargin ?? 0 : 0),
      nextPage: end.page + 1 + measured.coverPages,
      nearlyEmpty: end.fill < NEARLY_EMPTY_FILL,
      cutOffset: end.offsetInBlock > 0 && tooLong ? end.offsetInBlock : undefined,
    };
  });
  const contentEnd = () => {
    const last = legal ?? editor;
    const r = sheet.getBoundingClientRect();
    const scale = r.width > 0 ? r.width / SHEET_WIDTH_PX : 1;
    return (last.getBoundingClientRect().bottom - r.top) / scale;
  };
  return applyPageView(sheet, style, breaks, contentEnd);
}
