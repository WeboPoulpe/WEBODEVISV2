import type { Crumb } from '@/lib/site/schema';
import { fr } from '@/lib/site/typo';
import { cn } from '@/lib/utils';
import { Breadcrumb, DemoButton, container } from './ui';

/**
 * Ouverture des pages intérieures : le panneau vert sapin de l'en-tête continue, avec le fil d'Ariane,
 * le titre et l'accroche. Si la page montre un aperçu du produit (`media`), il sort du panneau par le bas,
 * comme le tableau de bord de l'accueil.
 */
export default function HeroPanel({
  crumbs, title, lead, media, demo = true, narrow = false, children,
}: {
  crumbs: Crumb[];
  title: string;
  lead?: React.ReactNode;
  media?: React.ReactNode;
  /** Affiche le bouton « Essayer la démo » (à partir de la tablette). */
  demo?: boolean;
  /** Pages de lecture (guides, pages légales) : colonne de texte plus étroite. */
  narrow?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative">
      <div
        aria-hidden
        className={cn('absolute inset-x-2 sm:inset-x-2.5 -top-px rounded-b-[28px] bg-forest', media ? 'bottom-24 md:bottom-36' : 'bottom-0')}
      />
      <div className={cn(container, 'relative')}>
        <div className={cn('site-dark pt-5 md:pt-8', media ? 'pb-10 md:pb-14' : 'pb-12 md:pb-16 lg:pb-20')}>
          <Breadcrumb crumbs={crumbs} />
          <h1 className={cn('site-page-title font-display text-white mt-7 md:mt-10', narrow ? 'max-w-[20ch]' : 'max-w-[18ch]')}>{fr(title)}</h1>
          {lead && <p className="site-lead text-white/70 mt-5 md:mt-7 max-w-[54ch]">{typeof lead === 'string' ? fr(lead) : lead}</p>}
          {children}
          {demo && <DemoButton className="mt-8" />}
        </div>
        {media}
      </div>
    </section>
  );
}
