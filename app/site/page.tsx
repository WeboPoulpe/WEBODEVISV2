import Link from 'next/link';
import { Check } from 'lucide-react';
import CoursesCalculator from '@/components/site/CoursesCalculator';
import FaqList from '@/components/site/FaqList';
import Testimonial from '@/components/site/Testimonial';
import AutoChecklist from '@/components/site/story/AutoChecklist';
import CrewPhones from '@/components/site/story/CrewPhones';
import Julien from '@/components/site/story/Julien';
import HeroVideo from '@/components/site/HeroVideo';
import MarginCounter from '@/components/site/story/MarginCounter';
import QuoteStepper from '@/components/site/story/QuoteStepper';
import SignedMessages from '@/components/site/story/SignedMessages';
import Van from '@/components/site/story/Van';
import WeekBar from '@/components/site/story/WeekBar';
import { DemoButton, JsonLd, TextLink, container, sectionGap } from '@/components/site/ui';
import { EXTRAS, FIRST_MONTH_HT, MONTHLY_HT, MONTHLY_INCLUDES, PRICE_LINE, SETUP_INCLUDES, SETUP_PROMISE, euros } from '@/lib/pricing';
import { RELEASE } from '@/lib/site/config';
import { FEATURE_LIST, featureBySlug } from '@/lib/site/features';
import { pageMetadata } from '@/lib/site/metadata';
import { GUIDES_INDEX, HOME, PRICING, QUOTE_REQUEST } from '@/lib/site/pages';
import { breadcrumbSchema, faqSchema, organizationSchema, softwareSchema, websiteSchema, type Faq } from '@/lib/site/schema';
import { INVOICED, SENT, STORY } from '@/lib/site/story';

// L'accueil du site (servi à l'adresse « / » pour un visiteur sans session).
// Il raconte la semaine de Julien, un traiteur inventé : chaque jour montre ce que le logiciel change, avec un seul
// lien vers la page détaillée. L'histoire mène au tarif, puis à la démonstration. Chiffres : lib/site/story.
const TITLE = 'WeboDevis : le logiciel des traiteurs, du devis à l’événement';
const DESCRIPTION =
  'Logiciel pour traiteurs : brochure en ligne, devis signés en ligne, événements, liste de courses calculée par convive, extras, factures et l’assistant Webo. Sur téléphone, tablette et ordinateur.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: HOME.href });

const two = 'grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-10 lg:items-center';
const when = 'text-sm font-semibold uppercase tracking-[0.06em]';
const before = 'mt-6 max-w-[40ch] border-l-[3px] border-primary-300 pl-4 font-display text-[19px] italic leading-snug';
const darkLink = 'rounded text-base font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white';
/** Julien à côté d'un visuel : devant lui sur grand écran, posé dessus sur téléphone. */
const stage = 'flex flex-col items-start md:flex-row md:items-end';
const stageFigure = 'relative z-10 ml-3 -mb-4 w-[112px] flex-shrink-0 md:ml-0 md:mb-0 md:-mr-5 md:w-[150px]';

/** « Pour aller plus loin » : les fonctions, rangées comme un traiteur range son métier. */
const MORE: { title: string; slugs: string[] }[] = [
  { title: 'Gestion commerciale', slugs: ['demandes-de-devis', 'brochures-traiteur', 'devis-traiteur', 'signature-devis-en-ligne', 'clients', 'assistant-webo'] },
  { title: 'Organisation', slugs: ['evenements', 'liste-de-courses', 'extras', 'stock-et-fournisseurs', 'allergenes', 'application-mobile'] },
  { title: 'Gestion', slugs: ['calendrier', 'facturation', 'facture-electronique', 'suivi-financier', 'equipe'] },
];

