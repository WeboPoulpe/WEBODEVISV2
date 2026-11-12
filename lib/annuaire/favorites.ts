// Favoris de l'annuaire, gardés dans le navigateur du visiteur (aucun compte, aucun cookie). Toute lecture ou écriture
// passe par un try/catch : stockage bloqué, navigation privée ou valeur abîmée ne doivent rien casser.

export const FAVORITES_KEY = 'cmt:favoris';
export const MAX_FAVORITES = 30;
const SLUG = /^[a-z0-9-]{1,80}$/;
/** Événement envoyé sur window quand la liste change (plusieurs boutons sur la même page). */
export const FAVORITES_EVENT = 'cmt:favoris';

export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((s): s is string => typeof s === 'string' && SLUG.test(s)))].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export function readFavorites(): string[] {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
  } catch {
    return [];
  }
}

export function writeFavorites(slugs: string[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(slugs.slice(0, MAX_FAVORITES)));
  } catch {
    // Stockage indisponible : le favori vaut pour cette page seulement.
  }
  try {
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  } catch {
    // Rien à prévenir.
  }
}

/** Ajoute (en tête) ou retire une fiche ; rend la nouvelle liste. */
export function toggleFavorite(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list].slice(0, MAX_FAVORITES);
}
