'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Shield, FolderTree, ArrowLeft, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/admin',            icon: LayoutDashboard, label: 'Dashboard',           exact: true },
  { href: '/admin/users',      icon: Users,           label: 'Utilisateurs',        exact: false },
  { href: '/admin/categories', icon: FolderTree,      label: 'Catégories globales', exact: false },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const isActive = (item: typeof NAV[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar admin */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col w-60 overflow-hidden"
        style={{ background: 'linear-gradient(175deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%)' }}
      >
        <div className="flex items-center h-[60px] px-5 border-b border-white/[0.08] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-red-500 shadow-md">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">WeboDevis</p>
              <p className="text-amber-300 text-[9px] font-bold tracking-widest uppercase">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-1">
          <Link href="/" className="flex items-center gap-2 px-3 py-2.5 mb-3 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Retour à l&apos;app</span>
          </Link>
          <div className="border-t border-white/10 pt-3 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                    active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-3 border-t border-white/10">
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-sm">
            <LogOut className="h-4 w-4" />Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0" style={{ marginLeft: 240 }}>
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
