'use client';

import { useEffect } from 'react';
import { DIRECTORY_PREFIX, DIRECTORY_URL } from '@/lib/annuaire/config';

// Active le service worker (installation de l'app, page hors ligne).
// Les navigateurs ne l'autorisent qu'en HTTPS ou sur localhost ; ailleurs, l'app fonctionne sans.
// Pas sur l'annuaire « Choisir Mon Traiteur » (son hôte, ou /annuaire en local) : ce n'est pas l'app.
const DIRECTORY_HOSTNAME = new URL(DIRECTORY_URL).hostname;

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const { hostname, pathname } = window.location;
    if (hostname.replace(/^www\./, '') === DIRECTORY_HOSTNAME) return;
    if (pathname === DIRECTORY_PREFIX || pathname.startsWith(`${DIRECTORY_PREFIX}/`)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Sans service worker l'app reste utilisable : rien à signaler à l'utilisateur.
    });
  }, []);
  return null;
}
