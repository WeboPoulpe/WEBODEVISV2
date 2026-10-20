// Envoi d'une erreur du navigateur au journal (/api/erreurs). Ne fait jamais planter l'appelant, et n'envoie
// qu'une fois le même message par chargement de page.

const sent = new Set<string>();

export function reportError(error: unknown, extra: { digest?: string } = {}): void {
  try {
    if (typeof window === 'undefined') return;
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erreur inconnue');
    const key = `${err.message}|${extra.digest ?? ''}`;
    if (sent.has(key) || sent.size > 20) return;
    sent.add(key);
    const body = JSON.stringify({ message: err.message, stack: err.stack?.slice(0, 8000), path: window.location.pathname, digest: extra.digest });
    fetch('/api/erreurs', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch {
    // Le journal ne doit jamais devenir une source d'erreur.
  }
}
