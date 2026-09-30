import type { NextConfig } from 'next';

const config: NextConfig = {
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
    ],
  },
};

export default config;
