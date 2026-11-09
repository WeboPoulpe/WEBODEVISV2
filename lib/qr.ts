// QR code dessiné en SVG (brochures : élément QR du Studio, QR code d'un lien à télécharger). Sans dépendance au DOM.

import qrcode from 'qrcode-generator';

/** Les carrés noirs d'un QR code, en un chemin SVG, et sa taille (en modules). */
export function qrPath(value: string): { d: string; size: number } {
  const q = qrcode(0, 'M');
  q.addData(value);
  q.make();
  const size = q.getModuleCount();
  let d = '';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return { d, size };
}

/** Un QR code complet en SVG (avec sa marge blanche), à télécharger ou à imprimer. */
export function qrSvg(value: string, { color = '#1c2621', bg = '#ffffff', px = 1024 }: { color?: string; bg?: string | null; px?: number } = {}): string {
  const { d, size } = qrPath(value);
  const m = 4;
  const v = size + m * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${-m} ${-m} ${v} ${v}" shape-rendering="crispEdges">`
    + `${bg ? `<rect x="${-m}" y="${-m}" width="${v}" height="${v}" fill="${bg}"/>` : ''}<path d="${d}" fill="${color}"/></svg>`;
}
