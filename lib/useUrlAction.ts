'use client';

import { useEffect, useRef } from 'react';

// Actions rapides venues d'ailleurs (mégamenu de la barre latérale) : « /devis?action=importer » ouvre la
// fenêtre d'import une fois la page prête. Si la page est déjà ouverte, le menu envoie l'événement
// NAV_ACTION_EVENT au lieu de recharger l'adresse. Le paramètre est retiré de l'adresse après usage,
// pour qu'un rafraîchissement ne rouvre pas la fenêtre.

export const NAV_ACTION_EVENT = 'nav:action';

export interface NavActionDetail {
  path: string;
  action: string;
}

/**
 * @param handlers une fonction par nom d'action (paramètre `action` de l'adresse)
 * @param ready faux tant que la page charge : l'action attend que ses données soient là
 */
export function useUrlAction(handlers: Record<string, () => void>, ready = true) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const action = url.searchParams.get('action');
    if (!action) return;
    url.searchParams.delete('action');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    latest.current[action]?.();
  }, [ready]);

  useEffect(() => {
    const onAction = (e: Event) => {
      const { path, action } = (e as CustomEvent<NavActionDetail>).detail ?? {};
      if (path === window.location.pathname) latest.current[action]?.();
    };
    window.addEventListener(NAV_ACTION_EVENT, onAction);
    return () => window.removeEventListener(NAV_ACTION_EVENT, onAction);
  }, []);
}
