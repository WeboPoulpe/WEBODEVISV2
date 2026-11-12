// Réglages de l'annuaire public « Choisir Mon Traiteur ».
export const DIRECTORY_NAME = 'Choisir Mon Traiteur';
export const DIRECTORY_URL = 'https://choisirmontraiteur.fr';
export const DIRECTORY_PREFIX = '/annuaire';
// Nombre maximal de photos par fiche.
export const MAX_PHOTOS = 20;
// Demandes qu'un même visiteur peut envoyer par heure.
export const REQUESTS_PER_HOUR = 5;

// Adresse complète d'une page de l'annuaire (`path` commence par « / »).
export function directoryUrl(path: string): string {
  return `${DIRECTORY_URL}${path}`;
}

/** Adresse publique d'une fiche : sur l'hôte de l'annuaire quand il est branché (DIRECTORY_HOST), sinon le chemin relatif
 *  sous /annuaire, qui marche en local, sur un aperçu et avant le branchement du domaine. */
export function listingPublicUrl(slug: string, directoryHost: string | undefined): string {
  const host = (directoryHost ?? '').trim();
  return host ? `https://${host}/traiteur/${slug}` : `${DIRECTORY_PREFIX}/traiteur/${slug}`;
}
