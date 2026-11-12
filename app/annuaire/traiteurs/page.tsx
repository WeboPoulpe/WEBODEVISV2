import type { Metadata } from 'next';
import PageHead from '@/components/annuaire/PageHead';
import Results from '@/components/annuaire/Results';
import SearchBar from '@/components/annuaire/SearchBar';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { departmentByCode } from '@/lib/annuaire/departments';
import { isEventType } from '@/lib/annuaire/eventTypes';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { eventPhrase, inDepartment } from '@/lib/annuaire/phrases';
import { departmentsWithListings, searchListings } from '@/server/directoryPublic';

// Toutes les fiches, filtrables par l'adresse (?departement=10&type=Mariage). Une recherche filtrée n'est pas indexée :
// l'adresse canonique reste /traiteurs, et chaque département a sa propre page.

export const dynamic = 'force-dynamic';

type Search = Promise<{ [k: string]: string | string[] | undefined }>;

function filters(sp: { [k: string]: string | string[] | undefined }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const department = departmentByCode(one(sp.departement))?.code;
  const t = one(sp.type);
  const eventType = isEventType(t) ? t : undefined;
  return { department, eventType, any: Object.keys(sp).length > 0 };
}

function titleOf(department?: string, eventType?: string) {
  if (!department && !eventType) return 'Tous les traiteurs';
  return ['Traiteurs', eventType ? `pour ${eventPhrase(eventType)}` : '', department ? inDepartment(department) : ''].filter(Boolean).join(' ');
}

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { department, eventType, any } = filters(await searchParams);
  return directoryMetadata({
    title: titleOf(department, eventType),
    description: 'Les traiteurs de l’annuaire, pour un mariage, un cocktail, un séminaire ou une fête de famille. Comparez, puis écrivez directement au traiteur.',
    path: '/traiteurs',
    noindex: any,
  });
}

export default async function TraiteursPage({ searchParams }: { searchParams: Search }) {
  const { department, eventType } = filters(await searchParams);
  const base = await directoryBase();
  const [listings, covered] = await Promise.all([searchListings({ department, eventType }), departmentsWithListings()]);

  return (
    <>
      <PageHead
        base={base}
        crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Traiteurs', path: '/traiteurs' }]}
        title={titleOf(department, eventType)}
      >
        <div className="cmt-searchbox">
          <SearchBar compact department={department} eventType={eventType} />
        </div>
      </PageHead>
      <section className={`${container} cmt-section cmt-section--near`} aria-label="Résultats">
        <Results listings={listings} base={base} department={department} eventType={eventType} covered={covered.map((c) => c.code)} />
      </section>
    </>
  );
}
