// Suite de page : où couper un contenu trop haut pour sa page. Le contenu est mesuré une fois (boîtes des lignes de
// texte, titres et blocs insécables) ; chaque page en montre ensuite une tranche. Fonction pure : les mesures
// viennent du navigateur (useFlowPages), en unités quelconques (centièmes de la largeur de page).

export interface FlowUnit {
  top: number;
  bottom: number;
  /** line : texte coupable entre deux lignes ; block : insécable (photo, cadre) ; heading : titre, jamais seul en bas. */
  kind: 'line' | 'block' | 'heading';
  lineHeight?: number;
}

const EPS = 0.5;

/** Débuts des pages, le premier à 0 ; `[0]` si tout tient. */
export function computeBreaks(units: FlowUnit[], pageHeight: number, total: number): number[] {
  const breaks = [0];
  if (pageHeight <= 0) return breaks;
  const sorted = [...units].sort((a, b) => a.top - b.top);
  const candidates = new Set<number>();
  for (const u of sorted) {
    candidates.add(u.top);
    candidates.add(u.bottom);
    if (u.kind === 'line' && u.lineHeight && u.lineHeight > 0) {
      for (let y = u.top + u.lineHeight; y < u.bottom - EPS; y += u.lineHeight) candidates.add(y);
    }
  }
  const valid = (b: number) => sorted.every((u, i) => {
    if (u.top < b - EPS && u.bottom > b + EPS) {
      if (u.kind !== 'line' || !u.lineHeight) return false;
      const k = (b - u.top) / u.lineHeight;
      return Math.abs(k - Math.round(k)) < 0.01;
    }
    // Titre au-dessus de la coupure, et rien d'autre entre lui et elle : le titre resterait seul.
    if (u.kind === 'heading' && u.bottom <= b + EPS) {
      const next = sorted[i + 1];
      return !next || next.top < b - EPS;
    }
    return true;
  });
  const list = [...candidates].sort((a, b) => a - b);
  let start = 0;
  while (total - start > pageHeight + EPS) {
    const limit = start + pageHeight;
    let best = -1;
    for (const c of list) {
      if (c <= start + EPS) continue;
      if (c > limit + EPS) break;
      if (valid(c)) best = c;
    }
    start = best > 0 ? best : limit;
    breaks.push(start);
  }
  return breaks;
}
