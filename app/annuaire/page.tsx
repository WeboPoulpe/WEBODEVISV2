import type { Metadata } from 'next';
import Link from 'next/link';
import ListingCard from '@/components/annuaire/ListingCard';
import SearchBar from '@/components/annuaire/SearchBar';
import { container, JsonLd } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME } from '@/lib/annuaire/config';
import type { EventType } from '@/lib/annuaire/eventTypes';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { directoryHref } from '@/lib/annuaire/routing';
import { directoryWebsiteJsonLd } from '@/lib/annuaire/schema';
import { searchListings } from '@/server/directoryPublic';

// Accueil de l'annuaire : la recherche en phrase et sa mosaïque de photos, les pastilles d'événements, les dernières
// fiches publiées (jamais de compteur), puis la bande pourpre qui s'adresse aux traiteurs.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...directoryMetadata({
    title: `${DIRECTORY_NAME} : trouvez un traiteur près de chez vous`,
    description: 'Mariage, cocktail, séminaire : comparez les traiteurs de votre département, leurs photos et leurs prix de départ, puis écrivez-leur directement. Gratuit pour vous.',
    path: '/',
  }),
  title: { absolute: `${DIRECTORY_NAME} : trouvez un traiteur près de chez vous` },
};

const RECENT = 6;

// Photos de l'accueil (public/annuaire/accueil/) : la même adresse sur l'hôte de l'annuaire et sous /annuaire.
const PHOTO = (file: string) => `/annuaire/accueil/${file}.webp`;

// Une pastille par type d'événement, dans l'ordre de la maquette (les plus demandés d'abord), avec sa vignette ronde.
const EVENTS: [EventType, string][] = [
  ['Mariage', 'table-mariage'], ['Cocktail', 'cocktail'], ['Séminaire', 'buffet'], ['Anniversaire', 'barbecue'],
  ['Baptême', 'piece-montee'], ['Gala', 'assiette'], ['Communion', 'brasero'], ['Autre', 'tournebroche-terrasse'],
];

function Mosaic() {
  return (
    <div className="cmt-mosaic">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="cmt-mosaic__tall"
        src={PHOTO('tournebroche-terrasse')}
        alt="Cochons rôtis au tournebroche, vus depuis une table dressée en terrasse"
        width={933}
        height={1200}
        fetchPriority="high"
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO('table-mariage')} alt="Table de mariage dressée, fleurs et rubans roses" width={1200} height={900} decoding="async" />
      <div className="cmt-mosaic__free">
        <p className="cmt-mosaic__zero">0&nbsp;€</p>
        <p>pour chercher, comparer et contacter</p>
      </div>
    </div>
  );
}

export default async function AnnuaireHome() {
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  const recent = (await searchListings({})).slice(0, RECENT);
  const byType = (t: EventType) => href(`/traiteurs?${new URLSearchParams({ type: t })}`);

  return (
    <>
      <JsonLd data={directoryWebsiteJsonLd()} />
      <div className={container}>
        <section className="cmt-hero" aria-labelledby="accueil-titre">
          <div>
            <h1 id="accueil-titre" className="sr-only">Trouver un traiteur pour votre événement, dans votre département</h1>
            <SearchBar aside="Photos, cartes à feuilleter et prix de départ. Vous écrivez directement au traiteur, sans intermédiaire." />
          </div>
          <Mosaic />
        </section>

        <nav aria-label="Chercher par type d’événement">
          <ul className="cmt-events">
            {EVENTS.map(([t, photo]) => (
              <li key={t}>
                <Link href={byType(t)} className="cmt-event">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PHOTO(`${photo}-petit`)} alt="" width={44} height={44} loading="lazy" decoding="async" />
                  {t === 'Autre' ? 'Autres événements' : t}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section className="cmt-section cmt-section--first" aria-labelledby="recentes-titre">
          {recent.length > 0 ? (
            <>
              <div className="cmt-section-head">
                <h2 id="recentes-titre" className="cmt-h2">Les derniers traiteurs arrivés</h2>
                <Link href={href('/traiteurs')} className="cmt-link">Voir tous les traiteurs</Link>
              </div>
              <div className="cmt-grid cmt-grid--home">
                {recent.map((l) => <ListingCard key={l.slug} listing={l} href={href(`/traiteur/${l.slug}`)} />)}
              </div>
            </>
          ) : (
            <div className="cmt-empty">
              <h2 id="recentes-titre">Les premiers traiteurs arrivent</h2>
              <p>
                {DIRECTORY_NAME} ouvre ses portes : les traiteurs y publient leur fiche en ce moment, département par département.
                Gardez l’adresse, les premières fiches seront bientôt en ligne.
              </p>
              <p>Vous êtes traiteur ? La vôtre peut être parmi les premières, voyez juste en dessous comment faire.</p>
            </div>
          )}
        </section>
      </div>

      <section className="cmt-purple" aria-labelledby="traiteurs-titre">
        <div className={`${container} cmt-purple__inner`}>
          <div className="cmt-purple__text">
            <h2 id="traiteurs-titre" className="cmt-purple__title">Vous êtes traiteur&nbsp;? Faites-vous connaître ici.</h2>
            <div className="cmt-purple__row">
              <p>Votre fiche est incluse si vous êtes équipé de WeboDevis, le logiciel partenaire de {DIRECTORY_NAME}.</p>
              <Link href={href('/referencer-mon-entreprise')} className="cmt-btn cmt-btn--light cmt-btn--big">Référencer mon entreprise</Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="cmt-purple__photo"
            src={PHOTO('brasero')}
            alt="Un traiteur cuisine pommes de terre, champignons et poivrons au brasero, devant les invités"
            width={1200}
            height={800}
            loading="lazy"
            decoding="async"
          />
        </div>
      </section>
    </>
  );
}
