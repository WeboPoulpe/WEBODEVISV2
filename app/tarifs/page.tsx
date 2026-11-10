import Link from 'next/link';
import { Check } from 'lucide-react';
import FaqList from '@/components/site/FaqList';
import HeroPanel from '@/components/site/HeroPanel';
import { JsonLd, container, sectionGap } from '@/components/site/ui';
import { pageMetadata } from '@/lib/site/metadata';
import { DEMO, HOME, MIGRATION_REQUEST, PRICING } from '@/lib/site/pages';
import { breadcrumbSchema, faqSchema, type Faq } from '@/lib/site/schema';

// Tarifs de WeboDevis : les mêmes que ceux de la page Abonnement du logiciel (100 € HT par mois, 1 100 € HT par an,
// prix Stripe STRIPE_PRICE_MENSUEL / STRIPE_PRICE_ANNUEL). Les changer ici ET dans Stripe.

const TITLE = 'Tarifs | WeboDevis, le logiciel des traiteurs';
const DESCRIPTION = 'WeboDevis coûte 100 € HT par mois, ou 1 100 € HT par an avec un mois offert. Reprise de vos données existantes sur devis.';

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
  { name: 'Mensuel', price: '100 €', unit: 'HT / mois', ttc: '120 € TTC par mois', note: 'Sans engagement : vous arrêtez quand vous voulez, à la fin du mois payé.' },
  { name: 'Annuel', price: '1 100 €', unit: 'HT / an', ttc: '1 320 € TTC par an', note: 'Un mois offert : onze mois payés pour douze.', badge: '1 mois offert' },
];

const FAQS: Faq[] = [
  { q: 'Y a-t-il un essai gratuit ?', a: 'La démonstration est gratuite et sans inscription : elle s’ouvre sur un compte déjà rempli, avec des données fictives. L’abonnement commence quand vous créez votre compte.' },
  { q: 'Comment arrêter mon abonnement ?', a: 'Depuis Paramètres, Abonnement, en un clic. Vous gardez tout jusqu’à la fin de la période payée. Ensuite, vos données restent consultables et exportables, et vous pouvez vous réabonner quand vous voulez.' },
  { q: 'Les prix sont-ils hors taxes ?', a: 'Oui. La TVA de 20 % s’ajoute : 120 € TTC par mois, ou 1 320 € TTC par an. Vos factures sont disponibles dans le logiciel.' },
  { q: 'Pouvez-vous reprendre les données de mon ancien logiciel ?', a: 'Oui, sur devis. Nous reprenons vos clients, vos prestations et votre catalogue depuis votre logiciel actuel ou vos fichiers, pour que vous commenciez avec vos propres données. Le prix dépend du volume et du format.' },
];

export default function TarifsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema(crumbs), faqSchema(FAQS)]} />
      <HeroPanel
        crumbs={crumbs}
        title="Un prix simple, tout compris"
        lead="Un seul abonnement, avec tout le logiciel. Payez au mois, ou à l’année avec un mois offert."
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
              <p className="mt-1 text-[15px] text-gray-500">{p.ttc}</p>
              <p className="mt-5 site-body text-gray-700">{p.note}</p>
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

      <section aria-labelledby="titre-reprise" className={sectionGap}>
        <div className={`${container} max-w-[960px]`}>
          <div className="rounded-[28px] bg-white ring-1 ring-black/5 p-7 md:p-9 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-primary-700">En option</p>
              <h2 id="titre-reprise" className="site-h2 mt-2">Reprise de vos données, sur devis</h2>
              <p className="site-body text-gray-700 mt-4 max-w-[52ch]">
                Vous avez déjà vos clients, vos prestations et votre catalogue dans un autre logiciel ou dans des fichiers&nbsp;?
                Nous les ajoutons dans WeboDevis pour vous, et vous commencez avec vos propres données. Le prix dépend du volume et du format.
              </p>
            </div>
            <Link href={MIGRATION_REQUEST.href} className="inline-flex flex-shrink-0 items-center justify-center h-12 px-6 rounded-2xl bg-primary text-white font-semibold hover:bg-primary-700 transition-colors">
              {MIGRATION_REQUEST.label}
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
