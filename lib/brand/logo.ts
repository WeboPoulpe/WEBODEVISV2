// Le symbole de WeboDevis : un W fait de deux rubans plats. Le ruban crème passe sous le ruban terracotta ;
// une ombre marque chaque pli. Les hauts sont coupés net (crème à l'horizontale, terracotta en biais).
// Mêmes tracés pour l'interface (LogoMark) et pour les images générées (icônes, partage).

export const LOGO_VIEWBOX = { x: 108, y: 188, width: 258, height: 134 };
export const LOGO_STROKE = 38;
export const LOGO_CREAM = '#ECE3CF';
export const LOGO_FOREST = '#1C2621';
export const LOGO_TERRACOTTA = { front: '#D36A41', back: '#D0663D' };

export const LOGO_PARTS = {
  /** Clip du ruban crème : coupé à l'horizontale. */
  creamClip: { x: 0, y: 220, width: 400, height: 200 },
  /** Clip du ruban terracotta : coupé en biais, qui remonte vers la droite. */
  terraClip: '0,232 400,187 400,400 0,400',
  creamFold: 'M200 300 L238 248',
  creamFront: 'M120 195 L200 300',
  terraBack: 'M268 300 L344 186',
  terraFront: 'M200 166 L268 300',
  creamShadow: { x1: 204, y1: 296, x2: 236, y2: 252, opacity: 0.5 },
  terraShadow: { x1: 310, y1: 236, x2: 282, y2: 290, opacity: 0.22 },
};

export const LOGO_VIEWBOX_ATTR = `${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;

/** Le symbole en SVG autonome (icônes de l'app, image de partage). */
export function logoSvg(ribbon: string = LOGO_CREAM): string {
  const p = LOGO_PARTS;
  const { width, height } = LOGO_VIEWBOX;
  const shadow = (id: string, s: typeof p.creamShadow) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}">`
    + `<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${s.opacity}"/></linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX_ATTR}" width="${width * 2}" height="${height * 2}">`
    + '<defs>'
    + `<clipPath id="cc"><rect x="${p.creamClip.x}" y="${p.creamClip.y}" width="${p.creamClip.width}" height="${p.creamClip.height}"/></clipPath>`
    + `<clipPath id="ct"><polygon points="${p.terraClip}"/></clipPath>`
    + shadow('cf', p.creamShadow) + shadow('tf', p.terraShadow)
    + '</defs>'
    + `<g fill="none" stroke-width="${LOGO_STROKE}" stroke-linecap="round">`
    + `<g clip-path="url(#cc)"><path d="${p.creamFold}" stroke="${ribbon}"/><path d="${p.creamFold}" stroke="url(#cf)"/><path d="${p.creamFront}" stroke="${ribbon}"/></g>`
    + `<g clip-path="url(#ct)"><path d="${p.terraBack}" stroke="${LOGO_TERRACOTTA.back}"/><path d="${p.terraBack}" stroke="url(#tf)"/><path d="${p.terraFront}" stroke="${LOGO_TERRACOTTA.front}"/></g>`
    + '</g></svg>';
}

export function logoDataUri(ribbon?: string): string {
  return `data:image/svg+xml,${encodeURIComponent(logoSvg(ribbon))}`;
}
