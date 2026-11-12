import Link from 'next/link';
import type { ListingCard as Card } from '@/server/directoryPublic';
import { placeLine } from '@/lib/annuaire/phrases';
import FavoriteButton from './FavoriteButton';

// Carte d'une fiche (accueil, résultats, favoris) : la photo prend toute la carte ; le nom, l'accroche, le prix de
// départ et le lieu sont posés dessus dans un cartouche blanc. Toute la carte mène à la fiche ; le cœur, au-dessus du
// lien, la garde en favori. Utilisable côté serveur comme côté navigateur.

const whole = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 45 € », « 37,50 € » (espaces insécables, identiques côté serveur et navigateur). */
export function formatPrice(n: number): string {
  return (Number.isInteger(n) ? whole : cents).format(n).replace(/[\u202f\u00a0]/g, '\u00a0');
}

export default function ListingCard({ listing, href, headingLevel = 3, onFavoriteChange }: {
  listing: Card;
  /** Adresse de la fiche (avec le préfixe de l'hôte). */
  href: string;
  headingLevel?: 2 | 3;
  /** Page des favoris : la fiche sort de la liste quand son cœur est décoché. */
  onFavoriteChange?: (saved: boolean) => void;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const place = placeLine(listing.city, listing.departments);
  const price = listing.priceFrom !== null && listing.priceFrom > 0 ? listing.priceFrom : null;
  return (
    <article className="cmt-card">
      <div className="cmt-card__media">
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.coverUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <p className="cmt-card__placeholder" aria-hidden="true">{listing.name}</p>
        )}
      </div>
      <div className="cmt-card__label">
        <div className="cmt-card__row">
          <Heading className="cmt-card__title">
            <Link href={href} className="cmt-card__link">{listing.name}</Link>
          </Heading>
          {price !== null && (
            <p className="cmt-card__price">
              <span aria-hidden="true">dès {formatPrice(price)} par pers.</span>
              <span className="sr-only">À partir de {formatPrice(price)} par personne</span>
            </p>
          )}
        </div>
        {listing.tagline && <p className="cmt-card__tagline">{listing.tagline}</p>}
        {place && <p className="cmt-card__place">{place}</p>}
      </div>
      <FavoriteButton slug={listing.slug} name={listing.name} onChange={onFavoriteChange} />
    </article>
  );
}
