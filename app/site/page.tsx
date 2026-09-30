import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import DashboardPreview from '@/components/site/DashboardPreview';
import RequestPreview from '@/components/site/RequestPreview';
import QuotePreview from '@/components/site/QuotePreview';
import EventPreview from '@/components/site/EventPreview';
import PhonePreview from '@/components/site/PhonePreview';

const TITLE = 'WeboDevis, le logiciel de devis et d’événements pour les traiteurs';
const DESCRIPTION =
  'Demandes, devis, événements, liste de courses et équipe : WeboDevis réunit le métier de traiteur dans un seul outil, sur téléphone, tablette et ordinateur.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'WeboDevis',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const container = 'mx-auto w-full max-w-[1240px] px-5 sm:px-8';
const cta =
  'inline-flex items-center justify-center h-[52px] px-7 rounded-2xl bg-primary text-white text-base font-semibold hover:bg-primary-dark active:scale-[0.99] transition';

// Ce qui sert tous les jours, en dehors du devis et de l'événement.
const DAILY = [
  { term: 'Calendrier', text: 'Vos événements et vos devis en cours, placés sur leurs dates.' },
  { term: 'Clients', text: 'Particuliers et entreprises, avec leurs coordonnées à portée de main.' },
  { term: 'Prestations et ingrédients', text: 'Votre carte, et pour chaque prestation les ingrédients qui la composent.' },
  { term: 'Stock', text: 'Ce que vous avez en réserve, et ce qui commence à manquer.' },
  { term: 'Fournisseurs', text: 'Vos fournisseurs et les commandes que vous leur passez.' },
  { term: 'Suivi financier', text: 'Les coûts de chaque devis, et la marge qu’il vous laisse.' },
];

