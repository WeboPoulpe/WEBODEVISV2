import Link from 'next/link';
import Wordmark from '@/components/brand/Wordmark';
import { RELEASE } from '@/lib/site/config';
import { DEMO, FOOTER, LOGIN, MENU, MENU_LINKS, RELEASES, SIGNUP } from '@/lib/site/pages';
import { isSignupOpenCached } from '@/server/settings';
import { menuAsides } from './MenuAsides';
import SiteNav from './SiteNav';
import { DemoButton, container } from './ui';
import './site.css';

/**
 * Habillage commun à toutes les pages du site : l'en-tête et son mégamenu (haut du panneau vert sapin),
 * le contenu, le panneau de clôture avec le pied de page, et la barre d'action fixe du téléphone.
 * Chaque page commence par une ouverture verte (HeroPanel ou l'ouverture de l'accueil) qui prolonge l'en-tête.
 */
export default async function SiteShell({ children, actionBar = true }: { children: React.ReactNode; actionBar?: boolean }) {
  // « Créer un compte » n'apparaît que si les inscriptions sont ouvertes dans l'espace d'administration.
  const signup = (await isSignupOpenCached()) ? SIGNUP : undefined;
  return (
    <div className={actionBar ? 'site site-with-bar min-h-[100dvh] bg-page text-gray-900' : 'site min-h-[100dvh] bg-page text-gray-900'}>
      <a href="#contenu" className="site-skip">Aller au contenu</a>

      {/* L'en-tête collant : haut du panneau vert en tête de page, barre flottante au défilement. */}
      <SiteNav entries={MENU} links={MENU_LINKS} demo={DEMO} login={LOGIN} signup={signup} asides={menuAsides()} />

      <main id="contenu">{children}</main>

      {/* Clôture et pied de page : le second panneau vert sapin */}
      <div className="site-dark mx-2 mb-2 sm:mx-2.5 sm:mb-2.5 mt-20 md:mt-28 lg:mt-36 rounded-[28px] bg-forest text-white">
        <div className={container}>
          <section aria-labelledby="titre-essayer" className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8 pt-14 pb-12 md:pt-20 md:pb-16 lg:pt-24 lg:pb-20">
            <div>
              <h2 id="titre-essayer" className="site-h1 font-display max-w-[15ch]">Le plus simple, c’est d’essayer.</h2>
              <p className="site-lead text-white/70 mt-5 max-w-[46ch]">
                La démonstration s’ouvre sur un compte déjà rempli, avec des données fictives&nbsp;: des devis, des événements, une liste de courses.
              </p>
            </div>
            <DemoButton className="lg:mb-2" />
          </section>

          <footer className="border-t border-white/10 pt-10 pb-8">
            <nav aria-label="Plan du site" className="grid grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.5fr_0.9fr] gap-x-8 gap-y-10">
              {FOOTER.map((group) => (
                <div key={group.title}>
                  <p className="text-sm text-white/50">{group.title}</p>
                  <ul className="mt-3 space-y-0.5">
                    {[...group.links, ...(signup && group.title === 'WeboDevis' ? [signup] : [])].map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="inline-block py-1.5 rounded text-[15px] leading-snug text-white/80 underline-offset-4 hover:text-white hover:underline">{l.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-12 pt-6 border-t border-white/10 text-[15px] text-white/50">
              <Wordmark className="text-[19px] text-white" />
              <span>Le logiciel des traiteurs.</span>
              <Link href={RELEASES.href} className="sm:ml-auto rounded underline-offset-4 hover:text-white hover:underline">
                Version {RELEASE.version}, sortie prévue le {RELEASE.dateLabel}
              </Link>
            </p>
          </footer>
        </div>
      </div>

      {/* Téléphone : l'action principale, toujours sous le pouce (sauf sur la page du formulaire de contact). */}
      {actionBar && <div className="site-actionbar md:hidden fixed inset-x-3 z-40">
        <Link href={DEMO.href} className="flex items-center justify-center h-14 rounded-2xl bg-primary text-white text-base font-semibold shadow-float ring-1 ring-black/10 active:scale-[0.99] transition-transform">
          {DEMO.label}
        </Link>
      </div>}
    </div>
  );
}
