'use client';

import { useEffect } from 'react';
import Wordmark from '@/components/brand/Wordmark';
import { reportError } from '@/lib/reportError';

// Affichée quand une page plante au rendu, à la place de l'écran d'erreur brut de Next.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page]', error.digest ?? '', error);
    // Une erreur venue du serveur (avec un code) est déjà dans le journal ; celle du navigateur y est envoyée.
    if (!error.digest) reportError(error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-page flex flex-col items-center justify-center px-6 text-center">
      <Wordmark className="text-[26px] text-gray-900" />
      <h1 className="text-[28px] font-bold text-gray-900 leading-tight mt-10">Cette page n’a pas pu s’afficher</h1>
      <p className="text-base text-gray-600 mt-2 max-w-[40ch]">
        Vos données ne sont pas touchées. Réessayez ; si le problème continue, écrivez-nous en donnant ce code :{' '}
        <span className="font-mono text-sm text-gray-900">{error.digest ?? 'sans code'}</span>.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button onClick={reset} className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-primary text-white text-[15px] font-semibold">
          Réessayer
        </button>
        <a href="/" className="inline-flex items-center justify-center h-12 px-6 rounded-xl border border-gray-300 text-gray-800 text-[15px] font-semibold">
          Revenir à l’accueil
        </a>
      </div>
    </div>
  );
}
