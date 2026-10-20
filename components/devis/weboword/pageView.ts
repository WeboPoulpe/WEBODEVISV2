// Vue en pages de l'éditeur : la feuille continue est découpée en feuilles A4, comme sur le papier.
//
// Le contenu du devis n'est jamais modifié. Une feuille de style à part (élément <style> dans <head>) écarte
// l'élément qui commence chaque page : sa marge haute grandit du blanc laissé en bas de la page précédente,
// des marges basse et haute du papier et de l'espace entre deux feuilles. Pour une ligne de tableau (sans
// marge possible), c'est le haut de ses cellules qui grandit. Les bandes grises entre les feuilles sont
// dessinées par-dessus (PageSheets), aux positions renvoyées ici.

import { PRINT_GAP_MM, A4_PAGE_PX } from '@/lib/quoteOutput';

const MM_TO_PX = 96 / 25.4;
/** Marge haute et basse du papier, en pixels CSS. */
export const PAGE_MARGIN_PX = PRINT_GAP_MM * MM_TO_PX;
/** Espace entre deux feuilles à l'écran, en pixels CSS. */
export const SHEET_GAP_PX = 24;
/** Largeur de la feuille de l'éditeur (210 mm), en pixels CSS. */
export const SHEET_WIDTH_PX = 210 * MM_TO_PX;

export interface PageViewBreak {
  /** Chemin (index des enfants) de l'élément qui commence la page suivante ; null : rien à décaler (mentions légales). */
  path: number[] | null;
  /** Numéro, dans le document imprimé, de la page qui commence. */
  nextPage: number;
  /** La page qui se termine est presque vide. */
  nearlyEmpty: boolean;
}

export interface PageBand {
  /** Haut de la bande entre deux feuilles (bas de la feuille précédente), en pixels CSS de la feuille. */
  top: number;
  nextPage: number;
  nearlyEmpty: boolean;
}

export interface PageViewResult {
  bands: PageBand[];
  /** Hauteur totale des feuilles (la dernière fait au moins une page A4). */
  height: number;
}

export interface PageViewRule {
  path: number[];
  /** margin : marge haute de l'élément ; cells : haut des cellules d'une ligne de tableau. */
  kind: 'margin' | 'cells';
  px: number;
}

/** Sélecteur CSS d'un élément d'après son chemin sous la racine (index des enfants, à partir de 0). */
export function pathSelector(root: string, path: number[]): string {
  return [root, ...path.map((i) => `:nth-child(${i + 1})`)].join(' > ');
}

/** Feuille de style de la vue en pages (écran seulement : l'impression de la page n'en tient pas compte). */
export function pageViewCss(root: string, rules: PageViewRule[]): string {
  if (rules.length === 0) return '';
  const lines = rules.map((r) => {
    const sel = pathSelector(root, r.path);
    const px = `${Math.max(0, Math.round(r.px * 10) / 10)}px`;
    return r.kind === 'cells'
      ? `${sel} > td, ${sel} > th { padding-top: ${px} !important; }`
      : `${sel} { margin-top: ${px} !important; }`;
  });
  return `@media screen {\n${lines.join('\n')}\n}`;
}

function resolve(root: Element, path: number[]): Element | null {
  let el: Element | null = root;
  for (const i of path) {
    el = el?.children[i] ?? null;
    if (!el) return null;
  }
  return el;
}

/**
 * Applique la vue en pages à la feuille de l'éditeur et renvoie la place des bandes entre les feuilles.
 * @param editor Zone de texte de l'éditeur (racine des chemins).
 * @param sheet Feuille blanche qui l'entoure (origine des positions, affichée éventuellement avec un zoom).
 * @param style Élément <style> réservé à la vue en pages, hors du contenu.
 * @param root Sélecteur CSS de la zone de texte (ex. « #weboword-sheet »).
 */
export function applyPageView(editor: HTMLElement, sheet: HTMLElement, style: HTMLStyleElement, root: string, breaks: PageViewBreak[]): PageViewResult {
  // La page défilante garde sa position pendant que les marges sont reposées.
  let scroller: HTMLElement | null = sheet.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  const scrollTop = scroller?.scrollTop ?? 0;

  const rules: PageViewRule[] = [];
  const apply = () => { style.textContent = pageViewCss(root, rules); };
  apply();

  const sheetBox = () => {
    const r = sheet.getBoundingClientRect();
    return { top: r.top, scale: r.width > 0 ? r.width / SHEET_WIDTH_PX : 1 };
  };
  const topOf = (el: Element) => {
    const s = sheetBox();
    return (el.getBoundingClientRect().top - s.top) / s.scale;
  };
  const contentBottom = () => {
    const s = sheetBox();
    const padding = parseFloat(getComputedStyle(editor).paddingBottom) || 0;
    return (editor.getBoundingClientRect().bottom - s.top) / s.scale - padding;
  };

  const bands: PageBand[] = [];
  let sheetTop = 0;
  let previous: Element | null = null;
  for (const b of breaks) {
    const el = b.path ? resolve(editor, b.path) : null;
    // Un bloc plus haut qu'une page est coupé plusieurs fois : il n'est décalé qu'à sa première coupure.
    const again = !!el && el === previous;
    previous = el;
    const display = el ? getComputedStyle(el).display : '';
    const movable = !!el && !again && display !== 'inline' && display !== 'contents' && display !== 'none';
    // Fin du contenu de la page : là où commence l'élément suivant (ou la fin du texte).
    const start = movable ? topOf(el!) : again ? sheetTop : contentBottom();
    // La feuille fait une page A4, ou plus si le texte de l'éditeur, un peu plus haut qu'à l'impression, déborde.
    const bandTop = Math.max(sheetTop + A4_PAGE_PX, start + PAGE_MARGIN_PX);
    bands.push({ top: bandTop, nextPage: b.nextPage, nearlyEmpty: b.nearlyEmpty });
    sheetTop = bandTop + SHEET_GAP_PX;
    if (!movable || !b.path) continue;

    const target = sheetTop + PAGE_MARGIN_PX;
    if (el!.tagName === 'TR') {
      // Le haut de la ligne ne bouge pas : ses cellules s'agrandissent vers le haut.
      const cell = el!.querySelector(':scope > td, :scope > th');
      const base = cell ? parseFloat(getComputedStyle(cell).paddingTop) || 0 : 0;
      rules.push({ path: b.path, kind: 'cells', px: base + (target - start) });
      apply();
      continue;
    }
    // Marge haute : quelques passes, car elle peut se fondre avec celle de l'élément précédent.
    const rule: PageViewRule = { path: b.path, kind: 'margin', px: (parseFloat(getComputedStyle(el!).marginTop) || 0) + (target - start) };
    rules.push(rule);
    for (let pass = 0; pass < 3; pass++) {
      apply();
      const diff = target - topOf(el!);
      if (Math.abs(diff) < 0.5) break;
      rule.px += diff;
    }
  }

  const height = Math.max(sheetTop + A4_PAGE_PX, contentBottom() + PAGE_MARGIN_PX);
  if (scroller && scroller.scrollTop !== scrollTop) scroller.scrollTop = scrollTop;
  return { bands, height };
}
