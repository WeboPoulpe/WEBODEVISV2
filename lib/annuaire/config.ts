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