export default function SitePage() {
  return (
    <>
      {/* En-tête : le haut du panneau vert sapin */}
      <div className="site-dark mx-2 mt-2 sm:mx-2.5 sm:mt-2.5 rounded-t-[28px] bg-forest">
        <div className={container}>
          <SiteHeader tone="dark" sections />
        </div>
      </div>

      <main id="contenu">
        {/* ── Ouverture : la promesse, puis le tableau de bord qui sort du panneau ── */}
        <section className="relative">
          <div aria-hidden className="absolute inset-x-2 sm:inset-x-2.5 -top-px bottom-40 md:bottom-48 lg:bottom-64 rounded-b-[28px] bg-forest" />
          <div className={`${container} relative`}>
            <div className="site-dark grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-x-14 gap-y-7 lg:items-end pt-10 sm:pt-14 lg:pt-20">
              <h1 className="site-h1 font-display text-white">Du premier devis au dernier couvert servi.</h1>
              <div className="lg:pb-2">
                <p className="site-lead text-white/70 max-w-[46ch]">
                  WeboDevis est le logiciel des traiteurs. Les demandes, les devis, les événements, les courses et l’équipe se préparent au même endroit.
                </p>
                <Link href="/register" className={`${cta} mt-7`}>Créer un compte</Link>
              </div>
            </div>

            <DashboardPreview className="site-settle mt-12 lg:mt-16" />
            <p className="text-sm text-gray-500 mt-4">
              Le tableau de bord. Tous les écrans de cette page sont des aperçus, remplis avec des données d’exemple.
            </p>
          </div>
        </section>

        {/* ── Demandes ── */}
        <section id="demandes" aria-labelledby="titre-demandes" className="pt-24 lg:pt-36">
          <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-10 lg:items-center`}>
            <div>
              <h2 id="titre-demandes" className="site-h2">Les demandes arrivent directement dans l’application.</h2>
              <p className="site-body text-gray-700 mt-6 max-w-[52ch]">
                Vous intégrez un formulaire sur votre site. Chaque demande s’enregistre dans WeboDevis avec la date, le type d’événement et le nombre de couverts : il ne reste plus qu’à en faire un devis.
              </p>
              <p className="site-body text-gray-700 mt-4 max-w-[52ch]">
                Vous êtes prévenu par email, et la personne qui vous écrit reçoit un accusé de réception.
              </p>
            </div>
            <RequestPreview />
          </div>
        </section>

        {/* ── Devis ── */}
        <section id="devis" aria-labelledby="titre-devis" className="pt-24 lg:pt-36">
          <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-16 gap-y-10 lg:items-center`}>
            <div className="lg:order-2">
              <h2 id="titre-devis" className="site-h2">Un devis soigné, envoyé en un lien.</h2>
              <p className="site-body text-gray-700 mt-6 max-w-[52ch]">
                La création guidée vous mène du client aux prestations. L’éditeur de document vous laisse ensuite reprendre le texte et la mise en page. Vos modèles évitent de repartir de zéro, et les dossiers gardent vos devis rangés.
              </p>
              <p className="site-body text-gray-700 mt-4 max-w-[52ch]">
                Votre client reçoit un email avec un lien : il consulte le devis en ligne et peut l’enregistrer en PDF. De votre côté, le statut suit l’affaire, du devis à faire jusqu’au paiement.
              </p>
            </div>
            <QuotePreview className="lg:order-1" />
          </div>
        </section>

        {/* ── Événements ── */}
        <section id="evenements" aria-labelledby="titre-evenements" className="pt-24 lg:pt-36">
          <div className={container}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-6 lg:items-start">
              <h2 id="titre-evenements" className="site-h2 max-w-[18ch]">Devis validé : l’événement est prêt à préparer.</h2>
              <div>
                <p className="site-body text-gray-700 max-w-[56ch]">
                  Un devis confirmé devient un événement, avec sa checklist, son matériel et sa location, ses commandes fournisseurs et ses extras, qui reçoivent chacun un lien vers leur mission.
                </p>
                <p className="site-body text-gray-700 mt-4 max-w-[56ch]">
                  La liste de courses se calcule à partir des prestations du devis : la quantité prévue par convive, multipliée par le nombre de convives.
                </p>
              </div>
            </div>
            <EventPreview className="mt-10 lg:mt-14" />
          </div>
        </section>

        {/* ── Au quotidien ── */}
        <section id="quotidien" aria-labelledby="titre-quotidien" className="pt-24 lg:pt-36">
          <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-8`}>
            <h2 id="titre-quotidien" className="site-h2 max-w-[16ch]">Et tout ce qui fait tourner la maison.</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
              {DAILY.map((d) => (
                <div key={d.term} className="py-5 border-t border-gray-300/70">
                  <dt className="font-display text-xl font-semibold text-gray-900 tracking-[-0.01em]">{d.term}</dt>
                  <dd className="text-base leading-relaxed text-gray-600 mt-1.5">{d.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Partout ── */}
        <section aria-labelledby="titre-partout" className="pt-24 lg:pt-36">
          <div className={container}>
            <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-x-16 lg:gap-x-24 rounded-[28px] bg-white border border-gray-200 overflow-hidden px-6 sm:px-10 lg:px-20">
              <div className="order-2 md:order-1 flex justify-center h-[400px] md:h-[500px] pt-10 md:pt-16">
                <PhonePreview />
              </div>
              <div className="order-1 md:order-2 self-center pt-10 md:py-14">
                <h2 id="titre-partout" className="site-h2 max-w-[17ch]">Au bureau, en cuisine, sur le lieu de réception.</h2>
                <p className="site-body text-gray-700 mt-6 max-w-[48ch]">
                  WeboDevis s’installe sur l’écran d’accueil de votre téléphone, comme une application, et s’utilise aussi sur tablette et sur ordinateur.
                </p>
                <p className="site-body text-gray-700 mt-4 max-w-[48ch]">Vos données sont hébergées en Europe.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Clôture et pied de page : le second panneau vert sapin ── */}
      <div className="site-dark mx-2 mb-2 sm:mx-2.5 sm:mb-2.5 mt-24 lg:mt-36 rounded-[28px] bg-forest text-white">
        <div className={container}>
          <section aria-labelledby="titre-commencer" className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8 pt-16 pb-14 lg:pt-24 lg:pb-20">
            <h2 id="titre-commencer" className="site-h1 font-display max-w-[18ch]">Votre prochain devis peut partir d’ici.</h2>
            <Link href="/register" className={`${cta} lg:mb-3`}>Créer un compte</Link>
          </section>
          <div className="pb-7">
            <SiteFooter tone="dark" />
          </div>
        </div>
      </div>
    </>
  );
}
