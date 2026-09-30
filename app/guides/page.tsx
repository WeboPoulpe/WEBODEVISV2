import Link from 'next/link';
import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { GUIDES } from '@/lib/site/guides';
import { pageMetadata } from '@/lib/site/metadata';
import { FEATURES_INDEX, GUIDES_INDEX, HOME } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';

const TITLE = 'Guides pratiques pour traiteurs : devis, quantités, marge | WeboDevis';
const DESCRIPTION = 'Des guides écrits pour les traiteurs : le contenu d’un devis, les quantités par convive, la liste de courses, la marge, l’organisation d’un événement.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: GUIDES_INDEX.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: GUIDES_INDEX.label, path: GUIDES_INDEX.href },
];

export default function GuidesIndexPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <HeroPanel
        crumbs={crumbs}
        title="Guides pratiques pour traiteurs"
        lead="Le devis, les quantités, les courses, la marge, l’organisation&nbsp;: des méthodes à appliquer dès le prochain événement, avec ou sans logiciel."
        demo={false}
      />

      <section aria-label="Tous les guides" className="pt-6 md:pt-10">
        <div className={container}>
          <ol>
            {GUIDES.map((g, i) => (
              <li key={g.slug} className={i > 0 ? 'border-t border-gray-300/70' : ''}>
                <Link href={g.href} className="group grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] gap-x-16 gap-y-3 py-9 md:py-12 rounded-2xl">
                  <h2 className="site-h2 max-w-[18ch] underline-offset-[6px] decoration-2 group-hover:underline">{g.title}</h2>
                  <div>
                    <p className="site-body text-gray-700 max-w-[52ch]">{fr(g.description)}</p>
                    <p className="text-sm text-gray-500 mt-3">{g.minutes} min de lecture</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-label="Le logiciel" className={sectionGap}>
        <div className={container}>
          <p className="site-lead text-gray-700 max-w-[56ch]">
            Ces méthodes fonctionnent sur papier comme sur un tableur. WeboDevis en automatise une partie : voyez{' '}
            <TextLink href={FEATURES_INDEX.href}>ce que fait le logiciel</TextLink>.
          </p>
        </div>
      </section>
    </>
  );
}
