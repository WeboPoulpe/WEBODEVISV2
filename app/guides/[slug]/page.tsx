import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ChecklistEvenement from '@/components/site/guides/ChecklistEvenement';
import ContenuDevis from '@/components/site/guides/ContenuDevis';
import ListeDeCourses from '@/components/site/guides/ListeDeCourses';
import MargeTraiteur from '@/components/site/guides/MargeTraiteur';
import QuantitesParConvive from '@/components/site/guides/QuantitesParConvive';
import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import { JsonLd, container, sectionGap } from '@/components/site/ui';
import { featureBySlug } from '@/lib/site/features';
import { GUIDES, guideBySlug } from '@/lib/site/guides';
import { pageMetadata } from '@/lib/site/metadata';
import { GUIDES_INDEX, HOME } from '@/lib/site/pages';
import { articleSchema, breadcrumbSchema } from '@/lib/site/schema';

// Un guide par adresse. La fiche (titre, description) est dans lib/site/guides.ts, le texte dans components/site/guides/.
const BODIES: Record<string, () => React.ReactNode> = {
  'contenu-devis-traiteur': ContenuDevis,
  'calculer-quantites-par-convive': QuantitesParConvive,
  'liste-de-courses-evenement': ListeDeCourses,
  'calculer-marge-traiteur': MargeTraiteur,
  'checklist-evenement-traiteur': ChecklistEvenement,
};

export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (!guide) return {};
  return pageMetadata({ title: guide.metaTitle, description: guide.description, path: guide.href, type: 'article', publishedTime: guide.published });
}

const dateLabel = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function GuidePage({ params }: Props) {
  const guide = guideBySlug((await params).slug);
  const Body = guide ? BODIES[guide.slug] : undefined;
  if (!guide || !Body) notFound();

  const crumbs = [
    { name: HOME.label, path: HOME.href },
    { name: GUIDES_INDEX.label, path: GUIDES_INDEX.href },
    { name: guide.title, path: guide.href },
  ];
  const features = guide.features.flatMap((slug) => {
    const f = featureBySlug(slug);
    return f ? [{ href: f.href, label: f.label, blurb: f.blurb }] : [];
  });
  const others = GUIDES.filter((g) => g.slug !== guide.slug).map((g) => ({ href: g.href, label: g.title, blurb: g.blurb }));

  return (
    <>
      <JsonLd data={[breadcrumbSchema(crumbs), articleSchema({ path: guide.href, title: guide.title, description: guide.description, published: guide.published })]} />

      <article>
        <HeroPanel crumbs={crumbs} title={guide.title} lead={guide.description} demo={false} narrow>
          <p className="text-sm text-white/55 mt-6">
            {guide.minutes} min de lecture. Publié le <time dateTime={guide.published}>{dateLabel(guide.published)}</time>.
          </p>
        </HeroPanel>

        <div className={`${container} pt-10 md:pt-16`}>
          <div className="site-prose max-w-[68ch]">
            <Body />
          </div>
        </div>
      </article>

      <section aria-labelledby="titre-logiciel" className={sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
          <h2 id="titre-logiciel" className="site-h2 max-w-[14ch]">Dans WeboDevis</h2>
          <LinkList links={features} columns={1} />
        </div>
      </section>

      <section aria-labelledby="titre-autres-guides" className={sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
          <h2 id="titre-autres-guides" className="site-h2 max-w-[14ch]">Les autres guides</h2>
          <LinkList links={others} columns={1} />
        </div>
      </section>
    </>
  );
}
