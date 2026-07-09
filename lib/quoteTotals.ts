// ═══════════════════════════════════════════════════════════════════════════
// Calcul du total d'une ligne de devis — source de vérité unique
// ═══════════════════════════════════════════════════════════════════════════
// Gère le tarif « au couvert » avec prix enfant distinct :
//   si la ligne porte un childUnitPrice ET que l'événement compte des enfants,
//   le total = adultes × prix + enfants × prix_enfant.
// Sinon : quantité × prix unitaire (comportement standard).
// Centralisé ici pour que l'éditeur, le PDF (generateQuoteHtml), la sauvegarde
// WeboWord et la liste des devis calculent tous la MÊME chose.

export interface PricedLine {
  quantity?: number;
  unitPrice?: number;
  /** Prix enfant « au couvert ». Si renseigné et enfants > 0 → tarif adultes/enfants. */
  childUnitPrice?: number | null;
}

/** Répartit le nombre de convives en adultes/enfants de façon robuste. */
export function resolveGuestSplit(
  guestCount?: number | null,
  adults?: number | null,
  children?: number | null,
): { adults: number; children: number } {
  const c = Math.max(0, children ?? 0);
  const a = adults != null ? Math.max(0, adults) : Math.max(0, (guestCount ?? 0) - c);
  return { adults: a, children: c };
}

/** Total HT d'une seule ligne, en tenant compte du prix enfant « au couvert ». */
export function lineTotalHT(line: PricedLine, adults = 0, children = 0): number {
  const unit = line.unitPrice ?? 0;
  if (line.childUnitPrice != null && children > 0) {
    return adults * unit + children * line.childUnitPrice;
  }
  return (line.quantity ?? 0) * unit;
}
