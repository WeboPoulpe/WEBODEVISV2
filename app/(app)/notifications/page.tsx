'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Check, Trash2, Loader2, Users, Calendar, FileText, AlertCircle, Info, CheckSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type NotifType = 'prospect_request' | 'upcoming_event' | 'invoice_due' | 'support_ticket' | 'system_update' | 'task_reminder';
type Priority   = 'low' | 'medium' | 'high';
type Filter     = 'all' | 'unread' | 'read';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  priority: Priority;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

// ── Config ─────────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<NotifType, { icon: React.ElementType; bg: string; text: string }> = {
  prospect_request: { icon: Users,       bg: 'bg-sky-50',    text: 'text-sky-600'    },
  upcoming_event:  { icon: Calendar,    bg: 'bg-violet-50', text: 'text-violet-600' },
  invoice_due:     { icon: FileText,    bg: 'bg-amber-50',  text: 'text-amber-600'  },
  support_ticket:  { icon: AlertCircle, bg: 'bg-rose-50',   text: 'text-rose-600'   },
  system_update:   { icon: Info,        bg: 'bg-gray-100',  text: 'text-gray-600'   },
  task_reminder:   { icon: CheckSquare, bg: 'bg-emerald-50',text: 'text-emerald-600'},
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function groupByDate(notifications: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  for (const n of notifications) {
    const d = new Date(n.created_at); d.setHours(0,0,0,0);
    let label: string;
    if (d.getTime() === today.getTime())     label = "Aujourd'hui";
    else if (d.getTime() === yesterday.getTime()) label = "Hier";
    else label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

// ── Notification card ──────────────────────────────────────────────────────────
function NotifCard({
  n,
  onRead,
  onDelete,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system_update;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-4 rounded-2xl border transition-all',
        n.is_read
          ? 'bg-white border-gray-100'
          : 'bg-[#faf5ff] border-[#9c27b0]/15 shadow-sm',
      )}
    >
      {/* Icon */}
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
        <Icon className={cn('h-4 w-4', cfg.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn('text-sm font-semibold truncate', n.is_read ? 'text-gray-700' : 'text-gray-900')}>
                {n.title}
              </p>
              {n.priority === 'high' && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', PRIORITY_BADGE.high)}>
                  Urgent
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
          </div>
          <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(n.created_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          {n.action_url && (
            <a
              href={n.action_url}
              className="text-xs font-semibold text-[#9c27b0] hover:underline"
            >
              Voir →
            </a>
          )}
          {!n.is_read && (
            <button
              onClick={() => onRead(n.id)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              Marquer lu
            </button>
          )}
          <button
            onClick={() => onDelete(n.id)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-auto"
          >
            <Trash2 className="h-3 w-3" />
            Supprimer
          </button>
        </div>
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <span className="w-2 h-2 rounded-full bg-[#9c27b0] flex-shrink-0 mt-1.5" />
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifications(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (id: string) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read')   return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const groups = groupByDate(filtered);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',    label: `Toutes (${notifications.length})` },
    { key: 'unread', label: `Non lues (${unreadCount})` },
    { key: 'read',   label: 'Lues' },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#f3e5f5] rounded-xl flex items-center justify-center">
            <Bell className="h-5 w-5 text-[#9c27b0]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-[#9c27b0] font-medium">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Tout marquer lu
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors',
              filter === key
                ? 'bg-[#9c27b0] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 text-[#9c27b0] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">Aucune notification</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'unread' ? 'Tout est lu !' : 'Pas encore de notifications.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{label}</p>
              <div className="space-y-2">
                {items.map((n) => (
                  <NotifCard
                    key={n.id}
                    n={n}
                    onRead={handleRead}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
