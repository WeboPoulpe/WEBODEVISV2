import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FeaturePreviewFor from '@/components/site/FeaturePreviews';
import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import { JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { AUDIENCES, audienceBySlug } from '@/lib/site/audiences';
import { featureBySlug } from '@/lib/site/features';
import { guideBySlug } from '@/lib/site/guides';
import { pageMetadata } from '@/lib/site/metadata';
import { AUDIENCE_LINKS, FEATURES_INDEX, HOME, QUOTE_REQUEST } from '@/lib/site/pages';
import { breadcrumbSchema } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';

// Une page par type d'activité, générée à partir de lib/site/audiences.ts.
export const dynamicParams = false;
export const generateStaticParams = () => AUDIENCES.map((a) => ({ slug: a.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const audience = audienceBySlug((await params).slug);
  if (!audience) return {};
  return pageMetadata({ title: audience.metaTitle, description: audience.description, path: audience.href });
}

export default async function AudiencePage({ params }: Props) {
  const audience = audienceBySlug((await params).slug);
  if (!audience) notFound();

  const crumbs = [
    { name: HOME.label, path: HOME.href },
    { name: audience.label, path: audience.href },
  ];
  const guides = audience.guides.flatMap((slug) => {
    const g = guideBySlug(slug);
    return g ? [{ href: g.href, label: g.title, blurb: g.blurb }] : [];
  });
  const others = AUDIENCE_LINKS.filter((a) => a.href !== audience.href);

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <HeroPanel crumbs={crumbs} title={audience.h1} lead={audience.lead} media={<FeaturePreviewFor kind={audience.preview} />} />

      <section aria-label="Ce que WeboDevis change pour vous" className="pt-14 md:pt-20">
        <div className={container}>
          {audience.sections.map((s) => {
            const feature = featureBySlug(s.feature);
            return (
              <div key={s.title} className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-5 py-10 md:py-14 border-t border-gray-300/70">
                <h2 className="site-h2 max-w-[16ch]">{fr(s.title)}</h2>
                <div>
                  <p className="site-body text-gray-700 max-w-[60ch]">{fr(s.body)}</p>
                  {feature && <p className="mt-5"><TextLink href={feature.href}>{s.linkLabel}</TextLink></p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="titre-guides" className="pt-10 md:pt-14">
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
          <div>
            <h2 id="titre-guides" className="site-h2 max-w-[14ch]">Trois guides pour aller plus loin</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[36ch]">
              Toutes les fonctions sont détaillées dans la <TextLink href={FEATURES_INDEX.href}>vue d’ensemble</TextLink>.
            </p>
          </div>
          <LinkList links={guides} columns={1} />
        </div>
      </section>

      <section aria-labelledby="titre-autres" className={sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
          <div>
            <h2 id="titre-autres" className="site-h2 max-w-[14ch]">Votre activité est différente&nbsp;?</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[36ch]">
              Dites-nous comment vous travaillez. <TextLink href={QUOTE_REQUEST.href}>{QUOTE_REQUEST.label}</TextLink>
            </p>
          </div>
          <LinkList links={others} columns={1} />
        </div>
      </section>
    </>
  );
}
