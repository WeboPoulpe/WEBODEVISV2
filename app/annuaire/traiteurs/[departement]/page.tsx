import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import PageHead from '@/components/annuaire/PageHead';
import Results from '@/components/annuaire/Results';
import SearchBar from '@/components/annuaire/SearchBar';
import { container } from '@/components/site/ui';
import { directoryBase } from '@/lib/annuaire/base';
import { departmentBySlug } from '@/lib/annuaire/departments';
import { directoryMetadata } from '@/lib/annuaire/metadata';
import { inDepartment } from '@/lib/annuaire/phrases';
import { departmentsWithListings, searchListings } from '@/server/directoryPublic';

// Les traiteurs d'un département (ceux qui déclarent s'y déplacer). Indexée seulement s'il y a au moins une fiche.

export const dynamic = 'force-dynamic';

type Params = Promise<{ departement: string }>;

const listingsOf = cache((code: string) => searchListings({ department: code }));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const d = departmentBySlug((await params).departement);
  if (!d) return {};
  const listings = await listingsOf(d.code);
  return directoryMetadata({
    title: `Traiteurs ${inDepartment(d.code)} (${d.code})`,
    description: `Les traiteurs qui se déplacent ${inDepartment(d.code)} pour un mariage, un cocktail, un séminaire ou une fête de famille. Comparez, puis écrivez directement au traiteur.`,
    path: `/traiteurs/${d.slug}`,
    noindex: listings.length === 0,
  });
}

export default async function DepartementPage({ params }: { params: Params }) {
  const d = departmentBySlug((await params).departement);
  if (!d) notFound();
  const base = await directoryBase();
  const [listings, covered] = await Promise.all([listingsOf(d.code), departmentsWithListings()]);

  return (
    <>
      <PageHead
        base={base}
        crumbs={[{ name: 'Accueil', path: '/' }, { name: 'Traiteurs', path: '/traiteurs' }, { name: d.name.replace(/'/g, '’'), path: `/traiteurs/${d.slug}` }]}
        title={`Traiteurs ${inDepartment(d.code)}`}
        lead={`Les traiteurs qui se déplacent ${inDepartment(d.code)} (${d.code}), pour un mariage, un anniversaire, un cocktail ou un séminaire.`}
      >
        <div className="cmt-searchbox">
          <SearchBar compact department={d.code} />
        </div>
      </PageHead>
      <section className={`${container} cmt-section`} style={{ paddingTop: 40 }} aria-label={`Traiteurs ${inDepartment(d.code)}`}>
        <Results listings={listings} base={base} department={d.code} covered={covered.map((c) => c.code)} />
      </section>
    </>
  );
}
