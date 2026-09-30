// Réglages du site de présentation. Menu, pied de page, sitemap et pages partent d'ici.

export const SITE_URL = 'https://webodevis.fr';
export const SITE_NAME = 'WeboDevis';
export const SITE_TAGLINE = 'Le logiciel des traiteurs';

/** Image de partage commune à toutes les pages (générée par app/site/opengraph-image.tsx). */
export const OG_IMAGE = '/site/opengraph-image';

export const DEMO_HREF = '/demo';
export const LOGIN_HREF = '/login';
export const REGISTER_HREF = '/register';

/** Première version publique. */
export const RELEASE = {
  version: '0.1',
  /** Date ISO de sortie. */
  date: '2026-12-01',
  /** La même date, telle qu'on l'écrit dans une phrase. */
  dateLabel: '1er décembre 2026',
} as const;

/** Adresse absolue d'une page du site. */
export const absoluteUrl = (path: string) => (path === '/' ? SITE_URL + '/' : SITE_URL + path);
