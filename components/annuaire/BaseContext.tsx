'use client';

import { createContext, useContext } from 'react';
import { DIRECTORY_PREFIX } from '@/lib/annuaire/config';
import { directoryHref } from '@/lib/annuaire/routing';

// Début des liens internes de l'annuaire, posé par app/annuaire/layout.tsx d'après l'hôte de la requête :
// '' sur choisirmontraiteur.fr, '/annuaire' en local et sur les aperçus.

type Base = '' | typeof DIRECTORY_PREFIX;
const BaseCtx = createContext<Base>(DIRECTORY_PREFIX);

export function DirectoryBaseProvider({ base, children }: { base: Base; children: React.ReactNode }) {
  return <BaseCtx.Provider value={base}>{children}</BaseCtx.Provider>;
}

export function useDirectoryBase(): Base {
  return useContext(BaseCtx);
}

/** Raccourci : le lien interne d'un chemin public. */
export function useDirectoryHref(): (path: string) => string {
  const base = useDirectoryBase();
  return (path: string) => directoryHref(base, path);
}
