import DashboardPreview from '@/components/site/DashboardPreview';
import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import { JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { FEATURE_LIST } from '@/lib/site/features';
import { pageMetadata } from '@/lib/site/metadata';
import { FEATURES_INDEX, FEATURE_COLUMNS, GUIDES_INDEX, HOME, QUOTE_REQUEST } from '@/lib/site/pages';
import { breadcrumbSchema, softwareSchema } from '@/lib/site/schema';

const TITLE = 'Fonctionnalités du logiciel pour traiteurs | WeboDevis';
const DESCRIPTION = 'Les fonctionnalités de WeboDevis, dans l’ordre du métier : demandes, devis, événements, liste de courses, extras, stock, calendrier, suivi financier.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: FEATURES_INDEX.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: FEATURES_INDEX.label, path: FEATURES_INDEX.href },
];

// Une phrase par étape du métier, au-dessus de ses fonctionnalités.
const GROUP_INTRO: Record<string, string> = {
  'Avant l’événement': 'De la première prise de contact au devis accepté.',
  'Pendant la préparation': 'Du devis validé au jour de la réception.',
  'Au quotidien': 'Ce qui sert toute l’année, événement ou pas.',
};

export default function FeaturesIndexPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema(crumbs), softwareSchema({ path: FEATURES_INDEX.href, description: DESCRIPTION, features: FEATURE_LIST })]} />

      <HeroPanel
        crumbs={crumbs}
        title="Les fonctionnalités de WeboDevis"
        lead="Dix fonctions, rangées dans l’ordre où vous en avez besoin&nbsp;: avant l’événement, pendant sa préparation, et au quotidien."
        media={<DashboardPreview />}
      />

      {FEATURE_COLUMNS.map((group, i) => (
        <section key={group.title} aria-labelledby={`groupe-${i}`} className={i === 0 ? 'pt-16 md:pt-24' : sectionGap}>
          <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
            <div>
              <h2 id={`groupe-${i}`} className="site-h2 max-w-[12ch]">{group.title}</h2>
              <p className="site-body text-gray-700 mt-5 max-w-[34ch]">{GROUP_INTRO[group.title ?? '']}</p>
            </div>
            <LinkList links={group.links} columns={1} />
          </div>
        </section>
      ))}

      <section aria-label="Pour aller plus loin" className={sectionGap}>
        <div className={container}>
          <p className="site-lead text-gray-700 max-w-[56ch]">
            Les <TextLink href={GUIDES_INDEX.href}>guides pratiques</TextLink> reprennent ces sujets côté métier : le contenu d’un devis, les quantités par convive, la liste de courses, la marge. Pour une proposition adaptée à votre maison, vous pouvez aussi{' '}
            <TextLink href={QUOTE_REQUEST.href}>demander un devis</TextLink>.
          </p>
        </div>
      </section>
    </>
  );
}
