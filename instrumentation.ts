import type { Instrumentation } from 'next';

// Erreurs serveur (rendu des pages, routes, actions serveur) enregistrées dans le journal d'erreurs maison.
// L'import est placé dans le test de l'environnement : la version « edge » de ce fichier n'embarque pas la base.
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { recordError } = await import('./server/errorLog');
      const err = error as Error & { digest?: string };
      await recordError({
        source: 'serveur',
        message: err?.message ?? String(error),
        stack: err?.stack ?? null,
        path: request.path,
        digest: err?.digest ?? null,
        userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
      });
    } catch (e) {
      console.error('[erreurs] enregistrement impossible', e);
    }
  }
};
