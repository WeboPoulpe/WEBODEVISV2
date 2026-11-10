import type { Metadata } from 'next';
import HeroPanel from '@/components/site/HeroPanel';
import LinkList from '@/components/site/LinkList';
import SiteShell from '@/components/site/SiteShell';
import { container } from '@/components/site/ui';
import { CONTACT, FEATURES_INDEX, GUIDES_INDEX, HOME, RELEASES, type SiteLink } from '@/lib/site/pages';

// Adresse inconnue : une vraie page 404 (le middleware ne renvoie vers la connexion que les écrans de l'app).
export const metadata: Metadata = { title: 'Page introuvable | WeboDevis', robots: { index: false } };

const LINKS: SiteLink[] = [
  { href: HOME.href, label: 'L’accueil', blurb: 'Le logiciel des traiteurs, en un coup d’œil.' },
  { href: FEATURES_INDEX.href, label: FEATURES_INDEX.label, blurb: 'Tout ce que fait WeboDevis, fonction par fonction.' },
  { href: GUIDES_INDEX.href, label: GUIDES_INDEX.label, blurb: 'Des méthodes écrites pour le métier de traiteur.' },
  { href: RELEASES.href, label: RELEASES.label, blurb: 'Ce qui vient d’arriver dans le logiciel.' },
  { href: CONTACT.href, label: CONTACT.label, blurb: 'Une question ? Écrivez-nous.' },
];

export default function NotFound() {
  return (
    <SiteShell>
      <HeroPanel
        crumbs={[{ name: HOME.label, path: HOME.href }]}
        title="Cette page n’existe pas."
        lead="L’adresse a peut-être changé, ou une lettre s’est glissée de travers. Voici où reprendre."
        demo={false}
      />
      <section aria-label="Pages du site" className="pt-12 md:pt-20">
        <div className={container}>
          <LinkList links={LINKS} columns={2} />
        </div>
      </section>
    </SiteShell>
  );
}
