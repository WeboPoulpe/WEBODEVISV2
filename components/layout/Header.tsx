'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Plus, Bell, Check, Users, Calendar, FileText, AlertCircle, Info, CheckSquare, X } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type NotifType = 'prospect_request' | 'upcoming_event' | 'invoice_due' | 'support_ticket' | 'system_update' | 'task_reminder';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

const TYPE_ICON: Record<NotifType, React.ElementType> = {
  prospect_request: Users,
  upcoming_event:  Calendar,
  invoice_due:     FileText,
  support_ticket:  AlertCircle,
  system_update:   Info,
  task_reminder:   CheckSquare,
};

const TYPE_COLOR: Record<NotifType, string> = {
  prospect_request: 'text-sky-500 bg-sky-50',
  upcoming_event:   'text-violet-500 bg-violet-50',
  invoice_due:      'text-amber-500 bg-amber-50',
  support_ticket:   'text-rose-500 bg-rose-50',
  system_update:    'text-gray-500 bg-gray-100',
  task_reminder:    'text-emerald-500 bg-emerald-50',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// ── Notification Bell Dropdown ─────────────────────────────────────────────────
function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, priority, is_read, action_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setNotifications(data ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter((n) => !n.is_read);

  const markRead = async (id: string, actionUrl: string | null) => {
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setOpen(false);
    if (actionUrl) router.push(actionUrl);
  };

  const markAllRead = async () => {
    if (!user || unread.length === 0) return;
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-[#9c27b0] text-white text-[9px] font-bold rounded-full leading-none">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">Notifications</span>
              {unread.length > 0 && (
                <span className="px-1.5 py-0.5 bg-[#9c27b0] text-white text-[10px] font-bold rounded-full leading-none">
                  {unread.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  title="Tout marquer lu"
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center px-4">
                <Bell className="h-8 w-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Info;
                const colorCls = TYPE_COLOR[n.type] ?? 'text-gray-500 bg-gray-100';
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id, n.action_url)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50',
                      !n.is_read && 'bg-[#faf5ff]'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', colorCls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs font-semibold truncate', n.is_read ? 'text-gray-600' : 'text-gray-900')}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9c27b0] flex-shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[#9c27b0] hover:underline"
            >
              Voir toutes les notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page titles ────────────────────────────────────────────────────────────────
const TITLES: Record<string, string> = {
  '/':               'Tableau de bord',
  '/devis':          'Devis',
  '/devis/nouveau':  'Nouveau devis',
  '/clients':        'Clients',
  '/clients/nouveau':'Nouveau client',
  '/parametres':     'Paramètres',
  '/prospects':      'Demandes de devis',
  '/notifications':  'Notifications',
  '/calendrier':     'Calendrier',
  '/evenements':     'Événements',
  '/ingredients':    'Ingrédients',
  '/prestations':    'Prestations',
  '/modeles':        'Modèles de devis',
};

interface HeaderProps {
  sidebarWidth: number;
  onToggleSidebar: () => void;
}

export default function Header({ sidebarWidth, onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();

  // Match longest prefix
  const title = Object.entries(TITLES)
    .filter(([k]) => pathname === k || pathname.startsWith(k + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'WeboDevis';

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center justify-between h-[60px] px-4 bg-white border-b border-gray-200 transition-[left] duration-300 ease-in-out"
      style={{ left: sidebarWidth }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <Link
          href="/devis/nouveau"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#9c27b0] text-white text-sm font-medium rounded-lg hover:bg-[#7b1fa2] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau devis
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
}
