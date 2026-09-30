'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HelpCircle, Plus, Search, Bell, Check, Users, Calendar, FileText, AlertCircle, Info, CheckSquare, X } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn, formatDate } from '@/lib/utils';
import { isConfirmed } from '@/lib/quoteStatus';

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
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-gray-300 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full leading-none ring-2 ring-page">
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
                <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full leading-none">
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
                      !n.is_read && 'bg-primary-50'
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
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
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
              className="text-xs font-semibold text-primary hover:underline"
            >
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recherche globale ─────────────────────────────────────────────────────────
interface SearchHit {
  key: string;
  href: string;
  title: string;
  detail: string;
  kind: 'Devis' | 'Événement' | 'Client';
}

function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Ctrl/⌘ + K place le curseur dans la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);

  useEffect(() => {
    // Les virgules et parenthèses séparent les conditions du filtre : on les retire de la saisie.
    const q = query.trim().replace(/[,()%]/g, ' ').trim();
    if (q.length < 2) { setHits(null); return; }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const [quotes, customers] = await Promise.all([
        supabase.from('quotes')
          .select('id, client_name, internal_name, event_type, event_date, status')
          .or(`client_name.ilike.%${q}%,internal_name.ilike.%${q}%,event_type.ilike.%${q}%,event_location.ilike.%${q}%`)
          .order('event_date', { ascending: false }).limit(6),
        supabase.from('customers')
          .select('id, first_name, last_name, company_name, email')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(4),
      ]);
      const found: SearchHit[] = [];
      for (const d of quotes.data ?? []) {
        const date = d.event_date ? formatDate(d.event_date) : 'sans date';
        const confirmed = isConfirmed(d.status);
        found.push({
          key: `q-${d.id}`,
          href: confirmed ? `/evenements/${d.id}` : `/devis/${d.id}/modifier`,
          title: d.internal_name || d.client_name || 'Sans nom',
          detail: [d.event_type, date].filter(Boolean).join(', '),
          kind: confirmed ? 'Événement' : 'Devis',
        });
      }
      for (const c of customers.data ?? []) {
        found.push({
          key: `c-${c.id}`,
          href: '/clients',
          title: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
          detail: c.email ?? '',
          kind: 'Client',
        });
      }
      setHits(found);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const go = (href: string) => { setOpen(false); setQuery(''); router.push(href); };

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          if (e.key === 'Enter' && hits?.[0]) go(hits[0].href);
        }}
        placeholder="Rechercher un devis, un client, un événement"
        aria-label="Rechercher"
        className="w-full h-10 pl-10 pr-4 md:pr-16 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-colors"
      />
      <kbd className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md border border-gray-200 text-[10px] font-medium text-gray-400 pointer-events-none">Ctrl K</kbd>

      {open && hits !== null && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-float z-50 overflow-hidden">
          {hits.length === 0 ? (
            <p className="px-4 py-5 text-sm text-gray-500">Aucun résultat pour « {query.trim()} ».</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1.5">
              {hits.map((hit) => (
                <li key={hit.key}>
                  <button onClick={() => go(hit.href)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors">
                    <span className={cn('flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium',
                      hit.kind === 'Client' ? 'bg-sage-100 text-sage' : 'bg-primary-100 text-primary')}>{hit.kind}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{hit.title}</span>
                      {hit.detail && <span className="block text-xs text-gray-500 truncate">{hit.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  onHelp: () => void;
}

// En-tête : recherche à gauche ; aide, notifications et création de devis à droite.
// Sur téléphone, la création de devis est le bouton central de la barre d'onglets.
export default function Header({ onHelp }: HeaderProps) {
  return (
    <header className="flex-shrink-0 z-20 flex items-center gap-2 sm:gap-3 h-[68px] px-4 md:px-6">
      <GlobalSearch />
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={onHelp}
          className="hidden sm:flex w-10 h-10 items-center justify-center rounded-xl text-gray-500 hover:bg-white hover:text-gray-900 transition-colors"
          aria-label="Centre d'aide"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        <NotificationBell />
        <Link
          href="/devis/nouveau"
          className="hidden md:flex items-center gap-2 h-10 px-4 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Nouveau devis
        </Link>
      </div>
    </header>
  );
}
