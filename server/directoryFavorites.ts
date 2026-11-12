'use server';

// Favoris de l'annuaire « Choisir Mon Traiteur » : la liste des fiches gardées vit dans le navigateur du visiteur
// (localStorage) ; cette action rend leurs cartes. Lecture seule, sans session, rien n'est écrit. Ce fichier
// n'exporte que l'action : tout export est un point d'entrée public.

import { searchListings, type ListingCard } from './directoryPublic';

const MAX_FAVORITES = 30;
const SLUG = /^[a-z0-9-]{1,80}$/;

/** Cartes des fiches encore visibles, dans l'ordre de la liste reçue (au plus 30, slugs invalides ignorés). */
export async function favoriteListings(slugs: unknown): Promise<{ error: string | null; listings: ListingCard[] }> {
  if (!Array.isArray(slugs)) return { error: null, listings: [] };
  const wanted = [...new Set(slugs.filter((s): s is string => typeof s === 'string' && SLUG.test(s)))].slice(0, MAX_FAVORITES);
  if (!wanted.length) return { error: null, listings: [] };
  // Une seule lecture des fiches visibles (searchListings applique les règles de visibilité), puis le filtre.
  const bySlug = new Map((await searchListings({})).map((l) => [l.slug, l]));
  return { error: null, listings: wanted.map((s) => bySlug.get(s)).filter((l): l is ListingCard => !!l) };
}
