'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Users, CalendarDays, CalendarRange,
  Package, Settings, Carrot, LayoutTemplate,
  LogOut, ChevronLeft, ChevronRight, UserCheck, Users2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  badge?: 'pendingDevis' | 'todayEvent' | 'newProspects';
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// ── Navigation structure ──────────────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Commerce',
    items: [
      { href: '/',          icon: LayoutDashboard, label: 'Tableau de bord', exact: true  },
      { href: '/devis',     icon: FileText,        label: 'Devis',           exact: false, badge: 'pendingDevis' },
      { href: '/clients',   icon: Users,           label: 'Clients',         exact: false },
      { href: '/prospects', icon: UserCheck,       label: 'Prospects',       exact: false, badge: 'newProspects' },
    ],
  },
  {
    title: 'Logistique',
    items: [
      { href: '/calendrier',  icon: CalendarDays,  label: 'Calendrier',  exact: false, badge: 'todayEvent' },
      { href: '/evenements',  icon: CalendarRange, label: 'Événements',  exact: false },
      { href: '/extras',      icon: Users2,        label: 'Extras',      exact: false },
      { href: '/ingredients', icon: Carrot,        label: 'Ingrédients', exact: false },
      { href: '/prestations', icon: Package,       label: 'Prestations', exact: false },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/parametres', icon: Settings,        label: 'Paramètres',     exact: false },
      { href: '/modeles',    icon: LayoutTemplate,  label: 'Modèles de devis', exact: false },
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const [pendingDevis, setPendingDevis]   = useState(0);
  const [hasTodayEvent, setHasTodayEvent] = useState(false);
  const [newProspects, setNewProspects]   = useState(0);
  const { user } = useAuth();

  // Load badge data
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // Fetch devis + events badges
    Promise.all([
      supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
      supabase.from('quotes').select('*', { count: 'exact', head: true }).eq('event_date', today).eq('status', 'accepted'),
    ]).then(([{ count: pending }, { count: todayCount }]) => {
      setPendingDevis(pending ?? 0);
      setHasTodayEvent((todayCount ?? 0) > 0);
    });

    // Fetch new prospects count (via user's tokens)
    supabase
      .from('user_prospect_tokens')
      .select('token')
      .eq('user_id', user.id)
      .then(({ data: tokenRows }) => {
        const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
        if (tokens.length === 0) return;
        supabase
          .from('prospect_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'nouveau')
          .in('user_token', tokens)
          .then(({ count }) => setNewProspects(count ?? 0));
      });
  }, [user]);

  // Active state logic
  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.href === '/devis') {
      return pathname === '/devis' || (pathname.startsWith('/devis/') && pathname !== '/devis/nouveau');
    }
    if (item.href === '/evenements') {
      return pathname.startsWith('/evenements');
    }
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  // Badge resolver
  const resolveBadge = (key?: NavItem['badge']): number | 'dot' | null => {
    if (!key) return null;
    if (key === 'pendingDevis' && pendingDevis > 0) return pendingDevis;
    if (key === 'todayEvent'   && hasTodayEvent)    return 'dot';
    if (key === 'newProspects' && newProspects > 0) return newProspects;
    return null;
  };

  // Avatar initials
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col transition-[width] duration-300 ease-in-out overflow-hidden"
      style={{
        width: collapsed ? 64 : 240,
        background: 'linear-gradient(175deg, #1a0733 0%, #2a1554 55%, #1e0e42 100%)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center h-[60px] px-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #9c27b0, #7b1fa2)',
              boxShadow: '0 4px 14px rgba(156, 39, 176, 0.4)',
            }}
          >
            <span className="text-white font-bold text-sm select-none">W</span>
          </div>
          {!collapsed && (
            <span className="text-white font-bold text-sm tracking-wide truncate select-none">
              WeboDevis
            </span>
          )}
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden scrollbar-none">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? 'mt-5' : ''}>
            {/* Group label */}
            {collapsed ? (
              <div className="mx-auto my-2 w-6 h-px bg-white/[0.08]" />
            ) : (
              <p className="px-5 mb-1 text-[9.5px] font-semibold tracking-[0.16em] text-white/25 uppercase select-none">
                {group.title}
              </p>
            )}

            {/* Items */}
            <div className="space-y-px">
              {group.items.map((item) => {
                const active = isActive(item);
                const badge  = resolveBadge(item.badge);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-all duration-150 group',
                      active
                        ? 'bg-white/[0.11] text-white'
                        : 'text-white/45 hover:bg-white/[0.07] hover:text-white/80',
                    )}
                  >
                    {/* Active left accent */}
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #e040fb, #9c27b0)' }}
                      />
                    )}

                    {/* Icon */}
                    <item.icon
                      className="flex-shrink-0"
                      style={{ width: 17, height: 17 }}
                      strokeWidth={1.6}
                    />

                    {/* Label */}
                    {!collapsed && (
                      <span className="flex-1 text-[13px] font-medium truncate leading-none">
                        {item.label}
                      </span>
                    )}

                    {/* Badges — expanded */}
                    {!collapsed && badge !== null && (
                      badge === 'dot' ? (
                        <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0 shadow-sm shadow-rose-400/50" />
                      ) : (
                        <span className="px-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#9c27b0] text-white text-[10px] font-bold rounded-full leading-none flex-shrink-0">
                          {(badge as number) > 9 ? '9+' : badge}
                        </span>
                      )
                    )}

                    {/* Badges — collapsed */}
                    {collapsed && badge !== null && (
                      badge === 'dot' ? (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-400" />
                      ) : (
                        <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-[#9c27b0] text-white text-[9px] font-bold rounded-full leading-none">
                          {(badge as number) > 9 ? '9+' : badge}
                        </span>
                      )
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/[0.06]">

        {/* Avatar + user info */}
        {profile && (
          <div className={cn(
            'flex items-center gap-2.5 px-3 py-3',
            collapsed && 'justify-center',
          )}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 select-none"
              style={{
                background: 'linear-gradient(135deg, #ce93d8, #9c27b0)',
                boxShadow: '0 2px 8px rgba(156,39,176,0.35)',
              }}
            >
              <span className="text-white font-semibold text-[11px]">{initials}</span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-[12px] font-medium truncate leading-snug">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="text-white/35 text-[10px] truncate leading-snug">{profile.email}</p>
              </div>
            )}
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          title={collapsed ? 'Déconnexion' : undefined}
          className={cn(
            'flex items-center gap-3 w-full px-4 py-2.5 text-white/35 hover:text-white/65 hover:bg-white/[0.05] transition-colors',
            collapsed && 'justify-center',
          )}
        >
          <LogOut strokeWidth={1.6} style={{ width: 15, height: 15 }} className="flex-shrink-0" />
          {!collapsed && <span className="text-[12px]">Déconnexion</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Développer' : 'Réduire'}
          className={cn(
            'flex items-center gap-3 w-full px-4 py-2.5 text-white/35 hover:text-white/65 hover:bg-white/[0.05] transition-colors border-t border-white/[0.06]',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? (
            <ChevronRight strokeWidth={1.6} style={{ width: 15, height: 15 }} className="flex-shrink-0" />
          ) : (
            <>
              <ChevronLeft strokeWidth={1.6} style={{ width: 15, height: 15 }} className="flex-shrink-0" />
              <span className="text-[12px]">Réduire</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
