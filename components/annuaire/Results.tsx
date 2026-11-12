import Link from 'next/link';
import type { ListingCard as Card } from '@/server/directoryPublic';
import { departmentByCode } from '@/lib/annuaire/departments';
import { eventPhrase, inDepartment, sameRegion } from '@/lib/annuaire/phrases';
import { directoryHref } from '@/lib/annuaire/routing';
import ListingCard from './ListingCard';

// Résultats d'une recherche (toutes les fiches, un département, un filtre). Sans résultat, la page propose une suite :
// le même département sans le type, ou les départements de la même région qui ont des fiches.

export const RANKING_NOTE = 'Les fiches sont classées par date de publication, la plus récente d’abord. Aucun traiteur ne paie pour être mieux placé.';

export default function Results({ listings, base, department, eventType, covered }: {
  listings: Card[];
  base: '' | '/annuaire';
  department?: string;
  eventType?: string;
  /** Départements qui ont au moins une fiche. */
  covered: string[];
}) {
  const href = (p: string) => directoryHref(base, p);

  if (listings.length) {
    return (
      <>
        <div className="cmt-grid">
          {listings.map((l) => <ListingCard key={l.slug} listing={l} href={href(`/traiteur/${l.slug}`)} headingLevel={2} />)}
        </div>
        <p className="cmt-note">{RANKING_NOTE}</p>
      </>
    );
  }

  const dept = department ? departmentByCode(department) : undefined;
  const withoutType = dept && eventType && covered.includes(dept.code);
  const near = dept ? sameRegion(dept.code).filter((c) => covered.includes(c)) : [];
  const what = [eventType ? `pour ${eventPhrase(eventType)}` : '', dept ? inDepartment(dept.code) : ''].filter(Boolean).join(' ');

  return (
    <div className="cmt-empty">
      <h2>{covered.length ? `Aucun traiteur ${what || 'ici'} pour l’instant` : 'Les premiers traiteurs arrivent'}</h2>
      {covered.length === 0 && (
        <p>Les traiteurs publient leur fiche en ce moment, département par département. Revenez bientôt : les premières fiches seront en ligne.</p>
      )}
      {withoutType && (
        <p>
          D’autres traiteurs se déplacent {inDepartment(dept.code)} :{' '}
          <Link href={href(`/traiteurs/${dept.slug}`)} className="cmt-link">voir tous les traiteurs {inDepartment(dept.code)}</Link>.
        </p>
      )}
      {near.length > 0 && (
        <>
          <p>Des traiteurs se déplacent dans la même région :</p>
          <ul className="cmt-chips">
            {near.map((c) => {
              const d = departmentByCode(c)!;
              return <li key={c}><Link href={href(`/traiteurs/${d.slug}`)} className="cmt-chip">{inDepartment(c)}</Link></li>;
            })}
          </ul>
        </>
      )}
      {covered.length > 0 && !withoutType && near.length === 0 && (
        <p>
          Essayez un autre département, ou <Link href={href('/traiteurs')} className="cmt-link">voyez tous les traiteurs</Link>.
        </p>
      )}
    </div>
  );
}
