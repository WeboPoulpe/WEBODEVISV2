'use client';

import { useEffect } from 'react';

// Active le service worker (installation de l'app, page hors ligne).
// Les navigateurs ne l'autorisent qu'en HTTPS ou sur localhost ; ailleurs, l'app fonctionne sans.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Sans service worker l'app reste utilisable : rien à signaler à l'utilisateur.
    });
  }, []);
  return null;
}
