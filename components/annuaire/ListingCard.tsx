import Link from 'next/link';
import type { ListingCard as Card } from '@/server/directoryPublic';
import { placeLine } from '@/lib/annuaire/phrases';
import { ClocheMotif } from './AnnuaireMark';

// Carte d'une fiche (accueil, résultats, favoris). Toute la carte mène à la fiche ; `children` reçoit une action à
// part (retirer des favoris), posée au-dessus du lien. Utilisable côté serveur comme côté navigateur.

const whole = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 45 € », « 37,50 € » (espaces insécables, identiques côté serveur et navigateur). */
export function formatPrice(n: number): string {
  return (Number.isInteger(n) ? whole : cents).format(n).replace(/[\u202f\u00a0]/g, '\u00a0');
}

/** Pastille ronde du prix de départ. */
export function PriceSticker({ price }: { price: number }) {
  return (
    <p className="cmt-sticker">
      <span className="sr-only">À partir de {formatPrice(price)} par personne</span>
      <small aria-hidden="true">dès</small>
      <strong aria-hidden="true">{formatPrice(price)}</strong>
      <small aria-hidden="true">par pers.</small>
    </p>
  );
}

export default function ListingCard({ listing, href, children, headingLevel = 3 }: {
  listing: Card;
  /** Adresse de la fiche (avec le préfixe de l'hôte). */
  href: string;
  children?: React.ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const priced = listing.priceFrom !== null && listing.priceFrom > 0;
  return (
    <article className={`cmt-card ${priced ? 'cmt-card--priced' : ''}`}>
      <div className="cmt-card__top">
        <div className="cmt-card__media">
          {listing.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.coverUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="cmt-card__placeholder"><ClocheMotif /></div>
          )}
        </div>
        {priced && <PriceSticker price={listing.priceFrom!} />}
      </div>
      <div className="cmt-card__body">
        <Heading className="cmt-card__title">
          <Link href={href} className="cmt-card__link">{listing.name}</Link>
        </Heading>
        <p className="cmt-card__place">{placeLine(listing.city, listing.departments)}</p>
        {listing.tagline && <p className="cmt-card__tagline">{listing.tagline}</p>}
        {listing.eventTypes.length > 0 && <p className="cmt-card__types">{listing.eventTypes.join(', ')}</p>}
      </div>
      {children && <div className="cmt-card__actions">{children}</div>}
    </article>
  );
}
