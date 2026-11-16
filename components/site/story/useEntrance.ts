'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Où en est l'entrée en scène d'un bloc animé.
 * - `final` : l'état rendu par le serveur, complet. On y reste si la personne a demandé moins d'animations,
 *   ou si le bloc est déjà à l'écran au chargement (on ne le fait pas clignoter).
 * - `before` : le bloc est plus bas dans la page, il attend, remis à zéro.
 * - `run` : il vient d'arriver à l'écran, l'animation se joue.
 */
export type Entrance = 'final' | 'before' | 'run';

export function useEntrance(ref: RefObject<Element | null>): Entrance {
  const [state, setState] = useState<Entrance>('final');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState('before');
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setState('run');
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return state;
}
