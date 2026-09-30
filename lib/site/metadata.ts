import type { Metadata } from 'next';
import { OG_IMAGE, SITE_NAME, SITE_URL } from './config';

/** Métadonnées communes à tout le site : posées dans le layout de chaque dossier de pages. */
export const siteMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
};

interface PageMeta {
  title: string;
  description: string;
  /** Chemin de la page, tel qu'il s'affiche dans la barre d'adresse (« / » pour l'accueil). */
  path: string;
  type?: 'website' | 'article';
  publishedTime?: string;
}

/** Title, description, adresse canonique et cartes de partage d'une page. */
export function pageMetadata({ title, description, path, type = 'website', publishedTime }: PageMeta): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: 'fr_FR',
      type,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'WeboDevis, le logiciel des traiteurs.' }],
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE] },
  };
}
