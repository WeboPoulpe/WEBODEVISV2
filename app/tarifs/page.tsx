import Link from 'next/link';
import { Check } from 'lucide-react';
import FaqList from '@/components/site/FaqList';
import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, container, sectionGap } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { DEMO, HOME, QUOTE_REQUEST, PRICING } from '@/lib/site/pages';
import { FIRST_MONTH_HT, MONTHLY_HT, SETUP_HT, SETUP_INCLUDES, YEARLY_BONUS, YEARLY_HT, euros, ttc } from '@/lib/pricing';
import { breadcrumbSchema, faqSchema, type Faq } from '@/lib/site/schema';

// Tarifs de WeboDevis : montants dans lib/pricing, les mêmes que l'écran Abonnement du logiciel et le paiement Stripe.

const TITLE = 'Tarifs | WeboDevis, le logiciel des traiteurs';
const DESCRIPTION = `WeboDevis : ${euros(FIRST_MONTH_HT)} HT le premier mois, mise en service comprise (formation, modèles de devis, import de vos clients), puis ${euros(MONTHLY_HT)} HT par mois.`;

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PRICING.href });

const crumbs = [
  { name: HOME.label, path: HOME.href },
  { name: PRICING.label, path: PRICING.href },
];

const INCLUDED = [
  'Tout le logiciel : devis, factures, événements, production, stock, brochures',
  '200 WeboCoins chaque mois pour Webo, l’assistant',
  'Les mises à jour, sans supplément',
  'Vos données exportables à tout moment',
];

const PLANS = [
  {
    name: 'Mensuel', price: euros(FIRST_MONTH_HT), unit: 'HT le premier mois',
    then: `puis ${euros(MONTHLY_HT)} HT par mois`,
    ttc: `${euros(ttc(FIRST_MONTH_HT))} TTC, puis ${euros(ttc(MONTHLY_HT))} TTC par mois`,
    note: 'Mise en service comprise. Ensuite, sans engagement : vous arrêtez quand vous voulez, à la fin du mois payé.',
    bonus: [] as string[],
    badge: undefined as string | undefined,
  },
  {
    name: 'Annuel', price: euros(YEARLY_HT), unit: 'HT par an',
    then: `+ mise en service de ${euros(SETUP_HT)} HT, la première année`,
    ttc: `${euros(ttc(YEARLY_HT))} TTC par an`,
    note: 'Onze mois payés pour douze, avec en plus :',
    bonus: YEARLY_BONUS,
    badge: '1 mois offert',
  },
];

const EXTRAS = [
  'La création de vos brochures',
  'La reprise de vos anciens devis, de votre catalogue ou d’un autre logiciel',
  'Toute autre prestation en dehors de la mise en service',
];

const FAQS: Faq[] = [
  { q: 'Que comprend la mise en service ?', a: `Une formation à la prise en main, deux modèles de devis de mariage, deux modèles de devis traiteur (cocktail ou à emporter), la création des prestations qui vont avec et l’import de vos clients. Elle se paie une seule fois, au premier abonnement : ${euros(SETUP_HT)} HT, soit ${euros(FIRST_MONTH_HT)} HT le premier mois en formule mensuelle.` },
  { q: 'Y a-t-il un essai gratuit ?', a: 'La démonstration est gratuite et sans inscription : elle s’ouvre sur un compte déjà rempli, avec des données fictives. L’abonnement commence quand vous créez votre compte.' },
  { q: 'Comment arrêter mon abonnement ?', a: 'Depuis Paramètres, Abonnement, en un clic. Vous gardez tout jusqu’à la fin de la période payée. Ensuite, vos données restent consultables et exportables, et vous pouvez vous réabonner quand vous voulez, sans repayer la mise en service.' },
  { q: 'Les prix sont-ils hors taxes ?', a: `Oui. La TVA de 20 % s’ajoute : ${euros(ttc(FIRST_MONTH_HT))} TTC le premier mois puis ${euros(ttc(MONTHLY_HT))} TTC par mois, ou ${euros(ttc(YEARLY_HT))} TTC par an. Vos factures sont disponibles dans le logiciel.` },
  { q: 'Les brochures sont-elles comprises ?', a: 'L’outil Brochures est dans l’abonnement : vous créez les vôtres sans supplément. Si vous préférez que nous les réalisions pour vous, c’est une prestation à part, sur devis.' },
];

