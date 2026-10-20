'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/reportError';

// Remonte au journal d'erreurs ce qui plante dans le navigateur hors du rendu React (clics, chargements,
// promesses rejetées). Les erreurs de rendu passent par app/error.tsx et app/global-error.tsx.
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Erreurs de chargement d'une ressource (image, script d'extension) : pas des erreurs de l'application.
      if (!e.error && !e.message) return;
      if (/ResizeObserver loop|Script error\.?$/.test(e.message ?? '')) return;
      reportError(e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      // Requêtes interrompues (changement de page, perte de réseau) : sans intérêt.
      if (reason?.name === 'AbortError' || /Failed to fetch|NetworkError|Load failed/i.test(String(reason?.message ?? reason))) return;
      reportError(reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
