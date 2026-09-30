import Link from 'next/link';
import Wordmark from '@/components/brand/Wordmark';
import { cn } from '@/lib/utils';

/** Pied de page : la marque et les pages légales. Posé sur le vert sapin (accueil) ou sur le crème (pages légales). */
export default function SiteFooter({ tone }: { tone: 'dark' | 'light' }) {
  const dark = tone === 'dark';
  const link = cn('rounded-md underline-offset-4 hover:underline', dark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900');
  return (
    <footer className={cn('flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-6 border-t text-[15px]', dark ? 'border-white/10' : 'border-gray-200')}>
      <p className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', dark ? 'text-white/50' : 'text-gray-500')}>
        <Wordmark className={cn('text-[19px]', dark ? 'text-white' : 'text-gray-900')} />
        <span>Le logiciel des traiteurs.</span>
      </p>
      <nav aria-label="Informations légales">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li><Link href="/site/mentions-legales" className={link}>Mentions légales</Link></li>
          <li><Link href="/site/confidentialite" className={link}>Confidentialité</Link></li>
        </ul>
      </nav>
    </footer>
  );
}
