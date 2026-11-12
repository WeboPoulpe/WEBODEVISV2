import type { Metadata } from 'next';
import { DIRECTORY_NAME } from './config';

// Métadonnées d'une page de l'annuaire. Les chemins sont ceux de l'adresse publique (sans /annuaire) : le layout de
// l'annuaire pose metadataBase sur https://choisirmontraiteur.fr, l'adresse canonique est donc toujours celle-là.

// Image de partage par défaut : une photo de l'accueil (le logo, sur fond transparent, rendrait mal en aperçu).
export const DIRECTORY_SHARE_IMAGE = { url: '/annuaire/accueil/table-mariage.webp', width: 1200, height: 900, alt: `${DIRECTORY_NAME} : une table de mariage dressée` };

interface DirectoryPageMeta {
  title: string;
  description: string;
  /** Chemin public de la page (« / » pour l'accueil). */
  path: string;
  /** Page à ne pas indexer (recherche filtrée, département vide, favoris). */
  noindex?: boolean;
  /** Image de partage propre à la page (photo de couverture d'une fiche). */
  image?: string | null;
}

/** Consigne aux moteurs de recherche. Tant que l'annuaire n'a pas son propre domaine (DIRECTORY_HOST absent : local,
 *  aperçu, ou webodevis.fr avant le branchement), aucune page n'est indexée ni suivie ; sinon seules les pages marquées
 *  `noindex` sont écartées (leurs liens restent suivis). */
export function directoryRobots(noindex: boolean, directoryHost: string | undefined): Metadata['robots'] | undefined {
  if (!(directoryHost ?? '').trim()) return { index: false, follow: false };
  return noindex ? { index: false, follow: true } : undefined;
}

export function directoryMetadata({ title, description, path, noindex = false, image }: DirectoryPageMeta): Metadata {
  const images = image ? [{ url: image, alt: title }] : [DIRECTORY_SHARE_IMAGE];
  const robots = directoryRobots(noindex, process.env.DIRECTORY_HOST);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: DIRECTORY_NAME, locale: 'fr_FR', type: 'website', images },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: images.map((i) => i.url) },
    ...(robots ? { robots } : {}),
  };
}
