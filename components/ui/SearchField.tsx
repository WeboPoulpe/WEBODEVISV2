'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { iconBtn, inputCls } from './kit';
import { cn } from '@/lib/utils';

// Champ de recherche des fenêtres de choix (listes de base, liste de matériel).
// `sticky` : dans une fenêtre (Modal), il reste collé en haut pendant que la liste défile. Les marges et le
// décalage négatifs reprennent le retrait de la zone qui défile (px-5 py-3) : le champ colle au bord même de
// la zone, et la liste ne se devine pas au-dessus.
// La mise au point automatique n'a lieu qu'avec une souris : sur téléphone, le clavier ne s'ouvre pas tout seul.

export default function SearchField({ value, onChange, label, placeholder, autoFocus, sticky, status }: {
  value: string;
  onChange: (value: string) => void;
  /** Nom lu par les lecteurs d'écran. */
  label: string;
  placeholder?: string;
  /** Mise au point à l'ouverture, sur ordinateur seulement. */
  autoFocus?: boolean;
  sticky?: boolean;
  /** Ligne sous le champ : nombre de résultats, ou « Aucun article ne correspond… ». */
  status?: string | null;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && window.matchMedia('(hover: hover) and (pointer: fine)').matches) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div className={cn(sticky && 'sticky -top-3 z-10 -mx-5 -mt-3 px-5 pt-3 pb-2 bg-white')}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input ref={ref} type="search" enterKeyHint="search" autoComplete="off" spellCheck={false}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
          className={cn(inputCls, 'pl-11 pr-12 [&::-webkit-search-cancel-button]:appearance-none')} />
        {value && (
          <button type="button" onClick={() => { onChange(''); ref.current?.focus(); }} aria-label="Effacer la recherche"
            className={cn(iconBtn, 'absolute right-1 top-1/2 -translate-y-1/2')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p aria-live="polite" className={status ? 'mt-2 text-sm text-gray-600' : 'sr-only'}>{status}</p>
    </div>
  );
}

/**
 * Ligne de résultat d'une recherche : rien tant qu'on ne cherche pas, sinon le nombre d'articles trouvés,
 * et ceux déjà cochés que la recherche cache (ils restent sélectionnés).
 */
export function searchStatus(query: string, found: number, hiddenChecked: number): string | null {
  const q = query.trim();
  if (!q) return null;
  const hidden = hiddenChecked > 0 ? `, ${hiddenChecked} autre${hiddenChecked > 1 ? 's' : ''} déjà coché${hiddenChecked > 1 ? 's' : ''}` : '';
  if (found === 0) return `Aucun article ne correspond à « ${q} »${hidden}.`;
  return `${found} article${found > 1 ? 's' : ''} trouvé${found > 1 ? 's' : ''}${hidden}.`;
}
