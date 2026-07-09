import { generateQuoteHtml, type QuoteHtmlData, type QuoteHtmlOptions } from './generateQuoteHtml';

// ═══════════════════════════════════════════════════════════════════════════
// Rafraîchissement du seul bloc financier (tableau des prestations + totaux)
// dans un content_html WeboWord déjà mis en forme — SANS régénérer le reste.
// ═══════════════════════════════════════════════════════════════════════════
// Utilisé quand on ajoute/modifie une prestation depuis le panneau : la nouvelle
// ligne apparaît dans le tableau et les totaux sont recalculés, mais la page de
// garde, la carte gastronomique et tout texte saisi manuellement sont préservés.
// Le bloc est repéré par l'attribut [data-webo-financials] posé par generateQuoteHtml.

/** Extrait le HTML du bloc [data-webo-financials] d'un document complet. */
function extractFinancials(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector('[data-webo-financials]')?.outerHTML ?? null;
}

/**
 * Remplace le bloc financier dans `existingHtml` par une version fraîche générée
 * depuis `data`. Retourne le HTML mis à jour, ou null si l'opération est impossible
 * (pas de DOM, bloc introuvable…) — l'appelant conserve alors le HTML tel quel.
 */
export function refreshFinancialsInHtml(
  existingHtml: string,
  data: QuoteHtmlData,
  opts: QuoteHtmlOptions = {},
): string | null {
  if (!existingHtml || typeof window === 'undefined' || typeof DOMParser === 'undefined') return null;

  const freshBlockHtml = extractFinancials(generateQuoteHtml(data, opts));
  if (!freshBlockHtml) return null;

  const doc = new DOMParser().parseFromString(existingHtml, 'text/html');
  // Construit le nœud frais DANS le même document (évite les soucis inter-documents).
  const tmp = doc.createElement('div');
  tmp.innerHTML = freshBlockHtml;
  const freshEl = tmp.firstElementChild;
  if (!freshEl) return null;

  const existing = doc.querySelector('[data-webo-financials]');
  if (existing) {
    existing.replaceWith(freshEl);
  } else {
    // Ancien document sans balise : on remplace la 1re table + son bloc de totaux.
    const table = doc.querySelector('table');
    if (!table) return null;
    const sib = table.nextElementSibling;
    if (sib && sib.tagName === 'DIV' && /Total/i.test(sib.textContent || '')) sib.remove();
    table.replaceWith(freshEl);
  }
  return doc.body.innerHTML;
}
