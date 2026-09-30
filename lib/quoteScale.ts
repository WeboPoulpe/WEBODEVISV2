// Adapter les quantités d'un devis (ou d'un modèle) à un autre nombre de couverts.
// Seules les lignes qui suivaient le nombre de couverts changent ; forfaits et quantités fixes restent.

type Line = { quantity?: number | string | null; isPageBreak?: boolean } & Record<string, unknown>;

/**
 * Nombre de couverts d'origine quand il n'est pas connu (modèle) : la quantité supérieure à 1 la plus fréquente,
 * si elle revient au moins deux fois ou sur la seule ligne chiffrée.
 */
export function guessGuestCount(lines: Line[]): number | null {
  const counts = new Map<number, number>();
  for (const l of lines) {
    if (l.isPageBreak) continue;
    const q = Number(l.quantity);
    if (Number.isInteger(q) && q > 1) counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (!best) return null;
  return best[1] >= 2 || counts.size === 1 ? best[0] : null;
}

/** Lignes dont la quantité valait `from` passées à `to` ; les autres inchangées. */
export function scaleToGuests<T extends Line>(lines: T[], to: number, from?: number | null): T[] {
  const origin = from ?? guessGuestCount(lines);
  if (!origin || !to || origin === to) return lines;
  return lines.map((l) => (!l.isPageBreak && Number(l.quantity) === origin ? { ...l, quantity: to } : l));
}
