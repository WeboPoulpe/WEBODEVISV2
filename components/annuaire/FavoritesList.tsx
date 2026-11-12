'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ListingCard as Card } from '@/server/directoryPublic';
import { favoriteListings } from '@/server/directoryFavorites';
import { readFavorites, writeFavorites } from '@/lib/annuaire/favorites';
import { useDirectoryHref } from './BaseContext';
import ListingCard from './ListingCard';

// Les fiches gardées dans ce navigateur. Une fiche qui n'est plus en ligne sort de la liste.

export default function FavoritesList() {
  const href = useDirectoryHref();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const slugs = readFavorites();
    if (!slugs.length) { setCards([]); return; }
    favoriteListings(slugs)
      .then((r) => {
        setCards(r.listings);
        const kept = r.listings.map((l) => l.slug);
        if (kept.length !== slugs.length) writeFavorites(kept);
      })
      .catch(() => setFailed(true));
  }, []);

  const remove = (slug: string) => {
    writeFavorites(readFavorites().filter((s) => s !== slug));
    setCards((c) => (c ?? []).filter((l) => l.slug !== slug));
  };

  if (failed) {
    return <p role="alert" className="cmt-alert">Vos favoris n’ont pas pu s’afficher. Vérifiez votre connexion, puis rechargez la page.</p>;
  }
  if (cards === null) return <p aria-live="polite">Chargement de vos favoris…</p>;
  if (!cards.length) {
    return (
      <div className="cmt-empty">
        <h2>Aucun favori pour l’instant</h2>
        <p>
          Sur la fiche d’un traiteur, « Garder en favori » le met de côté ici, pour le retrouver au moment de choisir.{' '}
          <Link href={href('/traiteurs')} className="cmt-link">Parcourir les traiteurs</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="cmt-grid">
      {cards.map((l) => (
        <ListingCard key={l.slug} listing={l} href={href(`/traiteur/${l.slug}`)} headingLevel={2}>
          <button type="button" className="cmt-btn" style={{ minHeight: 44, padding: '8px 16px', fontSize: 15 }} onClick={() => remove(l.slug)}>
            Retirer de mes favoris<span className="sr-only"> : {l.name}</span>
          </button>
        </ListingCard>
      ))}
    </div>
  );
}
