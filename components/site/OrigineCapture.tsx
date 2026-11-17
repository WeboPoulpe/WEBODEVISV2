'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { captureOriginFromUrl, storeOrigin } from '@/lib/origine';

// Arrivée par un lien Instagram (app/ig) : l'adresse porte ?o=<origine>. On la garde le temps de la visite
// (sessionStorage, effacé à la fermeture de l'onglet, pas de cookie) et on la retire de l'adresse. Monté sur toutes
// les pages (app/layout.tsx), y compris la démo et l'inscription. N'envoie rien.

export default function OrigineCapture() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const { origin, cleaned } = captureOriginFromUrl(window.location.href);
      if (origin) storeOrigin(origin);
      if (cleaned !== null) window.history.replaceState(window.history.state, '', cleaned);
    } catch {
      // La capture ne doit jamais gêner la visite.
    }
  }, [pathname]);
  return null;
}
