import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cxtwwqthczohsztzecjd.supabase.co',
      },
    ],
  },
};

export default config;
