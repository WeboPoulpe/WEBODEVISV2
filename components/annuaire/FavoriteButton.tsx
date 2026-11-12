'use client';

import { useEffect, useState } from 'react';
import { FAVORITES_EVENT, readFavorites, toggleFavorite, writeFavorites } from '@/lib/annuaire/favorites';

// Garder une fiche dans ses favoris : la liste vit dans ce navigateur (localStorage « cmt:favoris »), sans compte.

export function HeartIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.4 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
    </svg>
  );
}

export default function FavoriteButton({ slug }: { slug: string }) {
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

  return (
    <button
      type="button"
      className="cmt-btn cmt-fav"
      data-saved={saved}
      onClick={() => {
        const next = toggleFavorite(readFavorites(), slug);
        writeFavorites(next);
        setSaved(next.includes(slug));
      }}
    >
      <HeartIcon />
      {saved ? 'Dans mes favoris' : 'Garder en favori'}
    </button>
  );
}