const FAQS: Faq[] = [
  { q: 'À qui s’adresse WeboDevis ?', a: 'Aux traiteurs, qu’ils travaillent seuls ou en équipe : mariages, réceptions privées, événements d’entreprise, séminaires. Le logiciel suit une affaire de la demande reçue jusqu’à la facture payée.' },
  { q: 'Combien coûte WeboDevis ?', a: `${PRICE_LINE}. La démonstration est gratuite. La page Tarifs détaille tout.` },
  { q: 'Faut-il installer quelque chose ?', a: 'Non. WeboDevis s’ouvre dans un navigateur, sur ordinateur, tablette et téléphone. Sur téléphone, vous pouvez l’ajouter à l’écran d’accueil pour l’ouvrir comme une application.' },
  { q: 'Peut-on essayer le logiciel avant de s’abonner ?', a: `Oui. La démonstration est gratuite, sans carte bancaire : vous laissez votre nom, votre email et votre téléphone, puis elle s’ouvre sur un compte déjà rempli de données fictives. La version ${RELEASE.version}, première version publique, sort le ${RELEASE.dateLabel}.` },
  { q: 'Puis-je garder mes anciens devis ?', a: 'Oui. Un devis fait ailleurs s’importe avec son client, sa date, son montant et son fichier d’origine, conservé tel quel. Si vous préférez que nous reprenions vos clients et vos devis pour vous, c’est une option, sur devis.' },
];

const crumbs = [{ name: HOME.label, path: HOME.href }];

