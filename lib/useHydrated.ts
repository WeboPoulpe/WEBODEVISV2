import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * Faux au rendu serveur et à l'hydratation, vrai ensuite. Sert au HTML nettoyé : le serveur et le navigateur
 * n'utilisent pas le même moteur de nettoyage, il ne doit donc être inséré qu'une fois dans le navigateur.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
