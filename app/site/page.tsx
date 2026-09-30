import Link from 'next/link';
import DashboardPreview from '@/components/site/DashboardPreview';
import EventPreview from '@/components/site/EventPreview';
import FaqList from '@/components/site/FaqList';
import LinkList from '@/components/site/LinkList';
import { PhoneChecklist, PhoneCourses, PhoneHome, PhoneMission, PhoneQuotes } from '@/components/site/Phone';
import QuotePreview from '@/components/site/QuotePreview';
import RequestPreview from '@/components/site/RequestPreview';
import { DemoButton, JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { RELEASE } from '@/lib/site/config';
import { FEATURE_LIST } from '@/lib/site/features';
import { pageMetadata } from '@/lib/site/metadata';
import { GUIDES } from '@/lib/site/guides';
import { AUDIENCE_LINKS, FEATURES_INDEX, FEATURE_COLUMNS, GUIDES_INDEX, HOME, QUOTE_REQUEST, RELEASES } from '@/lib/site/pages';
import { breadcrumbSchema, faqSchema, organizationSchema, softwareSchema, websiteSchema, type Faq } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';

// L'accueil du site (servi à l'adresse « / » pour un visiteur sans session).
const TITLE = 'WeboDevis : le logiciel des traiteurs, du devis à l’événement';
const DESCRIPTION =
  'Logiciel pour traiteurs : demandes, devis, événements, liste de courses calculée par convive, extras, stock et marge. Sur téléphone, tablette et ordinateur.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: HOME.href });

const two = 'grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-10';

// Les écrans de l'app qu'on fait défiler au doigt : chacun mène à sa page.
const SCREENS = [
  { Screen: PhoneQuotes, href: '/fonctionnalites/devis-traiteur', title: 'Les devis', text: 'Chaque devis avec sa date, son statut et son montant.' },
  { Screen: PhoneChecklist, href: '/fonctionnalites/evenements', title: 'L’événement', text: 'La checklist, le matériel, les courses, les extras.' },
  { Screen: PhoneCourses, href: '/fonctionnalites/liste-de-courses', title: 'Les courses', text: 'La liste à cocher, rayon par rayon.' },
  { Screen: PhoneMission, href: '/fonctionnalites/extras', title: 'La mission d’un extra', text: 'Ce que votre extra voit en ouvrant son lien.' },
];

const FAQS: Faq[] = [
  { q: 'À qui s’adresse WeboDevis ?', a: 'Aux traiteurs, qu’ils travaillent seuls ou en équipe : mariages, réceptions privées, événements d’entreprise, séminaires. Le logiciel suit une affaire de la demande reçue jusqu’à l’événement servi.' },
  { q: 'Quand WeboDevis sort-il ?', a: `La version ${RELEASE.version}, première version publique, sort le ${RELEASE.dateLabel}. La page Nouveautés détaille ce qu’elle contient.` },
  { q: 'Peut-on essayer le logiciel avant sa sortie ?', a: 'Oui. Vous laissez votre nom, votre email et votre téléphone, puis la démonstration s’ouvre sur un compte déjà rempli de données fictives, pour parcourir les devis, les événements et la liste de courses. Rien de ce que vous y modifiez n’est enregistré : ce compte ne sert pas à travailler sur vos vraies données.' },
  { q: 'Combien coûte WeboDevis ?', a: 'Les tarifs ne sont pas encore publiés. Vous pouvez demander un devis depuis la page Contact, en indiquant la taille de votre équipe.' },
  { q: 'Faut-il installer quelque chose ?', a: 'Non. WeboDevis s’ouvre dans un navigateur, sur ordinateur, tablette et téléphone. Sur téléphone, vous pouvez l’ajouter à l’écran d’accueil pour l’ouvrir comme une application. Une connexion internet est nécessaire.' },
  { q: 'Mon client doit-il créer un compte pour lire son devis ?', a: 'Non. Il reçoit un email avec un lien, ouvre le devis en ligne, et peut l’imprimer ou l’enregistrer en PDF.' },
  { q: 'Puis-je garder mes anciens devis ?', a: 'Oui. Un devis fait ailleurs s’importe avec son client, sa date, son montant et son fichier d’origine, conservé tel quel.' },
];

const crumbs = [{ name: HOME.label, path: HOME.href }];

export default function SitePage() {
  return (
    <>
      <JsonLd data={[
        organizationSchema(),
        websiteSchema(),
        softwareSchema({ path: HOME.href, description: DESCRIPTION, features: FEATURE_LIST }),
        breadcrumbSchema(crumbs),
        faqSchema(FAQS),
      ]} />

      {/* ── Ouverture : le titre en très grand, puis le produit qui sort du panneau vert ── */}
      <section className="relative">
        <div aria-hidden className="absolute inset-x-2 sm:inset-x-2.5 -top-px bottom-[310px] md:bottom-48 lg:bottom-64 rounded-b-[28px] bg-forest" />
        <div className={`${container} relative`}>
          <div className="site-dark grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-x-14 gap-y-6 lg:items-end pt-7 sm:pt-12 lg:pt-16">
            <div>
              <h1 className="site-hero-title font-display text-white">Le logiciel des&nbsp;traiteurs.</h1>
              <p className="site-tagline font-display text-primary-300 mt-5 lg:mt-7 max-w-[17ch] sm:max-w-none">Du premier devis au dernier couvert servi.</p>
            </div>
            <div className="lg:pb-2">
              <p className="site-lead text-white/70 max-w-[46ch]">
                Les demandes, les devis, les événements, les courses et l’équipe se préparent au même endroit, sur le téléphone comme au bureau.
              </p>
              <DemoButton className="mt-7" />
              <p className="text-[15px] leading-relaxed text-white/60 mt-5 md:mt-6 max-w-[46ch]">
                Sortie de la version {RELEASE.version} le {RELEASE.dateLabel}.{' '}
                <Link href={RELEASES.href} className="rounded text-white underline decoration-white/40 underline-offset-4 hover:decoration-white whitespace-nowrap">Voir ce qu’elle contient</Link>
              </p>
            </div>
          </div>

          {/* Téléphone : l'app dans sa main. À partir de la tablette : le tableau de bord. */}
          <div className="md:hidden flex justify-center mt-9">
            <PhoneHome className="site-settle" />
          </div>
          <DashboardPreview className="hidden md:flex site-settle mt-12 lg:mt-16" />
          <p className="text-sm text-gray-500 mt-4 text-center md:text-left">
            Les écrans de ce site sont des aperçus, remplis avec des données d’exemple.
          </p>
        </div>
      </section>

      {/* ── Le parcours d'une affaire : demande, devis, événement ── */}
      <section id="demandes" aria-labelledby="titre-demandes" className={sectionGap}>
        <div className={`${container} ${two} lg:items-center`}>
          <div>
            <h2 id="titre-demandes" className="site-h2">Les demandes arrivent directement dans l’application.</h2>
            <p className="site-body text-gray-700 mt-6 max-w-[52ch]">
              Vos futurs clients remplissent un formulaire à votre nom, à partager par lien ou à intégrer à votre site. Chaque demande s’enregistre avec la date, le type d’événement et le nombre de personnes&nbsp;: il ne reste plus qu’à en faire un devis.
            </p>
            <p className="site-body text-gray-700 mt-4 max-w-[52ch]">
              Vous êtes prévenu par email, et la personne qui vous écrit reçoit un accusé de réception.
            </p>
            <p className="mt-6"><TextLink href="/fonctionnalites/demandes-de-devis">Les demandes de devis, en détail</TextLink></p>
          </div>
          <RequestPreview />
        </div>
      </section>

      <section id="devis" aria-labelledby="titre-devis" className={sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-16 gap-y-10 lg:items-center`}>
          <div className="lg:order-2">
            <h2 id="titre-devis" className="site-h2">Un devis soigné, envoyé en un lien.</h2>
            <p className="site-body text-gray-700 mt-6 max-w-[52ch]">
              Trois étapes suffisent à créer le devis&nbsp;: l’événement, le client, le style. L’éditeur vous laisse ensuite reprendre le texte et la mise en page. Vos modèles évitent de repartir de zéro, et les dossiers gardent vos devis rangés.
            </p>
            <p className="site-body text-gray-700 mt-4 max-w-[52ch]">
              Votre client reçoit un email avec un lien&nbsp;: il consulte le devis en ligne, l’imprime ou l’enregistre en PDF. De votre côté, le statut suit l’affaire, du devis à faire jusqu’au paiement.
            </p>
            <p className="mt-6"><TextLink href="/fonctionnalites/devis-traiteur">Les devis, en détail</TextLink></p>
          </div>
          <QuotePreview className="lg:order-1" />
        </div>
      </section>

      <section id="evenements" aria-labelledby="titre-evenements" className={sectionGap}>
        <div className={container}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-6 lg:items-start">
            <h2 id="titre-evenements" className="site-h2 max-w-[18ch]">Devis validé&nbsp;: l’événement est prêt à préparer.</h2>
            <div>
              <p className="site-body text-gray-700 max-w-[56ch]">
                Un devis validé devient un événement, avec sa checklist, son matériel et sa location, sa liste de courses et ses extras. Chaque extra dispose d’un lien où il retrouve ses missions.
              </p>
              <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                <TextLink href="/fonctionnalites/evenements">Les événements, en détail</TextLink>
                <TextLink href="/fonctionnalites/extras">Les extras</TextLink>
              </p>
            </div>
          </div>
          <EventPreview className="mt-10 lg:mt-14" />
        </div>
      </section>

      {/* ── Le calcul des courses : le moment fort du produit, en très grand ── */}
      <section aria-labelledby="titre-courses" className="site-dark mx-2 sm:mx-2.5 mt-20 md:mt-28 lg:mt-36 rounded-[28px] bg-forest text-white overflow-hidden">
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-x-16 pt-14 md:pt-20 lg:pt-24`}>
          <div className="pb-12 md:pb-20 lg:pb-24">
            <h2 id="titre-courses" className="site-h2 max-w-[16ch]">La liste de courses se calcule à partir du devis.</h2>
            <p aria-label="180 grammes par personne, multipliés par 120 couverts, font 21,6 kilos." className="font-display mt-10 md:mt-14">
              <span aria-hidden className="site-figure block text-white">180 g</span>
              <span aria-hidden className="site-figure block text-white/40">× 120</span>
              <span aria-hidden className="site-figure block text-primary-300">21,6 kg</span>
            </p>
            <p className="text-[15px] text-white/55 mt-5">Filet de bœuf, mariage de 120 couverts. Données d’exemple.</p>
            <p className="site-body text-white/75 mt-8 max-w-[52ch]">
              Chaque prestation de votre catalogue porte ses ingrédients et leur quantité par personne. WeboDevis les multiplie par le nombre de couverts, additionne ce qui revient dans plusieurs plats, et range la liste par fournisseur.
            </p>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-base font-semibold">
              <Link href="/fonctionnalites/liste-de-courses" className="rounded text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">La liste de courses, en détail</Link>
              <Link href="/guides/calculer-quantites-par-convive" className="rounded text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">Guide&nbsp;: les quantités par convive</Link>
            </p>
          </div>
          <div className="hidden lg:flex items-end h-full">
            <PhoneCourses className="-mb-24" />
          </div>
        </div>
      </section>

      {/* ── L'app, écran par écran : à faire défiler au doigt ── */}
      <section aria-labelledby="titre-ecrans" className={sectionGap}>
        <div className={container}>
          <h2 id="titre-ecrans" className="site-h2 max-w-[16ch]">L’application, écran par écran.</h2>
          <p className="site-body text-gray-700 mt-5 max-w-[52ch]">
            Sur téléphone, WeboDevis s’ajoute à l’écran d’accueil et s’ouvre en plein écran. Au centre de la barre, le «&nbsp;+&nbsp;» crée un devis.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[1240px] lg:px-8 mt-9 md:mt-12">
          <ul className="site-rail gap-5 px-5 sm:px-8 pb-2 lg:grid lg:grid-cols-4 lg:gap-6 lg:px-0">
            {SCREENS.map(({ Screen, href, title, text }) => (
              <li key={href} className="w-[288px] lg:w-auto">
                <Screen />
                <Link href={href} className="group block mt-5 px-1 rounded-lg">
                  <span className="block font-display text-xl font-semibold tracking-[-0.01em] text-gray-900 underline-offset-4 group-hover:underline">{title}</span>
                  <span className="block text-base leading-relaxed text-gray-600 mt-1">{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={container}>
          <p className="mt-8"><TextLink href="/fonctionnalites/application-mobile">L’application mobile, en détail</TextLink></p>
        </div>
      </section>

      {/* ── Toutes les fonctionnalités, par étape du métier ── */}
      <section id="fonctionnalites" aria-labelledby="titre-fonctions" className="site-dark mx-2 sm:mx-2.5 mt-20 md:mt-28 lg:mt-36 rounded-[28px] bg-forest text-white">
        <div className={`${container} py-14 md:py-20 lg:py-24`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <h2 id="titre-fonctions" className="site-h1 font-display max-w-[12ch]">Tout ce que fait WeboDevis.</h2>
            <p>
              <Link href={FEATURES_INDEX.href} className="rounded text-base font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">La vue d’ensemble</Link>
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-10 mt-10 md:mt-14">
            {FEATURE_COLUMNS.map((group) => (
              <div key={group.title}>
                <h3 className="text-base text-white/55 pb-3">{group.title}</h3>
                <LinkList links={group.links} columns={1} tone="dark" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pour qui ── */}
      <section aria-labelledby="titre-pour-qui" className={sectionGap}>
        <div className={container}>
          <h2 id="titre-pour-qui" className="site-h2">Pour quel traiteur&nbsp;?</h2>
          <LinkList links={AUDIENCE_LINKS} columns={3} className="mt-8 md:mt-10" />
        </div>
      </section>

      {/* ── Sortie de la version 0.1 ── */}
      <section aria-labelledby="titre-sortie" className={sectionGap}>
        <div className={container}>
          <div className="rounded-[28px] bg-white border border-gray-200 px-6 py-10 sm:px-10 md:py-14 lg:px-16 grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-x-16 gap-y-7 lg:items-end">
            <div>
              <p className="text-base text-gray-600">Sortie de la version {RELEASE.version}</p>
              <h2 id="titre-sortie" className="site-h1 font-display mt-3">
                <time dateTime={RELEASE.date}>{RELEASE.dateLabel}</time>
              </h2>
            </div>
            <div>
              <p className="site-body text-gray-700 max-w-[46ch]">
                La première version publique couvre le métier d’un bout à l’autre&nbsp;: demandes, devis, événements, liste de courses, extras, stock, calendrier et suivi financier.
              </p>
              <p className="site-body text-gray-700 mt-4 max-w-[46ch]">
                D’ici là, la démonstration est ouverte, sur un compte rempli de données fictives.
              </p>
              <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <DemoButton />
                <TextLink href={RELEASES.href}>Ce que contient la version {RELEASE.version}</TextLink>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guides : des couvertures à faire défiler ── */}
      <section aria-labelledby="titre-guides" className={sectionGap}>
        <div className={`${container} flex flex-wrap items-end justify-between gap-x-10 gap-y-4`}>
          <div>
            <h2 id="titre-guides" className="site-h2 max-w-[13ch]">Des guides écrits pour le métier.</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[44ch]">
              Des méthodes à appliquer dès le prochain événement, avec ou sans logiciel.
            </p>
          </div>
          <p><TextLink href={GUIDES_INDEX.href}>Tous les guides</TextLink></p>
        </div>
        <div className="mx-auto w-full max-w-[1240px] lg:px-8 mt-9 md:mt-12">
          <ul className="site-rail gap-3 px-5 sm:px-8 pb-2 lg:grid lg:grid-cols-5 lg:px-0">
            {GUIDES.map((g) => (
              <li key={g.slug} className="w-[272px] lg:w-auto">
                <Link href={g.href} className="group flex flex-col h-full min-h-[300px] lg:min-h-[340px] rounded-3xl bg-white border border-gray-200 p-6 hover:border-gray-300 transition-colors">
                  <span className="text-sm text-gray-500">{g.minutes} min de lecture</span>
                  <span className="block font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.02em] text-gray-900 mt-4 underline-offset-4 decoration-2 group-hover:underline">{fr(g.title)}</span>
                  <span className="block text-[15px] leading-relaxed text-gray-600 mt-auto pt-6">{fr(g.blurb)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Questions fréquentes ── */}
      <section aria-labelledby="titre-questions" className={sectionGap}>
        <div className={`${container} ${two}`}>
          <div>
            <h2 id="titre-questions" className="site-h2 max-w-[12ch]">Questions fréquentes</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[36ch]">
              Une autre question, ou besoin d’une proposition pour votre maison ? <TextLink href={QUOTE_REQUEST.href}>{QUOTE_REQUEST.label}</TextLink>
            </p>
          </div>
          <FaqList faqs={FAQS} />
        </div>
      </section>
    </>
  );
}
