import Link from 'next/link';
import Wordmark from '@/components/brand/Wordmark';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { href: '#demandes', label: 'Demandes' },
  { href: '#devis', label: 'Devis' },
  { href: '#evenements', label: 'Événements' },
  { href: '#quotidien', label: 'Au quotidien' },
];

/**
 * En-tête du site. Une seule action ici, « Se connecter » : « Créer un compte » est le bouton de la page.
 * `sections` affiche les ancres de la page d'accueil ; les pages légales n'en ont pas.
 */
export default function SiteHeader({ tone, sections = false }: { tone: 'dark' | 'light'; sections?: boolean }) {
  const dark = tone === 'dark';
  return (
    <header className="flex items-center gap-6 h-[72px]">
      <Link href="/site" aria-label="WeboDevis, accueil du site" className="rounded-lg">
        <Wordmark className={cn('text-[26px]', dark ? 'text-white' : 'text-gray-900')} />
      </Link>

      {sections && (
        <nav aria-label="Sections de la page" className="hidden lg:block ml-auto">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className={cn('flex items-center h-10 px-3.5 rounded-xl text-[15px] font-medium whitespace-nowrap transition-colors',
                    dark ? 'text-white/70 hover:text-white hover:bg-white/[0.06]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <Link
        href="/login"
        className={cn('flex items-center flex-shrink-0 h-11 px-5 rounded-xl text-[15px] font-semibold whitespace-nowrap transition-colors',
          sections ? 'ml-auto lg:ml-2' : 'ml-auto',
          dark ? 'bg-white/10 text-white hover:bg-white/[0.16]' : 'bg-white border border-gray-200 text-gray-900 hover:border-gray-300')}
      >
        Se connecter
      </Link>
    </header>
  );
}
