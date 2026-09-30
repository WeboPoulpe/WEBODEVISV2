import type { MetadataRoute } from 'next';

// Fiche d'identité de l'app installée sur l'écran d'accueil (téléphone, tablette, ordinateur).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WeboDevis',
    short_name: 'WeboDevis',
    description: 'Devis, événements et production pour les traiteurs',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#F3EEE6',
    theme_color: '#F3EEE6',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nouveau devis', url: '/devis/nouveau' },
      { name: 'Événements', url: '/evenements' },
      { name: 'Calendrier', url: '/calendrier' },
    ],
  };
}
