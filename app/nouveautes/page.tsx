import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import { JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { RELEASE } from '@/lib/site/config';
import { pageMetadata } from '@/lib/site/metadata';
import { CONTACT, DEMO, FEATURE_COLUMNS, HOME, RELEASES } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';

const TITLE = `Nouveautés : WeboDevis ${RELEASE.version} sort le ${RELEASE.dateLabel}`;
const DESCRIPTION = `La version ${RELEASE.version} de WeboDevis, le logiciel des traiteurs, sort le ${RELEASE.dateLabel}. Voici ce qu’elle contient, fonction par fonction.`;

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: RELEASES.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: RELEASES.label, path: RELEASES.href },
];

export default function ReleasesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <HeroPanel
        crumbs={crumbs}
        title="Nouveautés de WeboDevis"
        lead="Les versions du logiciel, de la plus récente à la plus ancienne. La première arrive."
        demo={false}
      />

      <section aria-labelledby="titre-version" className="pt-12 md:pt-20">
        <div className={container}>
          <p className="text-base text-gray-600">
            <time dateTime={RELEASE.date}>{RELEASE.dateLabel}</time>
          </p>
          <h2 id="titre-version" className="site-h1 font-display mt-2">Version {RELEASE.version}</h2>
          <p className="site-lead text-gray-700 mt-6 max-w-[58ch]">
            La première version publique de WeboDevis sort le {RELEASE.dateLabel}. Elle couvre le métier de traiteur d’un bout à l’autre : de la demande reçue jusqu’à l’événement servi.
          </p>
          <p className="site-body text-gray-700 mt-4 max-w-[58ch]">
            En attendant, la démonstration est ouverte : <TextLink href={DEMO.href}>essayer la démo</TextLink>, sur un compte rempli de données fictives.
          </p>
        </div>
      </section>

      {FEATURE_COLUMNS.map((group, i) => (
        <section key={group.title} aria-labelledby={`contenu-${i}`} className="pt-14 md:pt-20">
          <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-6`}>
            <h3 id={`contenu-${i}`} className="site-h2 font-display max-w-[12ch]">{group.title}</h3>
            <LinkList links={group.links} columns={1} />
          </div>
        </section>
      ))}

      <section aria-label="Une question" className={sectionGap}>
        <div className={container}>
          <p className="site-lead text-gray-700 max-w-[56ch]">
            Une question sur cette version, ou sur ce qu’il vous faudrait ? <TextLink href={CONTACT.href}>Écrivez-nous</TextLink>.
          </p>
        </div>
      </section>
    </>
  );
}
