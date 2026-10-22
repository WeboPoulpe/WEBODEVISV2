// ═══════════════════════════════════════════════════════════════════════════
// Formules d'un devis : « Formule Prestige / Formule Tradition », au choix du client
// ═══════════════════════════════════════════════════════════════════════════
// Un devis peut proposer plusieurs formules (colonne `formulas` : [{ id, name, description }]). Chaque ligne
// rangée dans une formule porte son identifiant (`formula`) ; les lignes sans formule sont communes et
// s'ajoutent à toutes. Le client choisit sa formule en signant (ou le traiteur pour lui) : `chosen_formula_id`.
//
// effectiveLines est la seule règle : partout où les lignes comptent (totaux, factures, coûts, courses,
// production), on ne garde que les lignes communes et celles de la formule retenue. Tant que rien n'est
// choisi, c'est la première formule qui compte (montant de référence de la liste des devis, prévisions).
// Un devis sans formule garde toutes ses lignes : il fonctionne exactement comme avant.

export interface QuoteFormula {
  id: string;
  name: string;
  description?: string | null;
}

/** Au-delà, la page du client devient illisible. */
export const MAX_FORMULAS = 6;

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/** Formules lues en base (ou envoyées par l'éditeur), nettoyées : identifiants valables et uniques, noms remplis. */
export function parseFormulas(raw: unknown): QuoteFormula[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: QuoteFormula[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const { id, name, description } = f as Record<string, unknown>;
    if (typeof id !== 'string' || !ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
    const cleanDesc = typeof description === 'string' ? description.trim().slice(0, 300) : '';
    out.push({ id, name: cleanName || `Formule ${out.length + 1}`, ...(cleanDesc ? { description: cleanDesc } : {}) });
    if (out.length >= MAX_FORMULAS) break;
  }
  return out;
}

/** Nouvel identifiant de formule. */
export function newFormulaId(): string {
  return `f${Math.random().toString(36).slice(2, 10)}`;
}

/** La formule retenue, si elle existe encore dans le devis. */
export function chosenFormula(formulas: readonly QuoteFormula[], chosenId: string | null | undefined): QuoteFormula | null {
  return (chosenId && formulas.find((f) => f.id === chosenId)) || null;
}

/** Formule d'une ligne : son identifiant s'il désigne une formule du devis, sinon null (ligne commune). */
export function lineFormulaId(line: unknown, formulas: readonly QuoteFormula[]): string | null {
  const id = line && typeof line === 'object' ? (line as { formula?: unknown }).formula : undefined;
  return typeof id === 'string' && formulas.some((f) => f.id === id) ? id : null;
}

/**
 * Lignes qui comptent : les communes et celles de la formule retenue (à défaut, de la première).
 * Sans formule, les lignes telles quelles.
 */
export function effectiveLines<T>(
  lines: readonly T[],
  formulas: readonly QuoteFormula[],
  chosenId?: string | null,
): T[] {
  if (formulas.length === 0) return [...lines];
  const keep = (chosenFormula(formulas, chosenId) ?? formulas[0]).id;
  return lines.filter((l) => {
    const f = lineFormulaId(l, formulas);
    return f === null || f === keep;
  });
}

/** Ce qu'il faut d'un devis pour savoir quelles lignes comptent. */
export interface QuoteWithFormulas {
  services: unknown;
  /** Absent tant que la migration 0031 n'est pas appliquée. */
  formulas?: unknown;
  chosen_formula_id?: string | null;
}

/** Lignes d'un devis qui comptent (voir effectiveLines). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function quoteLines<T = any>(quote: QuoteWithFormulas): T[] {
  const lines = Array.isArray(quote.services) ? (quote.services as T[]) : [];
  return effectiveLines(lines, parseFormulas(quote.formulas), quote.chosen_formula_id);
}

/** Le devis propose des formules et aucune n'est encore retenue. */
export function formulaPending(quote: Pick<QuoteWithFormulas, 'formulas' | 'chosen_formula_id'>): boolean {
  const formulas = parseFormulas(quote.formulas);
  return formulas.length > 0 && !chosenFormula(formulas, quote.chosen_formula_id);
}

/**
 * Retire de `html` chaque élément dont la balise ouvrante est désignée par `drop`, avec tout son contenu.
 * Lecture du texte, sans DOM : sert aussi bien sur le serveur (page du client, page d'impression) que dans le
 * navigateur. Un élément dont la fin est introuvable est laissé tel quel.
 */
function removeElements(html: string, drop: (openTag: string) => boolean): string {
  const open = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let out = '';
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = open.exec(html))) {
    const tag = m[0];
    if (!drop(tag)) continue;
    let end = -1;
    if (tag.endsWith('/>')) end = m.index + tag.length;
    else {
      const same = new RegExp(`<(/?)${m[1]}(?![a-zA-Z0-9])[^>]*>`, 'gi');
      same.lastIndex = m.index + tag.length;
      let depth = 1;
      let t: RegExpExecArray | null;
      while ((t = same.exec(html))) {
        if (t[1]) { if (--depth === 0) { end = t.index + t[0].length; break; } } else if (!t[0].endsWith('/>')) depth++;
      }
    }
    if (end < 0) continue;
    out += html.slice(pos, m.index);
    pos = end;
    open.lastIndex = end;
  }
  return out + html.slice(pos);
}

/**
 * Le document d'un devis à formules une fois la formule retenue : les lignes, totaux et plats des autres
 * formules (repérés par data-webo-formula) et les mentions « à choisir » sont retirés. Un repère qui désigne une
 * formule supprimée depuis ne retire rien (ses lignes sont devenues communes), sauf le titre de cette formule
 * dans la carte. Sans formule retenue, ou pour un document sans ces repères, le document tel quel.
 */
export function documentForFormula(html: string, formulas: readonly QuoteFormula[], chosenId: string | null | undefined): string {
  const chosen = chosenFormula(formulas, chosenId);
  if (!chosen || !html || !html.includes('data-webo-formula')) return html;
  const known = new Set(formulas.map((f) => f.id));
  return removeElements(html, (tag) => {
    if (/\sdata-webo-formula-pending\b/i.test(tag)) return true;
    const id = /\sdata-webo-formula="([^"]*)"/i.exec(tag)?.[1];
    if (id == null || id === chosen.id) return false;
    return known.has(id) || /\sclass="[^"]*\bwebo-formula-title\b/i.test(tag);
  });
}
