'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ListingCard as Card } from '@/server/directoryPublic';
import { favoriteListings } from '@/server/directoryFavorites';
import { readFavorites, writeFavorites } from '@/lib/annuaire/favorites';
import { useDirectoryHref } from './BaseContext';
import ListingCard from './ListingCard';

// Les fiches gardées dans ce navigateur. Une fiche qui n'est plus en ligne sort de la liste, comme celle dont on décoche
// le cœur.

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

  // Le cœur de la carte a déjà retiré la fiche du navigateur : elle sort aussi de la page.
  const removed = (slug: string) => setCards((c) => (c ?? []).filter((l) => l.slug !== slug));

  if (failed) {
    return <p role="alert" className="cmt-alert">Vos favoris n’ont pas pu s’afficher. Vérifiez votre connexion, puis rechargez la page.</p>;
  }
  if (cards === null) return <p aria-live="polite">Chargement de vos favoris…</p>;
  if (!cards.length) {
    return (
      <div className="cmt-empty">
        <h2>Aucun favori pour l’instant</h2>
        <p>
          Le cœur d’une carte, ou « Garder en favori » sur la fiche d’un traiteur, le met de côté ici, pour le retrouver au
          moment de choisir.{' '}
          <Link href={href('/traiteurs')} className="cmt-link">Parcourir les traiteurs</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="cmt-grid">
      {cards.map((l) => (
        <ListingCard
          key={l.slug}
          listing={l}
          href={href(`/traiteur/${l.slug}`)}
          headingLevel={2}
          onFavoriteChange={(saved) => { if (!saved) removed(l.slug); }}
        />
      ))}
    </div>
  );
}
