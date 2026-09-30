import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FaqList from '@/components/site/FaqList';
import FeaturePreviewFor from '@/components/site/FeaturePreviews';
import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import { JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { FEATURES, featureBySlug } from '@/lib/site/features';
import { guideBySlug } from '@/lib/site/guides';
import { pageMetadata } from '@/lib/site/metadata';
import { FEATURES_INDEX, HOME, QUOTE_REQUEST, type SiteLink } from '@/lib/site/pages';
import { breadcrumbSchema, faqSchema, softwareSchema } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';

// Une page par fonctionnalité, générée à partir de lib/site/features.ts.
export const dynamicParams = false;
export const generateStaticParams = () => FEATURES.map((f) => ({ slug: f.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const feature = featureBySlug((await params).slug);
  if (!feature) return {};
  return pageMetadata({ title: feature.metaTitle, description: feature.description, path: feature.href });
}

export default async function FeaturePage({ params }: Props) {
  const feature = featureBySlug((await params).slug);
  if (!feature) notFound();

  const crumbs = [
    { name: HOME.label, path: HOME.href },
    { name: FEATURES_INDEX.label, path: FEATURES_INDEX.href },
    { name: feature.label, path: feature.href },
  ];
  const guide = feature.guide ? guideBySlug(feature.guide) : undefined;
  const related: SiteLink[] = [
    ...feature.related.flatMap((slug) => { const f = featureBySlug(slug); return f ? [{ href: f.href, label: f.label, blurb: f.blurb }] : []; }),
    ...(guide ? [{ href: guide.href, label: `Guide : ${guide.title}`, blurb: guide.blurb }] : []),
  ];
  // Les deux premières sections, puis les phrases clés sur le vert, puis la suite.
  const first = feature.sections.slice(0, 2);
  const rest = feature.sections.slice(2);

  const renderSection = (s: (typeof feature.sections)[number]) => (
    <div key={s.title} className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-5 py-10 md:py-14 border-t border-gray-300/70">
      <h2 className="site-h2 max-w-[16ch]">{fr(s.title)}</h2>
      <div>
        {s.body.map((p, i) => <p key={i} className={`site-body text-gray-700 max-w-[60ch] ${i > 0 ? 'mt-4' : ''}`}>{fr(p)}</p>)}
        {s.points && (
          <ul className="mt-6 space-y-2.5 max-w-[60ch]">
            {s.points.map((pt) => (
              <li key={pt} className="flex gap-3 text-base leading-relaxed text-gray-900">
                <span className="flex-shrink-0 mt-[0.6em] w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
                {fr(pt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      <JsonLd data={[
        breadcrumbSchema(crumbs),
        softwareSchema({ path: feature.href, description: feature.description, features: feature.highlights }),
        faqSchema(feature.faqs),
      ]} />

      <HeroPanel crumbs={crumbs} title={feature.h1} lead={feature.lead} media={<FeaturePreviewFor kind={feature.preview} />} />

      <section aria-label="En détail" className="pt-14 md:pt-20">
        <div className={container}>{first.map(renderSection)}</div>
      </section>

      {/* L'essentiel, en trois phrases */}
      <section aria-labelledby="titre-essentiel" className="site-dark mx-2 sm:mx-2.5 rounded-[28px] bg-forest text-white">
        <div className={`${container} py-14 md:py-20`}>
          <h2 id="titre-essentiel" className="sr-only">L’essentiel</h2>
          <ul>
            {feature.highlights.map((h, i) => (
              <li key={h} className={`site-tagline font-display py-6 md:py-8 ${i > 0 ? 'border-t border-white/15' : 'pt-0 md:pt-0'}`}>{fr(h)}</li>
            ))}
          </ul>
        </div>
      </section>

      {rest.length > 0 && (
        <section aria-label="En détail, suite" className="pt-14 md:pt-20">
          <div className={container}>{rest.map(renderSection)}</div>
        </section>
      )}

      <section aria-labelledby="titre-questions" className={rest.length > 0 ? 'pt-10 md:pt-14' : sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
          <h2 id="titre-questions" className="site-h2 max-w-[14ch]">Questions fréquentes</h2>
          <FaqList faqs={feature.faqs} />
        </div>
      </section>

      <section aria-labelledby="titre-voir-aussi" className={sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
          <div>
            <h2 id="titre-voir-aussi" className="site-h2">À voir aussi</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[36ch]">
              Une question sur le logiciel, ou besoin d’une proposition pour votre maison ?{' '}
              <TextLink href={QUOTE_REQUEST.href}>{QUOTE_REQUEST.label}</TextLink>
            </p>
          </div>
          <LinkList links={related} columns={1} />
        </div>
      </section>
    </>
  );
}
