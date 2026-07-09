import { generateQuoteHtml, type QuoteHtmlData, type QuoteHtmlOptions } from './generateQuoteHtml';

// ═══════════════════════════════════════════════════════════════════════════
// Mise à jour ciblée d'un content_html WeboWord déjà mis en forme, SANS tout
// régénérer :
//   1) le bloc financier (tableau des prestations + totaux) est remplacé par sa
//      version fraîche (repéré par [data-webo-financials]) ;
//   2) le bloc TEXTE des prestations nouvellement ajoutées est ajouté à la fin de
//      la carte gastronomique (conteneur .gastro-menu).
// Tout le reste (page de garde, textes existants, prose manuelle) est préservé.
// ═══════════════════════════════════════════════════════════════════════════

export interface WeboSyncInput {
  /** Toutes les prestations (sert à régénérer le tableau + totaux). */
  all: QuoteHtmlData;
  /** Prestations nouvellement ajoutées (leur bloc texte est ajouté page 2). */
  added?: QuoteHtmlData['services'];
}

/** Extrait le outerHTML du 1er élément correspondant au sélecteur. */
function pick(html: string, selector: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector(selector)?.outerHTML ?? null;
}

/** Extrait le innerHTML du 1er élément correspondant au sélecteur. */
function pickInner(html: string, selector: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector(selector);
  return el ? el.innerHTML : null;
}

export function syncWeboDocument(
  existingHtml: string,
  input: WeboSyncInput,
  opts: QuoteHtmlOptions = {},
): string | null {
  if (!existingHtml || typeof window === 'undefined' || typeof DOMParser === 'undefined') return null;

  const doc = new DOMParser().parseFromString(existingHtml, 'text/html');
  let changed = false;

  // ── 1) Bloc financier (tableau + totaux) ────────────────────────────────────
  const freshFinancials = pick(generateQuoteHtml(input.all, opts), '[data-webo-financials]');
  if (freshFinancials) {
    const tmp = doc.createElement('div');
    tmp.innerHTML = freshFinancials;
    const freshEl = tmp.firstElementChild;
    if (freshEl) {
      const existing = doc.querySelector('[data-webo-financials]');
      if (existing) {
        existing.replaceWith(freshEl);
        changed = true;
      } else {
        // Ancien document sans balise : remplace la 1re table + son bloc de totaux.
        const table = doc.querySelector('table');
        if (table) {
          const sib = table.nextElementSibling;
          if (sib && sib.tagName === 'DIV' && /Total/i.test(sib.textContent || '')) sib.remove();
          table.replaceWith(freshEl);
          changed = true;
        }
      }
    }
  }

  // ── 2) Bloc texte des prestations ajoutées → fin de la carte gastronomique ──
  const added = (input.added ?? []).filter((s) => s.name && s.name.trim());
  if (added.length > 0) {
    const menu = doc.querySelector('.gastro-menu');
    if (menu) {
      // Génère uniquement les blocs texte des nouvelles prestations.
      const addedItems = pickInner(
        generateQuoteHtml({ ...input.all, services: added }, opts),
        '.gastro-menu',
      );
      if (addedItems) {
        // Retire un éventuel placeholder « menu à compléter » avant d'ajouter.
        if (menu.children.length === 1 && /menu/i.test(menu.textContent || '') && !menu.querySelector('div')) {
          menu.innerHTML = '';
        }
        const holder = doc.createElement('div');
        holder.innerHTML = addedItems;
        while (holder.firstChild) menu.appendChild(holder.firstChild);
        changed = true;
      }
    }
  }

  return changed ? doc.body.innerHTML : null;
}
