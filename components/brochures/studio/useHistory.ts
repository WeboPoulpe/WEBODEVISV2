'use client';

// Annuler / rétablir pour le Studio. Les changements d'un même geste (glisser un élément, taper un texte) portent la
// même clé et ne font qu'une étape : « Annuler » défait le geste entier, pas chaque pixel ou chaque lettre.

import { useCallback, useRef, useState } from 'react';

const LIMIT = 100;
const MERGE_MS = 1200;

export function useHistory<T>(initial: T) {
  const [state, setState] = useState({ past: [] as T[], present: initial, future: [] as T[] });
  const last = useRef<{ key: string; at: number } | null>(null);

  /** Nouveau document. `merge` : même clé que le changement précédent (et récent) = même étape. */
  const set = useCallback((next: T | ((d: T) => T), merge?: string) => {
    setState((s) => {
      const value = typeof next === 'function' ? (next as (d: T) => T)(s.present) : next;
      if (Object.is(value, s.present)) return s;
      const now = Date.now();
      const same = !!merge && last.current?.key === merge && now - last.current.at < MERGE_MS;
      last.current = merge ? { key: merge, at: now } : null;
      if (same) return { ...s, present: value, future: [] };
      return { past: [...s.past, s.present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    last.current = null;
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  return { doc: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
