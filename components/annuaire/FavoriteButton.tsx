'use client';

import { useEffect, useState } from 'react';
import { FAVORITES_EVENT, readFavorites, toggleFavorite, writeFavorites } from '@/lib/annuaire/favorites';

// Garder une fiche dans ses favoris : la liste vit dans ce navigateur (localStorage « cmt:favoris »), sans compte.

export function HeartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

/**
 * `name` donné : le bouton rond du cœur posé sur une carte (son nom dit quelle fiche il garde). Sans `name` : le bouton
 * avec son texte, sur la page d'une fiche. `onChange` prévient la liste des favoris qu'une fiche en sort.
 */
export default function FavoriteButton({ slug, name, onChange }: { slug: string; name?: string; onChange?: (saved: boolean) => void }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(readFavorites().includes(slug));
    sync();
    window.addEventListener(FAVORITES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [slug]);

  const toggle = () => {
    const next = toggleFavorite(readFavorites(), slug);
    writeFavorites(next);
    setSaved(next.includes(slug));
    onChange?.(next.includes(slug));
  };

  if (name) {
    return (
      <button type="button" className="cmt-heart" aria-pressed={saved} aria-label={`Garder ${name} en favori`} onClick={toggle}>
        <HeartIcon size={22} />
      </button>
    );
  }
  return (
    <button type="button" className="cmt-btn cmt-btn--quiet cmt-fav" data-saved={saved} onClick={toggle}>
      <HeartIcon />
      {saved ? 'Dans mes favoris' : 'Garder en favori'}
    </button>
  );
}
