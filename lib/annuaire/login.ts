// Connexion à WeboDevis d'un traiteur venu de Choisir Mon Traiteur : la page pour les traiteurs de l'annuaire envoie
// vers /login?source=annuaire. Après la connexion, il arrive sur « Ma fiche ». La destination est toujours un chemin
// fixe de l'application, jamais une adresse lue dans la requête.

export const DIRECTORY_LOGIN_SOURCE = 'annuaire';

type Param = string | string[] | undefined;

/** La connexion vient-elle de l'annuaire (`?source=annuaire`) ? */
export function fromDirectory(source: Param): boolean {
  return (Array.isArray(source) ? source[0] : source) === DIRECTORY_LOGIN_SOURCE;
}

/** Où va le traiteur une fois connecté : « Ma fiche » s'il vient de l'annuaire, sinon l'accueil de l'application. */
export function loginDestination(source: Param): '/' | '/ma-fiche' {
  return fromDirectory(source) ? '/ma-fiche' : '/';
}
