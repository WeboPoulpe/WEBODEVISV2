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

/**
 * Total TTC d'un devis, hors options : calculé depuis ses lignes (sans les lignes offertes, en option
 * ou retirées) au taux de TVA du devis, sinon le montant enregistré. Le même que la liste des devis.
 */
export function quoteTotalTTC(quote: {
  total_amount: number | string | null;
  vat_rate?: number | string | null;
  guest_count?: number | null;
  guest_count_adults?: number | null;
  guest_count_children?: number | null;
  services: unknown;
}): number | null {
  if (Array.isArray(quote.services) && quote.services.length > 0) {
    const { adults, children } = resolveGuestSplit(quote.guest_count, quote.guest_count_adults, quote.guest_count_children);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const services = quote.services as any[];
    const ht = services.reduce((sum, s) => {
      if (!s || s.removed || s.isFree || s.isOption || s.isPageBreak) return sum;
      return sum + lineTotalHT(s, adults, children);
    }, 0);
    const vat = quote.vat_rate == null || quote.vat_rate === '' ? 20 : Number(quote.vat_rate);
    if (ht > 0) return ht * (1 + (Number.isFinite(vat) ? vat : 20) / 100); // TTC au vrai taux de TVA du devis
  }
  return quote.total_amount == null ? null : Number(quote.total_amount);
}
