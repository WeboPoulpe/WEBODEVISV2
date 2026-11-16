import Link from 'next/link';
import { Check } from 'lucide-react';
import FaqList from '@/components/site/FaqList';
import HeroPanel from '@/components/site/HeroPanel';
import { DemoButton, JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { DEMO, HOME, QUOTE_REQUEST, PRICING } from '@/lib/site/pages';
import {
  EXTRAS, FIRST_MONTH_HT, FIRST_YEAR_HT, MONTHLY_HT, MONTHLY_INCLUDES, NEXT_YEAR_HT, PRICE_LINE, SETUP_INCLUDES, euros, ttc,
} from '@/lib/pricing';
import { breadcrumbSchema, faqSchema, type Faq } from '@/lib/site/schema';

// Tarifs de WeboDevis : un seul prix, lu dans l'ordre où le traiteur le vit (la démo, le premier mois, les suivants).
// Montants et listes dans lib/pricing, les mêmes que l'écran Abonnement du logiciel et le paiement Stripe.

const TITLE = 'Tarifs | WeboDevis, le logiciel des traiteurs';
const DESCRIPTION = `WeboDevis : ${PRICE_LINE}. La démonstration est gratuite.`;

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PRICING.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: PRICING.label, path: PRICING.href },
];

const DEMO_INCLUDES = [
  'La démo s’ouvre sur un compte déjà rempli',
  'Vous parcourez les devis, les événements, les courses',
];

const FAQS: Faq[] = [
  { q: 'Pourquoi une mise en service ?', a: 'Pour que vous ne partiez pas d’un logiciel vide. Nous le préparons avec vous, avec vos modèles de devis et vos prestations : vos premiers devis partent dès la première semaine. Elle se paie une seule fois, avec le premier mois.' },
  { q: 'Suis-je engagé ?', a: 'Non. Vous arrêtez quand vous voulez, depuis Paramètres, Abonnement, à la fin du mois payé. Vos données restent consultables et exportables, et vous pouvez vous réabonner sans repayer la mise en service.' },
  { q: 'Les prix sont-ils hors taxes ?', a: `Oui. Avec la TVA de 20 % : ${euros(ttc(FIRST_MONTH_HT))} TTC le premier mois, puis ${euros(ttc(MONTHLY_HT))} TTC par mois. Vos factures sont disponibles dans le logiciel.` },
  { q: 'Les brochures sont-elles comprises ?', a: 'L’outil Brochures est dans l’abonnement : vous créez les vôtres sans supplément. Si vous préférez que nous les réalisions pour vous, c’est une prestation à part, sur devis.' },
];

const card = 'flex flex-col rounded-[28px] p-7 md:p-8';

function Step({ n, when, children, className }: { n: number; when: string; children: React.ReactNode; className: string }) {
  return (
    <li className={`${card} ${className}`}>
      <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-[15px] font-semibold text-white">{n}</span>
      <h2 className="mt-5 text-[15px] font-medium text-gray-600">{when}</h2>
      {children}
    </li>
  );
}

function Amount({ value, unit }: { value: string; unit?: string }) {
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
      <span className="font-display text-[44px] leading-[1.05] text-gray-900 tabular-nums">{value}</span>
      {unit && <span className="text-gray-600">{unit}</span>}
    </p>
  );
}

function Included({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((i) => (
        <li key={i} className="flex gap-3 text-base leading-snug text-gray-800">
          <Check className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary-600" aria-hidden />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TarifsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema(crumbs), faqSchema(FAQS)]} />
      <HeroPanel
        crumbs={crumbs}
        title="Un seul prix, en trois étapes"
        lead={`Vous essayez gratuitement. Nous installons le logiciel avec vous. Ensuite, c’est ${euros(MONTHLY_HT)} HT par mois, sans engagement.`}
        demo={false}
      />

      <section aria-label="Le prix, étape par étape" className="pt-8 md:pt-12">
        <div className={`${container} max-w-[1080px]`}>
          <ol className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
            <Step n={1} when="Aujourd’hui" className="bg-sage-100">
              <Amount value="Gratuit" />
              <p className="text-[15px] text-gray-600">Sans carte bancaire</p>
              <Included items={DEMO_INCLUDES} />
              <p className="mt-auto pt-7">
                <DemoButton className="w-full" />
                <TextLink href={DEMO.href} className="md:hidden">{DEMO.label}</TextLink>
              </p>
            </Step>
            <Step n={2} when="Le premier mois, une seule fois" className="bg-white ring-1 ring-black/5">
              <Amount value={euros(FIRST_MONTH_HT)} unit="HT" />
              <p className="text-[15px] text-gray-600">{euros(ttc(FIRST_MONTH_HT))} TTC · mise en service et premier mois compris</p>
              <Included items={SETUP_INCLUDES} />
            </Step>
            <Step n={3} when="Ensuite, chaque mois" className="bg-white ring-1 ring-black/5">
              <Amount value={euros(MONTHLY_HT)} unit="HT" />
              <p className="text-[15px] text-gray-600">{euros(ttc(MONTHLY_HT))} TTC · sans engagement</p>
              <Included items={MONTHLY_INCLUDES} />
            </Step>
          </ol>

          <p className="mt-4 lg:mt-5 rounded-[24px] bg-primary-50 px-7 py-5 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-[15px] text-gray-700">Votre première année, tout compris</span>
            <strong className="font-display text-[28px] font-semibold text-gray-900 tabular-nums">{euros(FIRST_YEAR_HT)} HT</strong>
            <span className="text-[15px] text-gray-700 lg:ml-auto">
              {euros(FIRST_MONTH_HT)} le premier mois, puis 11 mois à {euros(MONTHLY_HT)}. Les années suivantes&nbsp;: {euros(NEXT_YEAR_HT)} HT.
            </span>
          </p>
        </div>
      </section>

      <section aria-labelledby="titre-options" className={sectionGap}>
        <div className={`${container} max-w-[1080px]`}>
          <div className="rounded-[28px] bg-white ring-1 ring-black/5 p-7 md:p-9 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h2 id="titre-options" className="site-h2">En option, sur simple devis</h2>
              <ul className="mt-5 space-y-2 site-body text-gray-700">
                {EXTRAS.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
            <Link href={QUOTE_REQUEST.href} className="inline-flex flex-shrink-0 items-center justify-center h-12 px-6 rounded-2xl border border-gray-300 bg-white text-gray-900 font-semibold hover:border-gray-400 transition-colors">
              {QUOTE_REQUEST.label}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-questions" className={sectionGap}>
        <div className={`${container} max-w-[1080px]`}>
          <h2 id="titre-questions" className="site-h2">Les questions qu’on nous pose</h2>
          <div className="mt-6"><FaqList faqs={FAQS} /></div>
        </div>
      </section>

    </>
  );
}