function Included({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((i) => (
        <li key={i} className="flex gap-3 text-base leading-snug text-white/85">
          <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-300" aria-hidden />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SitePage() {
  return (
    <div className="story">
      <JsonLd data={[
        organizationSchema(),
        websiteSchema(),
        softwareSchema({ path: HOME.href, description: DESCRIPTION, features: FEATURE_LIST }),
        breadcrumbSchema(crumbs),
        faqSchema(FAQS),
      ]} />

      {/* ── Lundi, 7 h 30 : les demandes du week-end ── */}
      <section id="lun" aria-labelledby="titre-lun" className="relative">
        <div aria-hidden className="absolute inset-x-2 sm:inset-x-2.5 -top-px bottom-0 rounded-b-[28px] bg-forest" />
        <div className={`${container} relative site-dark`}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-x-12 gap-y-8 pt-7 sm:pt-12 lg:pt-16 pb-10 lg:pb-14">
            <div className="lg:self-end">
              <h1 id="titre-lun" className="site-hero-title site-hero-title-side font-display text-white">
                Le logiciel des&nbsp;<span className="site-swoosh">traiteurs
                  <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none">
                    <path d="M4 16 C 70 4, 160 2, 296 12" pathLength="1" fill="none" stroke="rgb(var(--p-400))" strokeWidth="9" strokeLinecap="round" />
                  </svg>
                </span>.
              </h1>
              <p className="site-lead text-white/75 mt-6 lg:mt-8 max-w-[44ch]">
                Clé en main, de la demande à la facturation, en passant par l’organisation. Suivez la semaine de Julien, traiteur à Troyes.
              </p>
            </div>
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center">
              <HeroVideo />
              {/* Le début de l'histoire, sous la vidéo : la voix de Julien. */}
              <div className="mt-6 flex items-center gap-4">
                <Julien pose="cafe" disc="dark" title="Julien, traiteur, son café dans une main et son téléphone dans l’autre" className="w-[72px] flex-shrink-0 sm:w-[88px]" />
                <div className="border-l-[3px] border-primary-400 pl-4">
                  <p className={`${when} text-primary-300`}>Lundi, 7&nbsp;h&nbsp;30</p>
                  <p className="text-base leading-relaxed text-white/75 mt-1 max-w-[44ch]">
                    «&nbsp;Six demandes sont arrivées ce week-end. Je dormais. Ma brochure, elle, a travaillé.&nbsp;»
                  </p>
                </div>
              </div>
            </div>
            <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
              <DemoButton />
              <p className="text-[15px] leading-relaxed text-white/65 mt-5 max-w-[46ch]">
                {PRICE_LINE}.{' '}
                <Link href={PRICING.href} className="rounded text-white underline decoration-white/40 underline-offset-4 hover:decoration-white whitespace-nowrap">Les tarifs</Link>
              </p>
              <p className="text-[15px] leading-relaxed text-white/50 mt-2">
                Sortie de la version {RELEASE.version} le <time dateTime={RELEASE.date}>{RELEASE.dateLabel}</time>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <WeekBar />

      {/* ── Lundi, 9 h : les devis partent ── */}
      <section id="devis" aria-labelledby="titre-devis" className="pt-16 md:pt-24">
        <div className={`${container} site-reveal ${two}`}>
          <div>
            <p className={`${when} text-primary`}>Lundi, 9&nbsp;h · au bureau</p>
            <h2 id="titre-devis" className="site-h2 mt-3 max-w-[16ch]">À 9&nbsp;h&nbsp;30, les six devis sont partis.</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[46ch]">
              Je pars de mon modèle «&nbsp;mariage&nbsp;», je change le nombre de convives, le prix suit. Le client reçoit son devis par mail ou WhatsApp, avec ma brochure.
            </p>
            <p className={`${before} text-gray-600`}>Avant, c’était mon dimanche soir sur Word.</p>
            <ul aria-label="Les six devis envoyés" className="mt-6 flex flex-wrap gap-1.5">
              {SENT.map((s) => (
                <li key={s} className="rounded-full bg-sage-100 px-3 py-1 text-[13px] text-sage">{s} · envoyé</li>
              ))}
            </ul>
            <p className="mt-6"><TextLink href="/fonctionnalites/devis-traiteur">Les devis, en détail</TextLink></p>
          </div>
          <div className={stage}>
            <Julien pose="bureau" className={stageFigure} />
            <QuoteStepper className="w-full md:flex-1 lg:-rotate-[1.5deg]" />
          </div>
        </div>
      </section>

      {/* ── Mercredi : le devis est signé ── */}
      <section id="mer" aria-labelledby="titre-mer" className="mx-2 sm:mx-2.5 mt-16 md:mt-24 overflow-hidden rounded-[28px] bg-primary-50">
        <div className={`${container} py-14 md:py-20 text-center`}>
          <Van className="mx-auto mb-7 w-[260px] sm:w-[300px]" />
          <p className={`${when} text-primary`}>Mercredi, 14&nbsp;h&nbsp;12 · dans le camion</p>
          <h2 id="titre-mer" className="site-h2 mt-3 mx-auto max-w-[16ch]">Mon téléphone vibre. Léa a signé.</h2>
          <SignedMessages className="mt-9" />
          <p className="site-body text-gray-700 mt-8 mx-auto max-w-[46ch]">
            Je n’ai rien ressaisi. Le mariage est dans mon calendrier, avec tout ce qu’il faut pour le préparer.
          </p>
          <p className="mt-6"><TextLink href="/fonctionnalites/signature-devis-en-ligne">La signature en ligne, en détail</TextLink></p>
        </div>
      </section>

      {/* ── Jeudi : les courses se recalculent ── */}
      <section id="jeu" aria-labelledby="titre-jeu" className="site-dark mx-2 sm:mx-2.5 mt-16 md:mt-24 overflow-hidden rounded-[28px] bg-forest text-white">
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-x-16 gap-y-10 py-14 md:py-20 lg:items-center`}>
          <div>
            <p className={`${when} text-primary-300`}>Jeudi, 6&nbsp;h · avant le marché</p>
            <h2 id="titre-jeu" className="site-h2 mt-3 max-w-[15ch]">Léa rappelle&nbsp;: ils seront {STORY.finalGuests}.</h2>
            <p className="site-body text-white/75 mt-5 max-w-[46ch]">
              Je change le chiffre, c’est tout. Les quantités, la liste par fournisseur et le devis se recalculent. Faites-le vous-même&nbsp;: tout suit.
            </p>
            <p className={`${before} text-white/70`}>Avant, je refaisais mes règles de trois sur un coin de table.</p>
            <p className="mt-6"><Link href="/fonctionnalites/liste-de-courses" className={darkLink}>La liste de courses, en détail</Link></p>
            <Julien pose="caisse" disc="dark" className="mt-8 w-[120px] md:w-[150px]" />
          </div>
          <CoursesCalculator initial={STORY.guests} />
        </div>
      </section>

      {/* ── Vendredi : les extras savent où aller ── */}
      <section id="ven" aria-labelledby="titre-ven" className="pt-16 md:pt-24">
        <div className={`${container} site-reveal text-center`}>
          <Julien pose="detente" className="mx-auto mb-5 w-[120px] md:w-[150px]" />
          <p className={`${when} text-primary`}>Vendredi, 18&nbsp;h · la veille</p>
          <h2 id="titre-ven" className="site-h2 mt-3 mx-auto max-w-[18ch]">Personne ne m’appelle pour redemander l’adresse.</h2>
          <p className="site-body text-gray-700 mt-5 mx-auto max-w-[46ch]">
            Mes huit extras ont reçu leur mission sur leur portable&nbsp;: le lieu, l’heure, la tenue, leur poste.
          </p>
          <CrewPhones className="mt-10" />
          <p className="mt-8"><TextLink href="/fonctionnalites/extras">La gestion des extras, en détail</TextLink></p>
        </div>
      </section>

      {/* ── Samedi : le jour du mariage ── */}
      <section id="sam" aria-labelledby="titre-sam" className="mx-2 sm:mx-2.5 mt-16 md:mt-24 rounded-[28px] bg-sage-100">
        <div className={`${container} ${two} py-14 md:py-20`}>
          <div>
            <p className={`${when} text-sage`}>Samedi, 13&nbsp;h · on charge</p>
            <h2 id="titre-sam" className="site-h2 mt-3 max-w-[14ch]">Je coche, je sers, je ne cherche rien.</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[46ch]">
              Feuille de production en cuisine, feuille d’envoi au camion, checklist sur place. Toute l’équipe lit la même chose.
            </p>
            <p className="mt-6"><TextLink href="/fonctionnalites/evenements">Les événements, en détail</TextLink></p>
          </div>
          <div className={stage}>
            <Julien pose="plateau" disc="sage" className={stageFigure} />
            <AutoChecklist className="w-full md:flex-1" />
          </div>
        </div>
      </section>

      {/* ── Lundi suivant : la facture et la marge ── */}
      <section id="fin" aria-labelledby="titre-fin" className="pt-16 md:pt-24">
        <div className={`${container} text-center`}>
          <Julien pose="victoire" className="mx-auto mb-5 w-[120px] md:w-[150px]" />
          <p className={`${when} text-primary`}>Lundi suivant, 8&nbsp;h</p>
          <h2 id="titre-fin" className="site-h2 mt-3 mx-auto max-w-[20ch]">La facture part en un clic. Et je sais ce que j’ai gagné.</h2>
          <MarginCounter className="mt-8 text-[clamp(4rem,13vw,8.75rem)]" />
          <p className="mt-2 text-gray-600">de marge sur le mariage de Léa et Hugo</p>
          <dl className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-1 text-[15px] text-gray-600">
            <div className="flex gap-1.5"><dt>Facturé</dt><dd className="font-semibold text-gray-900 tabular-nums">{euros(INVOICED)}</dd></div>
            <div className="flex gap-1.5"><dt>Encaissé</dt><dd className="font-semibold text-gray-900 tabular-nums">{euros(INVOICED)}</dd></div>
            <div className="flex gap-1.5"><dt>Reste à payer</dt><dd className="font-semibold text-gray-900 tabular-nums">{euros(0)}</dd></div>
          </dl>
          <p className="site-body text-gray-700 mt-7 mx-auto max-w-[46ch]">
            Et il est 8&nbsp;h&nbsp;05&nbsp;: trois nouvelles demandes sont arrivées ce week-end.
          </p>
          <p className="mt-6"><TextLink href="/fonctionnalites/facturation">Les factures, en détail</TextLink></p>
          <p className="mt-8 text-sm text-gray-500">Julien est un personnage&nbsp;: sa semaine et ses chiffres sont un exemple.</p>
        </div>
      </section>

      {/* ── Après l'histoire inventée, la parole d'un vrai traiteur ── */}
      <Testimonial className="pt-16 md:pt-24" />

      {/* ── Le tarif ── */}
      <section id="tarif" aria-labelledby="titre-tarif" className="site-dark mx-2 sm:mx-2.5 mt-16 md:mt-24 rounded-[28px] bg-forest text-white">
        <div className={`${container} py-14 md:py-20`}>
          <p className={`${when} text-primary-300`}>Et pour commencer&nbsp;?</p>
          <h2 id="titre-tarif" className="site-h2 mt-3 max-w-[16ch]">Vous ne partez pas d’un logiciel vide.</h2>
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <div className="rounded-[24px] bg-white/[0.06] p-7 ring-1 ring-white/10">
              <h3 className="text-[15px] font-medium text-primary-300">1. Le premier mois, une seule fois</h3>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-[52px] leading-none tabular-nums">{euros(FIRST_MONTH_HT)}</span>
                <span className="text-white/65">HT, mise en service comprise</span>
              </p>
              <p className="mt-3 text-white/75">Nous installons votre logiciel avec vous.</p>
              <Included items={SETUP_INCLUDES} />
              <p className="mt-5 font-medium text-white">{SETUP_PROMISE}</p>
            </div>
            <div className="rounded-[24px] bg-white/[0.06] p-7 ring-1 ring-white/10">
              <h3 className="text-[15px] font-medium text-primary-300">2. Ensuite, chaque mois</h3>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-[52px] leading-none tabular-nums">{euros(MONTHLY_HT)}</span>
                <span className="text-white/65">HT par mois</span>
              </p>
              <p className="mt-3 text-white/75">Sans engagement, vous arrêtez quand vous voulez.</p>
              <Included items={MONTHLY_INCLUDES} />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <DemoButton />
            <Link href={PRICING.href} className={darkLink}>Le détail des tarifs</Link>
          </div>
          <p className="mt-6 text-[15px] text-white/60 max-w-[70ch]">
            En option, sur devis&nbsp;: {EXTRAS.map((e) => e.charAt(0).toLowerCase() + e.slice(1)).join(' ; ')}.{' '}
            <Link href={QUOTE_REQUEST.href} className="rounded text-white underline decoration-white/40 underline-offset-4 hover:decoration-white whitespace-nowrap">{QUOTE_REQUEST.label}</Link>
          </p>
        </div>
      </section>

      {/* ── Pour aller plus loin : les pages détaillées ── */}
      <section aria-labelledby="titre-plus" className={sectionGap}>
        <div className={container}>
          <h2 id="titre-plus" className="site-h2">Pour aller plus loin</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-9">
            {MORE.map((group) => (
              <div key={group.title}>
                <h3 className="border-b border-gray-300/70 pb-3 text-[15px] font-medium text-gray-600">{group.title}</h3>
                <ul className="mt-2">
                  {group.slugs.map((slug) => {
                    const f = featureBySlug(slug);
                    return f && (
                      <li key={slug}>
                        <Link href={f.href} className="inline-block rounded py-1.5 text-[17px] text-gray-900 underline decoration-gray-300 underline-offset-4 hover:decoration-gray-900">{f.label}</Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8"><TextLink href={GUIDES_INDEX.href}>Les guides, écrits pour le métier</TextLink></p>
        </div>
      </section>

      {/* ── Questions fréquentes ── */}
      <section aria-labelledby="titre-questions" className={sectionGap}>
        <div className={`${container} grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-10`}>
          <div>
            <h2 id="titre-questions" className="site-h2 max-w-[12ch]">Questions fréquentes</h2>
            <p className="site-body text-gray-700 mt-5 max-w-[36ch]">
              Une autre question&nbsp;? <TextLink href={QUOTE_REQUEST.href}>Écrivez-nous</TextLink>
            </p>
          </div>
          <FaqList faqs={FAQS} />
        </div>
      </section>
    </div>
  );
}
