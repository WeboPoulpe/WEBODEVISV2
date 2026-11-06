'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import SiteWebView from '@/components/siteWeb/SiteWebView';
import { getSiteWebPage, type SiteWebPage } from '@/server/siteWeb';

// Onglet « Site web » : les sites et logiciels Webomax (components/siteWeb/SiteWebView.tsx).
export default function SiteWebRoute() {
  const [page, setPage] = useState<SiteWebPage | null | undefined>(undefined);
  useEffect(() => { getSiteWebPage().then(setPage).catch(() => setPage(null)); }, []);

  if (page === undefined) return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (page === null) return <p className="px-6 py-10 text-gray-600">Cette page n’est pas disponible pour votre compte.</p>;
  return <SiteWebView page={page} />;
}
