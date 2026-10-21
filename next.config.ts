import type { NextConfig } from 'next';

// En-têtes de sécurité communs à toutes les pages. Pas de politique script-src : Next injecte des scripts
// en ligne, qui demanderaient des nonces ; on se limite à ce qui ne casse rien.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const config: NextConfig = {
  async headers() {
    return [
      // L'app ne s'affiche pas dans le cadre d'un autre site (protection contre le détournement de clic)…
      {
        source: '/((?!embed/).*)',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
        ],
      },
      // … sauf le formulaire de demande, fait pour être intégré au site du traiteur.
      {
        source: '/embed/:path*',
        headers: [
          ...SECURITY_HEADERS,
          { key: 'Content-Security-Policy', value: "frame-ancestors *; object-src 'none'; base-uri 'self'" },
        ],
      },
    ];
  },
  // Dossier de construction : un dossier à part permet de vérifier la construction de production
  // (NEXT_DIST_DIR=.next-build npx next build) sans toucher au serveur de développement en cours.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  // Polices des PDF (factures, contrats d'extra), lues sur le disque par les routes : à embarquer dans la fonction
  // Vercel. Les pages Extras et Événement envoient le contrat en PDF depuis une action serveur.
  outputFileTracingIncludes: {
    '/api/factures/[id]/pdf': ['./lib/facturx/fonts/*.ttf'],
    '/api/extras/contrat/[id]': ['./lib/facturx/fonts/*.ttf'],
    '/e/[token]/contrat/[id]/pdf': ['./lib/facturx/fonts/*.ttf'],
    '/extras': ['./lib/facturx/fonts/*.ttf'],
    '/evenements/[id]': ['./lib/facturx/fonts/*.ttf'],
  },
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
