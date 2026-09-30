import Link from 'next/link';
import { FEATURED_GUIDE, QUOTE_REQUEST } from '@/lib/site/pages';
import { PhoneHome } from './Phone';
import { DemoButton } from './ui';

// Les encarts vert sapin du mégamenu (ordinateur) : un par entrée. Rendus par le serveur,
// puis passés au composant client du menu, qui se contente de les afficher.

const title = 'font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.015em]';

/** Fonctionnalités : le produit en aperçu, et la démonstration. */
function FeaturesAside() {
  return (
    <div className="flex flex-col h-full min-h-[380px] px-6 pt-6">
      <p className={title}>Le plus simple, c’est d’essayer.</p>
      <p className="text-sm leading-relaxed text-white/65 mt-2">Un compte de démonstration, déjà rempli de données fictives.</p>
      <DemoButton always className="self-start mt-5 !h-12 !px-5 !rounded-xl !text-[15px]" />
      {/* Le tableau de bord sur téléphone, réduit et coupé par le bas de l'encart */}
      <div className="relative flex-1 min-h-[170px] mt-6 overflow-hidden">
        <div className="absolute left-1/2 top-0 w-[288px] -ml-[144px] origin-top scale-[0.78]">
          <PhoneHome />
        </div>
      </div>
    </div>
  );
}

/** Pour qui : une phrase, et la demande de devis. */
function AudiencesAside() {
  return (
    <div className="flex flex-col h-full min-h-[240px] p-6">
      <p className={title}>Votre activité ne ressemble à aucune de ces trois-là&nbsp;?</p>
      <p className="text-sm leading-relaxed text-white/65 mt-2">Dites-nous comment vous travaillez : nous vous répondons par email.</p>
      <Link href={QUOTE_REQUEST.href} className="self-start inline-flex items-center h-12 px-5 mt-auto rounded-xl bg-white text-gray-900 text-[15px] font-semibold hover:bg-gray-100 transition-colors">
        {QUOTE_REQUEST.label}
      </Link>
    </div>
  );
}

/** Guides : le guide à lire en premier. */
function GuidesAside() {
  const guide = FEATURED_GUIDE;
  return (
    <Link href={guide.href} className="group flex flex-col h-full min-h-[280px] p-6">
      <span className="text-sm text-white/55">Par où commencer</span>
      <span className={`${title} block mt-3 underline-offset-4 decoration-2 group-hover:underline`}>{guide.title}</span>
      <span className="block text-sm leading-relaxed text-white/65 mt-3">{guide.description.replace(/ ([?!:;])/g, ' $1')}</span>
      <span className="block text-sm text-white/55 mt-auto pt-6">{guide.minutes} min de lecture</span>
    </Link>
  );
}

/** Les encarts, par identifiant d'entrée du menu (voir MENU dans lib/site/pages.ts). */
export const menuAsides = (): Record<string, React.ReactNode> => ({
  fonctionnalites: <FeaturesAside />,
  'pour-qui': <AudiencesAside />,
  guides: <GuidesAside />,
});
