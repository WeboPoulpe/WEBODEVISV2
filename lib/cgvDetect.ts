// Repérage des conditions générales de vente déjà présentes dans le texte d'un devis, pour ne pas les imprimer
// deux fois. Fonctionne sur une chaîne HTML (serveur comme navigateur), sans DOM.

const BLOCK_TAGS = /<\/?(?:p|div|h[1-6]|li|ul|ol|br|hr|td|th|tr|table|thead|tbody|tfoot|section|article|header|footer|blockquote|figure|figcaption)\b[^>]*>/gi;

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘',
  eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', ecirc: 'ê', Ecirc: 'Ê', agrave: 'à', Agrave: 'À',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

/** Texte sans accents, en minuscules, espaces resserrés. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Les blocs de texte du document (un paragraphe, un titre, une cellule…), normalisés. */
function textBlocks(html: string): string[] {
  const withoutStyles = html.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  return withoutStyles
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((t) => normalizeText(decodeEntities(t)))
    .filter(Boolean);
}

// Un titre « Conditions Générales de Vente », éventuellement numéroté (« 5. », « Article 1 - ») ou suivi de « (CGV) ».
const CGV_TITLE = /^(?:(?:article\s*)?\d+\s*[-–.:)]?\s*)?conditions generales de vente(?:\s*\(cgv\))?\s*[:.]?$/;

/**
 * Le texte contient-il un titre « Conditions Générales de Vente » (insensible à la casse et aux accents) ?
 * Une simple mention dans une phrase (« … nos conditions générales de vente. ») ne compte pas.
 */
export function hasCgvTitle(html: string | null | undefined): boolean {
  if (!html) return false;
  return textBlocks(html).some((t) => CGV_TITLE.test(t));
}

/** Les conditions de vente sont-elles déjà dans le document (bloc ajouté, texte collé ou titre tapé à la main) ? */
export function documentHasCgv(html: string | null | undefined, cgv?: string | null): boolean {
  if (!html) return false;
  return html.includes('data-webo-cgv') || (!!cgv && html.includes(cgv)) || hasCgvTitle(html);
}
