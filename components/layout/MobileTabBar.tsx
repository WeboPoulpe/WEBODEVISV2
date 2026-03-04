'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Users, CalendarDays, CalendarRange, Settings } from 'lucide-react';

const TABS = [
  { href: '/',            icon: Home,          label: 'Accueil',      exact: true  },
  { href: '/devis',       icon: FileText,      label: 'Devis',        exact: false },
  { href: '/clients',     icon: Users,         label: 'Clients',      exact: false },
  { href: '/calendrier',  icon: CalendarDays,  label: 'Calendrier',   exact: false },
  { href: '/evenements',  icon: CalendarRange, label: 'Événements',   exact: false },
  { href: '/parametres',  icon: Settings,      label: 'Paramètres',   exact: false },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    /* Only visible below lg breakpoint */
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex items-stretch h-16">
        {TABS.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${active ? 'text-[#9c27b0]' : 'text-gray-400'}`}
              />
              <span
                className={`text-[9px] font-medium transition-colors leading-none ${active ? 'text-[#9c27b0]' : 'text-gray-400'}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
