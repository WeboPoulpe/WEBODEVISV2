// Origine d'une visite venue d'un lien Instagram (webodevis.fr/ig, webodevis.fr/ig/<libellé>).
// Format : « instagram » (lien de la bio) ou « instagram:<libellé> » (une story, une opération). Tout le reste est
// ignoré. Côté navigateur, l'origine est gardée le temps de la visite dans sessionStorage (effacé à la fermeture de
// l'onglet) : pas de cookie. Voir docs/superpowers/specs/2026-11-17-origine-instagram-design.md.

export const ORIGIN_KEY = 'wd-origine';
const LABEL = /^[a-z0-9-]{1,30}$/;
const DEFAULT_DESTINATION = '/site';

/** L'origine si elle est au bon format, sinon null. */
export function parseOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw === 'instagram') return raw;
  const m = /^instagram:(.+)$/.exec(raw);
  return m && LABEL.test(m[1]) ? raw : null;
}

/** Origine d'un lien /ig/<libellé> ; un libellé absent ou invalide donne le lien de la bio. */
export function originFromPath(segments: string[] | undefined): string {
  const label = segments?.[0];
  return label && LABEL.test(label) ? `instagram:${label}` : 'instagram';
}

/** Destination d'un lien /ig : un chemin du site seulement (jamais une autre adresse), sinon la présentation. */
export function safeDestination(raw: string | null): string {
  if (!raw || raw.length > 200 || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return DEFAULT_DESTINATION;
  return raw;
}

/** « Instagram · bio », « Instagram · lancement ». */
export function originLabel(origin: string): string {
  const label = origin.startsWith('instagram:') ? origin.slice('instagram:'.length) : 'bio';
  return `Instagram · ${label}`;
}

export function readStoredOrigin(): string | null {
  try {
    return parseOrigin(sessionStorage.getItem(ORIGIN_KEY));
  } catch {
    return null;
  }
}

export function storeOrigin(origin: string): void {
  try {
    sessionStorage.setItem(ORIGIN_KEY, origin);
  } catch {
    // Stockage bloqué (navigation privée) : la visite continue sans origine.
  }
}