export default function TarifsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema(crumbs), faqSchema(FAQS)]} />
      <HeroPanel
        crumbs={crumbs}
        title="Un prix simple, tout compris"
        lead="Nous mettons votre compte en place avec vous, puis un seul abonnement avec tout le logiciel. Au mois, ou à l’année avec un mois offert."
      />

      <section aria-label="Formules" className="pt-10 md:pt-16">
        <div className={`${container} grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-[960px]`}>
          {PLANS.map((p) => (
            <div key={p.name} className="rounded-[28px] bg-white ring-1 ring-black/5 p-7 md:p-9">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900">{p.name}</h2>
                {p.badge && <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-800">{p.badge}</span>}
              </div>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl text-gray-900 tabular-nums">{p.price}</span>
                <span className="text-gray-600">{p.unit}</span>
              </p>
              <p className="mt-1 font-medium text-gray-800">{p.then}</p>
              <p className="mt-1 text-[15px] text-gray-500">{p.ttc}</p>
              <p className="mt-5 site-body text-gray-700">{p.note}</p>
              {p.bonus.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {p.bonus.map((b) => (
                    <li key={b} className="flex gap-3 site-body text-gray-800">
                      <Check className="h-5 w-5 mt-1 flex-shrink-0 text-primary-600" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className={`${container} max-w-[960px] mt-8`}>
          <h2 className="site-h2">Inclus dans les deux formules</h2>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-3 site-body text-gray-800">
                <Check className="h-5 w-5 mt-1 flex-shrink-0 text-primary-600" aria-hidden />
                <span>{i}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 site-body text-gray-700">
            Avant de vous décider, <Link href={DEMO.href} className="underline underline-offset-4 text-primary-700">essayez la démonstration</Link>&nbsp;: elle est gratuite et sans inscription.
          </p>
        </div>
      </section>

      <section aria-labelledby="titre-mise-en-service" className={sectionGap}>
        <div className={`${container} max-w-[960px]`}>
          <div className="rounded-[28px] bg-white ring-1 ring-black/5 p-7 md:p-9">
            <p className="text-sm font-medium text-primary-700">Au démarrage, une seule fois</p>
            <h2 id="titre-mise-en-service" className="site-h2 mt-2">La mise en service</h2>
            <p className="site-body text-gray-700 mt-4 max-w-[60ch]">
              Vous ne partez pas d’un compte vide&nbsp;: nous préparons WeboDevis avec vous, pour que vos premiers devis partent dès la première semaine.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {SETUP_INCLUDES.map((i) => (
                <li key={i} className="flex gap-3 site-body text-gray-800">
                  <Check className="h-5 w-5 mt-1 flex-shrink-0 text-primary-600" aria-hidden />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-[28px] bg-white ring-1 ring-black/5 p-7 md:p-9 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-primary-700">En plus, sur devis</p>
              <h2 className="site-h2 mt-2">Le reste, à la demande</h2>
              <ul className="mt-4 space-y-2 site-body text-gray-700">
                {EXTRAS.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
            <Link href={QUOTE_REQUEST.href} className="inline-flex flex-shrink-0 items-center justify-center h-12 px-6 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-700 transition-colors">
              {QUOTE_REQUEST.label}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-questions" className={sectionGap}>
        <div className={`${container} max-w-[960px]`}>
          <h2 id="titre-questions" className="site-h2">Questions fréquentes</h2>
          <div className="mt-6"><FaqList faqs={FAQS} /></div>
        </div>
      </section>
    </>
  );
}
