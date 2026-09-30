import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DEMO_HREF } from '@/lib/site/config';
import type { Crumb } from '@/lib/site/schema';
import { cn } from '@/lib/utils';

// Petites briques partagées par toutes les pages du site.

/** Colonne de contenu : même largeur et mêmes marges sur tout le site. */
export const container = 'mx-auto w-full max-w-[1240px] px-5 sm:px-8';

/** Espace vertical entre deux sections. */
export const sectionGap = 'pt-20 md:pt-28 lg:pt-36';

const buttonBase =
  'items-center justify-center h-[54px] px-7 rounded-2xl bg-primary text-white text-base font-semibold hover:bg-primary-dark active:scale-[0.99] transition';

/**
 * L'action principale du site. Sur téléphone elle vit dans la barre fixe en bas de l'écran :
 * ce bouton-ci ne s'affiche donc qu'à partir de la tablette, pour ne jamais en avoir deux à l'écran.
 * `data-demo-cta` : l'en-tête collant s'en sert pour masquer son propre bouton quand celui-ci est visible.
 */
export function DemoButton({ className, always = false }: { className?: string; always?: boolean }) {
  return (
    <Link href={DEMO_HREF} data-demo-cta className={cn(buttonBase, always ? 'inline-flex' : 'hidden md:inline-flex', className)}>
      Essayer la démo
    </Link>
  );
}

/** Données structurées d'une page. */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, '\\u003c') }} />
      ))}
    </>
  );
}

/** Fil d'Ariane, posé sur le vert sapin en haut des pages intérieures. */
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Fil d’Ariane">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/55">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-white/30" aria-hidden />}
              {last
                ? <span aria-current="page" className="text-white/80">{c.name}</span>
                : <Link href={c.path} className="rounded underline-offset-4 hover:text-white hover:underline">{c.name}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Lien de texte vers une autre page du site, souligné au survol. */
export function TextLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn('font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary', className)}>
      {children}
    </Link>
  );
}

/** Information légale manquante : marqueur visible, à remplacer par l'éditeur avant la mise en ligne. */
export function Todo({ children }: { children: React.ReactNode }) {
  return <span className="site-todo">[À COMPLÉTER : {children}]</span>;
}
