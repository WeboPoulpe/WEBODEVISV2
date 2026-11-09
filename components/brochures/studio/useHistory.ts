'use client';

// Annuler / rétablir pour le Studio. Les changements d'un même geste (glisser un élément, taper un texte) portent la
// même clé et ne font qu'une étape : « Annuler » défait le geste entier, pas chaque pixel ou chaque lettre.
// Avec `storageKey`, l'historique est gardé dans ce navigateur : il survit au rechargement de la page, tant que la
// brochure n'a pas changé ailleurs entre-temps (sinon il repart de zéro, pour ne rien défaire de travers).

import { useCallback, useEffect, useRef, useState } from 'react';

const LIMIT = 100;
const MERGE_MS = 1200;
/** Étapes gardées dans le navigateur (le stockage est limité à quelques Mo). */
const KEPT = [30, 10, 3];

type State<T> = { past: T[]; present: T; future: T[] };

/** JSON aux clés triées : deux documents égaux s'écrivent pareil, quel que soit l'ordre de leurs champs. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function restore<T>(key: string | undefined, initial: T, canon: (d: T) => string): State<T> {
  const fresh = { past: [], present: initial, future: [] };
  if (!key || typeof window === 'undefined') return fresh;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { present: string; past: T[]; future: T[] } | null;
    if (saved && saved.present === canon(initial) && Array.isArray(saved.past) && Array.isArray(saved.future)) {
      return { past: saved.past, present: initial, future: saved.future };
    }
  } catch { /* stockage illisible ou indisponible : historique neuf */ }
  return fresh;
}

/**
 * `canon` : forme comparable d'un document (par défaut son JSON aux clés triées) ; l'historique gardé n'est repris
 * que si le document enregistré est le même que celui laissé.
 */
export function useHistory<T>(initial: T, storageKey?: string, canon: (d: T) => string = stableJson) {
  const [state, setState] = useState<State<T>>(() => restore(storageKey, initial, canon));
  const last = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const timer = window.setTimeout(() => {
      for (const n of KEPT) {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ present: canon(state.present), past: state.past.slice(-n), future: state.future.slice(0, n) }));
          return;
        } catch { /* trop lourd : moins d'étapes */ }
      }
      try { localStorage.removeItem(storageKey); } catch { /* rien à faire */ }
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, storageKey]);

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
