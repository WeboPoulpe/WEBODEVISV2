import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site/config';

// Le site de présentation est ouvert aux moteurs de recherche ; l'application ne l'est pas.
// /site n'est pas interdit : c'est l'accueil (adresse canonique « / ») et l'image de partage s'y trouve.
// La liste reprend les routes de app/(app)/ et les pages à jeton (devis client, mission, formulaire).
const APP_ROUTES = [
  '/api/',
  '/admin',
  '/login',
  '/register',
  '/reset-password',
  '/demo',
  '/hors-ligne',
  // Écrans de l'application
  '/devis',
  '/clients',
  '/prospects',
  '/evenements',
  '/calendrier',
  '/commandes',
  '/courses-globales',
  '/extras',
  '/fournisseurs',
  '/ingredients',
  '/location-globale',
  '/location-templates',
  '/modeles',
  '/notifications',
  '/parametres',
  '/prestations',
  '/stock',
  // Pages ouvertes par un lien personnel
  '/d/',
  '/p/',
  '/e/',
  '/embed',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: APP_ROUTES }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
