// Estimation des fins de page d'un devis imprimé, à partir des blocs du document mesurés à la largeur d'une
// feuille A4 (voir components/devis/weboword/usePrintPages.ts). Calcul pur : aucune lecture de la page ici.
//
// Les règles reproduisent celles de la sortie papier (lib/quoteOutput.ts) :
//  • une page offre une hauteur utile fixe (297 mm moins les marges haute et basse) ;
//  • un saut forcé (saut de page de l'éditeur, carte, conditions de vente) commence une nouvelle page ;
//  • un bloc qu'on ne coupe pas (ligne de tableau, plat de la carte, bloc de signature…) passe entier à la page
//    suivante s'il ne tient pas dans la place restante, sauf s'il est plus haut qu'une page ;
//  • un paragraphe se coupe entre deux lignes, en gardant au moins deux lignes de chaque côté ;
//  • un bloc « à garder avec la suite » (nom d'un plat, texte avant la signature) part avec le bloc suivant.

export interface PageBlock {
  /** Haut du bloc, en pixels, dans le document mesuré (sans coupure de page). */
  top: number;
  /** Hauteur du bloc, en pixels. */
  height: number;
  /** Le bloc ne se coupe pas entre deux pages. */
  unbreakable?: boolean;
  /** Le bloc commence toujours une nouvelle page. */
  forceBreakBefore?: boolean;
  /** Le bloc ne doit pas rester seul en bas de page : il part avec le bloc suivant. */
  keepWithNext?: boolean;
  /** Hauteur d'une ligne de texte (px) : le bloc ne se coupe qu'entre deux lignes. */
  lineHeight?: number;
  /** En-tête de tableau répété en haut de la page suivante si la coupure tombe avant ce bloc (px). */
  repeatHeader?: number;
}

export interface PageEnd {
  /** Numéro de la page qui se termine (1 pour la première page du document). */
  page: number;
  /** Index du bloc où commence la page suivante. */
  blockIndex: number;
  /** Position de la coupure à l'intérieur de ce bloc, en pixels depuis son haut (0 : avant le bloc). */
  offsetInBlock: number;
  /** Part de la page occupée par du contenu, entre 0 et 1. */
  fill: number;
}

export interface PageBreakResult {
  /** Fins de page, dans l'ordre (la dernière page du document n'en a pas). */
  ends: PageEnd[];
  /** Nombre de pages du document. */
  pages: number;
  /** Part occupée de la dernière page, entre 0 et 1. */
  lastFill: number;
}

/** Une page est signalée « presque vide » en dessous de cette part de contenu. */
export const NEARLY_EMPTY_FILL = 0.15;

const EPS = 0.5;

/**
 * Calcule où tombent les fins de page.
 * @param blocks Blocs du document dans l'ordre de lecture.
 * @param pageHeight Hauteur utile d'une page (px).
 * @param firstPageUsed Place déjà prise en haut de la première page (logo imprimé au-dessus du document, px).
 */
export function computePageBreaks(blocks: PageBlock[], pageHeight: number, firstPageUsed = 0): PageBreakResult {
  const ends: PageEnd[] = [];
  if (!(pageHeight > 0)) return { ends, pages: 1, lastFill: 0 };

  // Les positions sont exprimées dans le document « imprimé » : position mesurée + décalage accumulé par les
  // blocs repoussés à la page suivante.
  let shift = 0;
  let pageStart = -Math.max(0, firstPageUsed);
  let pageBottom = pageStart; // bas du contenu posé sur la page en cours
  let hasContent = firstPageUsed > 0;
  let page = 1;

  const fillOf = (bottom: number, start: number) => Math.min(1, Math.max(0, (bottom - start) / pageHeight));

  const endPage = (blockIndex: number, offsetInBlock: number, nextStart: number) => {
    ends.push({ page, blockIndex, offsetInBlock, fill: fillOf(pageBottom, pageStart) });
    page += 1;
    pageStart = nextStart;
    pageBottom = nextStart;
    hasContent = false;
  };

  // Un bloc « à garder avec la suite » est fusionné avec le bloc suivant quand celui-ci ne se coupe pas.
  const merged: { block: PageBlock; index: number }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.keepWithNext && next && !next.forceBreakBefore && next.unbreakable) {
      const top = Math.min(b.top, next.top);
      const bottom = Math.max(b.top + b.height, next.top + next.height);
      merged.push({ block: { ...next, top, height: bottom - top, forceBreakBefore: b.forceBreakBefore, unbreakable: true, keepWithNext: next.keepWithNext }, index: i });
      i += 1;
    } else {
      merged.push({ block: b, index: i });
    }
  }

  for (const { block: b, index } of merged) {
    if (!(b.height >= 0)) continue;
    let y = b.top + shift;

    // Saut forcé : la page en cours s'arrête là, même à moitié vide.
    if (b.forceBreakBefore && hasContent) endPage(index, 0, y);

    let h = b.height;
    let consumed = 0; // part du bloc déjà placée sur les pages précédentes
    while (y + h > pageStart + pageHeight + EPS) {
      const pageEnd = pageStart + pageHeight;
      if (y >= pageEnd - EPS) {
        // Le bloc commence après la fin de la page (grande marge) : la marge disparaît à la coupure.
        if (hasContent) {
          const header = consumed === 0 ? (b.repeatHeader ?? 0) : 0;
          shift += pageEnd + header - y;
          endPage(index, consumed, pageEnd);
          pageBottom = pageEnd + header;
          hasContent = header > 0;
          y = pageEnd + header;
        } else { pageStart = y; pageBottom = y; }
        continue;
      }
      const room = pageEnd - y;
      const tooTall = h > pageHeight;

      if (b.unbreakable && !tooTall && hasContent) {
        // Bloc entier à la page suivante, puisqu'il y a déjà du contenu au-dessus de lui.
        const header = consumed === 0 ? (b.repeatHeader ?? 0) : 0;
        shift += pageEnd - y + header;
        endPage(index, consumed, pageEnd);
        pageBottom = pageEnd + header;
        hasContent = header > 0;
        y = pageEnd + header;
        continue;
      }

      // Coupure à l'intérieur du bloc, entre deux lignes si c'est du texte.
      let cut = Math.max(0, room);
      const lh = b.lineHeight && b.lineHeight > 0 ? b.lineHeight : 0;
      if (lh && !b.unbreakable) {
        const total = Math.max(1, Math.round(h / lh));
        let before = Math.floor(cut / lh + 0.01);
        if (total - before < 2) before = total - 2;
        if (before < 2) before = 0; // moins de deux lignes en bas de page : le paragraphe part entier
        cut = before * lh;
      }
      if (cut <= EPS && !hasContent) cut = room; // déjà en haut de page : on coupe où ça tombe

      pageBottom = Math.max(pageBottom, y + cut);
      if (cut > EPS) hasContent = true;
      shift += pageEnd - (y + cut);
      endPage(index, consumed + cut, pageEnd);
      consumed += cut;
      h -= cut;
      y = pageEnd;
    }

    if (h > 0) {
      pageBottom = Math.max(pageBottom, y + h);
      hasContent = true;
    }
  }

  return { ends, pages: page, lastFill: fillOf(pageBottom, pageStart) };
}
