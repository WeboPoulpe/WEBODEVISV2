import type { Metadata } from 'next';
import { DIRECTORY_NAME } from './config';

// Métadonnées d'une page de l'annuaire. Les chemins sont ceux de l'adresse publique (sans /annuaire) : le layout de
// l'annuaire pose metadataBase sur https://choisirmontraiteur.fr, l'adresse canonique est donc toujours celle-là.

export const DIRECTORY_SHARE_IMAGE = { url: '/annuaire/logo-choisir-mon-traiteur.png', width: 2172, height: 724, alt: DIRECTORY_NAME };

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

export function directoryMetadata({ title, description, path, noindex = false, image }: DirectoryPageMeta): Metadata {
  const images = image ? [{ url: image, alt: title }] : [DIRECTORY_SHARE_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: DIRECTORY_NAME, locale: 'fr_FR', type: 'website', images },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: images.map((i) => i.url) },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
