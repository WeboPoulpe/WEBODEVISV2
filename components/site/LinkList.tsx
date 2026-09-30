import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { SiteLink } from '@/lib/site/pages';
import { fr } from '@/lib/site/typo';
import { cn } from '@/lib/utils';

/**
 * Liste de liens vers d'autres pages du site : un nom, une ligne de description, toute la ligne cliquable.
 * C'est elle qui porte le maillage interne (accueil, fin des pages, vue d'ensemble).
 */
export default function LinkList({ links, tone = 'light', columns = 2, className }: { links: SiteLink[]; tone?: 'light' | 'dark'; columns?: 1 | 2 | 3; className?: string }) {
  const dark = tone === 'dark';
  return (
    <ul className={cn('grid grid-cols-1 gap-x-10', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3', className)}>
      {links.map((l) => (
        <li key={l.href} className={cn('border-t', dark ? 'border-white/15' : 'border-gray-300/70')}>
          <Link href={l.href} className="group flex items-start justify-between gap-4 py-5 rounded-lg">
            <span className="min-w-0">
              <span className={cn('block font-display text-xl font-semibold tracking-[-0.01em] leading-snug underline-offset-4 group-hover:underline', dark ? 'text-white' : 'text-gray-900')}>{fr(l.label)}</span>
              {l.blurb && <span className={cn('block text-base leading-relaxed mt-1', dark ? 'text-white/60' : 'text-gray-600')}>{fr(l.blurb)}</span>}
            </span>
            <ChevronRight className={cn('flex-shrink-0 mt-1 h-5 w-5 transition-transform group-hover:translate-x-0.5', dark ? 'text-white/40' : 'text-gray-400')} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
