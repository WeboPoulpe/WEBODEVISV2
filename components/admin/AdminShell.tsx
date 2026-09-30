'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, FolderTree, Inbox, LayoutDashboard, LogOut, Settings2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Wordmark from '@/components/brand/Wordmark';

const NAV = [
  { href: '/admin', icon: LayoutDashboard, label: 'Vue d’ensemble', exact: true },
  { href: '/admin/comptes', icon: Users, label: 'Comptes', exact: false },
  { href: '/admin/demandes', icon: Inbox, label: 'Demandes', exact: false },
  { href: '/admin/categories', icon: FolderTree, label: 'Catégories', exact: false },
  { href: '/admin/reglages', icon: Settings2, label: 'Réglages', exact: false },
];

// Coque de l'espace d'administration : barre latérale sur ordinateur, onglets en haut sur téléphone et tablette.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const isActive = (item: (typeof NAV)[number]) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const leave = async () => { await signOut(); window.location.assign('/login'); };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-page">
      <aside className="hidden lg:flex flex-col w-64 m-2 rounded-3xl bg-forest text-white flex-shrink-0">
        <div className="px-6 pt-7 pb-6">
          <Wordmark className="text-[22px] text-white" />
          <p className="text-sm text-white/55 mt-1.5">Administration</p>
        </div>
        <nav className="flex-1 px-3 space-y-1" aria-label="Administration">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(item) ? 'page' : undefined}
              className={cn('flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-medium transition-colors',
                isActive(item) ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 space-y-1">
          <Link href="/" className="flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] text-white/70 hover:bg-white/5 hover:text-white transition-colors">
            <ArrowLeft className="h-[18px] w-[18px]" />Retour à l’app
          </Link>
          <button onClick={leave} className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] text-white/70 hover:bg-white/5 hover:text-white transition-colors">
            <LogOut className="h-[18px] w-[18px]" />Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden flex-shrink-0 bg-forest text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between gap-3 h-14 px-4">
            <p className="flex items-baseline gap-2 min-w-0">
              <Wordmark className="text-lg text-white" />
              <span className="text-sm text-white/55 truncate">Administration</span>
            </p>
            <Link href="/" className="flex items-center gap-1.5 h-10 px-3 -mr-2 rounded-xl text-sm font-medium text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" />L’app
            </Link>
          </div>
          <nav className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none" aria-label="Administration">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item) ? 'page' : undefined}
                className={cn('flex-shrink-0 h-10 px-3.5 flex items-center rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  isActive(item) ? 'bg-white text-forest' : 'text-white/75 hover:text-white')}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 overflow-y-auto pt-5 lg:pt-8" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
