import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.webodevis.app',
  appName: 'WeboDevis',
  webDir: 'out',
  server: {
    // In dev, point to the running Next.js server
    // Remove this block for production (uses the built static files in /out)
    androidScheme: 'https',
    url: 'http://localhost:3001',
    cleartext: true,
  },
};

export default config;
