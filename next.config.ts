import type { NextConfig } from 'next';

const config: NextConfig = {
  // Dossier de construction : un dossier à part permet de vérifier la construction de production
  // (NEXT_DIST_DIR=.next-build npx next build) sans toucher au serveur de développement en cours.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  // Test sur téléphone en développement : adresses du réseau local autorisées à charger l'app.
  allowedDevOrigins: ['192.168.1.*'],
  images: {
    remotePatterns: [
      {
        // Fichiers encore hébergés sur Supabase (à retirer après la copie vers Vercel Blob).
        protocol: 'https',
        hostname: 'cxtwwqthczohsztzecjd.supabase.co',
      },
      {
        // Fichiers des utilisateurs sur Vercel Blob.
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default config;
