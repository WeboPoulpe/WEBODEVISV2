import type { Metadata } from 'next';
import Link from 'next/link';
import { ClocheMotif, FourStar, Scallop } from '@/components/annuaire/AnnuaireMark';
import ListingCard from '@/components/annuaire/ListingCard';
import SearchBar from '@/components/annuaire/SearchBar';
import { container, JsonLd } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME } from '@/lib/annuaire/config';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { directoryHref } from '@/lib/annuaire/routing';
import { directoryWebsiteJsonLd } from '@/lib/annuaire/schema';
import { searchListings } from '@/server/directoryPublic';

// Accueil de l'annuaire : la recherche en phrase, les dernières fiches publiées (jamais de compteur), le principe en
// trois étapes et un mot pour les traiteurs.

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

function Collage({ covers }: { covers: string[] }) {
  // Les photos des dernières fiches quand il y en a trois, sinon des aplats dessinés.
  const photo = (i: number) => covers.length >= 3
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={covers[i]} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
    : null;
  return (
    <div className="cmt-collage" aria-hidden="true">
      <div className="cmt-tile cmt-tile--a">{photo(0) ?? <ClocheMotif size={150} />}</div>
      <div className="cmt-tile cmt-tile--b" style={{ color: '#FFFFFF' }}>
        {photo(1) ?? (
          <svg width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 18h22c0 14-4.5 22-11 22s-11-8-11-22z" /><path d="M33 40v30" /><path d="M24 72h18" />
            <path d="M52 26h22c0 14-4.5 22-11 22s-11-8-11-22z" /><path d="M63 48v22" /><path d="M54 72h18" />
          </svg>
        )}
      </div>
      <div className="cmt-tile cmt-tile--c" style={{ color: '#F8D04F' }}>
        {photo(2) ?? (
          <div style={{ display: 'flex', gap: 18 }}>
            <FourStar size={34} /><FourStar size={48} /><FourStar size={34} />
          </div>
        )}
      </div>
      <Scallop>des traiteurs d’ici</Scallop>
      <FourStar className="cmt-star" style={{ left: '38%', bottom: -6 }} />
    </div>
  );
}

const STEPS = [
  { title: 'Dites ce que vous préparez', text: 'Votre département et le type d’événement : mariage, anniversaire, cocktail, séminaire.' },
  { title: 'Comparez les traiteurs', text: 'Les photos, les cartes à feuilleter, le nombre de convives et le prix de départ.' },
  { title: 'Écrivez à celui qui vous plaît', text: 'Votre demande va droit au traiteur, qui vous répond par e-mail ou par téléphone.' },
];

export default async function AnnuaireHome() {
  const base = await directoryBase();
  const href = (p: string) => directoryHref(base, p);
  const recent = (await searchListings({})).slice(0, RECENT);
  const covers = recent.map((l) => l.coverUrl).filter((u): u is string => !!u).slice(0, 3);

  return (
    <>
      <JsonLd data={directoryWebsiteJsonLd()} />
      <div className={container}>
        <section className="cmt-hero" aria-labelledby="accueil-titre">
          <div>
            <h1 id="accueil-titre" className="sr-only">Trouver un traiteur pour votre événement, dans votre département</h1>
            <SearchBar aside="Comparez les fiches, puis écrivez directement au traiteur. C’est gratuit pour vous." />
          </div>
          <Collage covers={covers} />
        </section>
      </div>

      <section className="cmt-band" aria-labelledby="recentes-titre">
        <div className={container}>
          {recent.length > 0 ? (
            <>
              <div className="cmt-section-head">
                <h2 id="recentes-titre" className="cmt-h2">Les derniers traiteurs arrivés</h2>
                <Link href={href('/traiteurs')} className="cmt-link">Voir tous les traiteurs</Link>
              </div>
              <div className="cmt-grid">
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
              <p>Vous êtes traiteur ? La vôtre peut être parmi les premières, voyez plus bas comment faire.</p>
            </div>
          )}
        </div>
      </section>

      <section className={`${container} cmt-section`} aria-labelledby="etapes-titre">
        <h2 id="etapes-titre" className="cmt-h2">Trouver votre traiteur, en trois temps</h2>
        <ol className="cmt-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="cmt-step__num" aria-hidden="true">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${container} cmt-section`} aria-labelledby="traiteurs-titre">
        <div className="cmt-pitch">
          <div>
            <h2 id="traiteurs-titre" className="cmt-h2">Vous êtes traiteur ?</h2>
            <p>
              Présentez votre maison à ceux qui cherchent un traiteur près de chez eux : vos photos, vos cartes, les événements que
              vous servez. Les demandes arrivent directement chez vous. La fiche est offerte aux abonnés de WeboDevis, le logiciel
              des traiteurs, partenaire de {DIRECTORY_NAME}.
            </p>
          </div>
          <Link href={href('/referencer-mon-entreprise')} className="cmt-btn cmt-btn--primary">Voir ce que comprend la fiche</Link>
        </div>
      </section>
    </>
  );
}
