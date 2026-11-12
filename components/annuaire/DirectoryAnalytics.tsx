'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { DIRECTORY_PREFIX } from '@/lib/annuaire/config';

// Mesure d'audience de l'annuaire, sans cookie, par l'outil du site (/api/stats). Le chemin envoyé est toujours le
// chemin interne : « /annuaire » + l'adresse sur choisirmontraiteur.fr, l'adresse telle quelle sous /annuaire. Les
// vues d'une fiche sont donc rangées sous /annuaire/traiteur/<slug>, là où « Ma fiche » les compte.

function internalPath(browserPath: string): string {
  if (browserPath === DIRECTORY_PREFIX || browserPath.startsWith(`${DIRECTORY_PREFIX}/`)) return browserPath;
  return browserPath === '/' ? DIRECTORY_PREFIX : `${DIRECTORY_PREFIX}${browserPath}`;
}

export default function DirectoryAnalytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    try {
      const body = JSON.stringify({ path: internalPath(window.location.pathname), referrer: first.current ? document.referrer : undefined });
      if (!navigator.sendBeacon?.('/api/stats', body)) fetch('/api/stats', { method: 'POST', body, keepalive: true }).catch(() => {});
    } catch {
      // La mesure ne doit jamais gêner la visite.
    }
    first.current = false;
  }, [pathname]);

  return null;
}
