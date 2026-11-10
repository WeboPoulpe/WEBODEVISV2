'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Mesure d'audience du site, sans cookie (voir lib/siteStats.ts) : une page vue à chaque changement de page, et
// l'ouverture de la démo. Le site précédent (referrer) n'est envoyé qu'à l'arrivée sur le site.

function send(data: { path: string; referrer?: string; event?: 'view' | 'demo' }) {
  try {
    const body = JSON.stringify(data);
    if (!navigator.sendBeacon?.('/api/stats', body)) fetch('/api/stats', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // La mesure ne doit jamais gêner la visite.
  }
}

export default function SiteAnalytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    send({ path: pathname, referrer: first.current ? document.referrer : undefined });
    first.current = false;
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="/demo"]');
      if (link) send({ path: window.location.pathname, event: 'demo' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
