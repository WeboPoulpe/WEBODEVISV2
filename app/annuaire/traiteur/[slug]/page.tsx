import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ClocheMotif, Scallop } from '@/components/annuaire/AnnuaireMark';
import ContactForm from '@/components/annuaire/ContactForm';
import FavoriteButton from '@/components/annuaire/FavoriteButton';
import ListingGallery from '@/components/annuaire/ListingGallery';
import { PriceSticker, formatPrice } from '@/components/annuaire/ListingCard';
import { Crumbs } from '@/components/annuaire/PageHead';
import { container, JsonLd } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { departmentByCode } from '@/lib/annuaire/departments';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { placeLine } from '@/lib/annuaire/phrases';
import { directoryHref } from '@/lib/annuaire/routing';
import { listingJsonLd } from '@/lib/annuaire/schema';
import { getPublicListing } from '@/server/directoryPublic';

// La fiche d'un traiteur : galerie, présentation (texte brut, sauts de ligne gardés), repères, départements,
// brochures, site web, formulaire de contact. Une fiche qui n'est pas visible n'existe pas (404).

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

const listingOf = cache((slug: string) => getPublicListing(slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const l = await listingOf((await params).slug);
  if (!l) return {};
  const where = l.city ? ` à ${l.city}` : '';
  return directoryMetadata({
    title: `${l.name}, traiteur${where}`,
    description: (l.tagline || l.description || `${l.name}, traiteur${where}.`).slice(0, 160),
    path: `/traiteur/${l.slug}`,
    image: l.coverUrl,
  });
}

/** « de 20 à 300 », « jusqu’à 300 », « à partir de 20 ». */
function guests(min: number | null, max: number | null): string | null {
  if (min && max) return `de ${min} à ${max} convives`;
  if (max) return `jusqu’à ${max} convives`;
  if (min) return `à partir de ${min} convives`;
  return null;
}

/** Adresse lisible du site web : « latable.fr ». */
function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function ListingPage({ params }: { params: Params }) {
  const l = await listingOf((await params).slug);
  if (!l) notFound();
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  const price = l.priceFrom !== null && l.priceFrom > 0 ? l.priceFrom : null;
  const people = guests(l.guestsMin, l.guestsMax);
  const departments = l.departments.map((c) => departmentByCode(c)).filter((d): d is NonNullable<typeof d> => !!d);
  const website = l.websiteUrl && /^https?:\/\//i.test(l.websiteUrl) ? l.websiteUrl : null;

  return (
    <>
      <JsonLd data={listingJsonLd(l)} />
      <div className={container}>
        <article className="cmt-listing" aria-labelledby="fiche-nom">
          <header className="cmt-listing__head">
            <Crumbs base={base} crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Traiteurs', path: '/traiteurs' }, { name: l.name, path: `/traiteur/${l.slug}` }]} />
            <h1 id="fiche-nom" className="cmt-listing__name">{l.name}</h1>
            <p className="cmt-listing__place">{placeLine(l.city, l.departments)}</p>
          </header>

          <div className="cmt-listing__gallery">
            <ListingGallery photos={l.photos} name={l.name} overlay={price !== null ? <PriceSticker price={price} /> : undefined} />
          </div>

          <div className="cmt-listing__info">
            {l.tagline && <p className="cmt-listing__tagline">{l.tagline}</p>}
            {l.eventTypes.length > 0 && (
              <ul className="cmt-chips" aria-label="Événements servis">
                {l.eventTypes.map((t) => <li key={t}><span className="cmt-chip">{t}</span></li>)}
              </ul>
            )}
            {(people || price !== null || website) && (
              <dl className="cmt-facts">
                {people && <div><dt>Convives</dt><dd>{people}</dd></div>}
                {price !== null && <div><dt>Prix</dt><dd>à partir de {formatPrice(price)} par personne</dd></div>}
                {website && (
                  <div>
                    <dt>Site web</dt>
                    <dd><a href={website} target="_blank" rel="nofollow noopener noreferrer" className="cmt-link">{siteLabel(website)}</a></dd>
                  </div>
                )}
              </dl>
            )}
            <div className="cmt-actions">
              <a href="#contact" className="cmt-btn cmt-btn--primary">Écrire à ce traiteur</a>
              <FavoriteButton slug={l.slug} />
            </div>
          </div>
        </article>

        {l.description && (
          <section className="cmt-subsection" aria-labelledby="presentation">
            <h2 id="presentation" className="cmt-h3">Présentation</h2>
            <p className="cmt-text">{l.description}</p>
          </section>
        )}

        {l.brochures.length > 0 && (
          <section className="cmt-subsection" aria-labelledby="brochures">
            <h2 id="brochures" className="cmt-h3">Ses cartes à feuilleter</h2>
            <ul className="cmt-brochures">
              {l.brochures.map((b) => (
                <li key={b.token} className="cmt-brochure">
                  <div className="cmt-brochure__cover">
                    {b.coverUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={b.coverUrl} alt="" loading="lazy" decoding="async" />
                      : <ClocheMotif />}
                  </div>
                  <div className="cmt-brochure__body">
                    <a href={`/b/${encodeURIComponent(b.token)}`} target="_blank" rel="noopener">{b.name}</a>
                    <span>S’ouvre dans un nouvel onglet</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {departments.length > 0 && (
          <section className="cmt-subsection" aria-labelledby="departements">
            <h2 id="departements" className="cmt-h3">Où {l.name} se déplace</h2>
            <ul className="cmt-chips">
              {departments.map((d) => (
                <li key={d.code}><Link href={href(`/traiteurs/${d.slug}`)} className="cmt-chip">{d.name.replace(/'/g, '’')} ({d.code})</Link></li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section id="contact" className="cmt-band" style={{ marginTop: 72, scrollMarginTop: 16 }} aria-labelledby="contact-titre">
        <div className={container}>
          <div className="cmt-contact-head">
            <h2 id="contact-titre" className="cmt-h2">Écrire à {l.name}</h2>
            <Scallop>c’est gratuit</Scallop>
          </div>
          <div style={{ maxWidth: 860 }}>
            <ContactForm slug={l.slug} name={l.name} eventTypes={l.eventTypes} />
          </div>
        </div>
      </section>
    </>
  );
}
