'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, Check, CheckSquare, FileText, Info, Loader2, Trash2, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { notificationHref } from '@/lib/notifications';
import { btnSecondary, cardCls, iconBtn, iconBtnDanger, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

type Filter = 'toutes' | 'non-lues';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

const ICONS: Record<string, React.ElementType> = {
  prospect_request: UserCheck,
  upcoming_event: CalendarDays,
  invoice_due: FileText,
  task_reminder: CheckSquare,
  stock_alert: AlertCircle,
};

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<Filter>('toutes');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await createClient().from('notifications').select('id, title, message, type, priority, is_read, action_url, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
    setNotifications((data ?? []) as Notification[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    setNotifications((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await createClient().from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
  };

  // Ouvrir une notification : elle est lue, et on va sur la page concernée.
  const open = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    router.push(notificationHref(n));
  };

  const remove = async (id: string) => {
    setNotifications((prev) => (prev ?? []).filter((n) => n.id !== id));
    await createClient().from('notifications').delete().eq('id', id);
  };

  const markAllRead = async () => {
    if (!user) return;
    setMarkingAll(true);
    await createClient().from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => (prev ?? []).map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
  };

  const unread = (notifications ?? []).filter((n) => !n.is_read).length;
  const groups = useMemo(() => {
    const list = (notifications ?? []).filter((n) => filter === 'toutes' || !n.is_read);
    const byDay = new Map<string, Notification[]>();
    for (const n of list) byDay.set(dayLabel(n.created_at), [...(byDay.get(dayLabel(n.created_at)) ?? []), n]);
    return [...byDay.entries()];
  }, [notifications, filter]);

  return (
    <div className="px-4 md:px-6 pb-8 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">{notifications === null ? ' ' : unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={markingAll} className={btnSecondary}>
            {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="flex p-1 mb-4 rounded-xl bg-gray-200/70 w-fit" role="tablist" aria-label="Notifications affichées">
        {([['toutes', 'Toutes'], ['non-lues', `Non lues${unread ? ` (${unread})` : ''}`]] as [Filter, string][]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
            className={cn('h-10 px-4 rounded-lg text-sm font-medium transition-colors', filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            {label}
          </button>
        ))}
      </div>

      {notifications === null ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[0, 1, 2].map((i) => <div key={i} className="px-5 py-4 animate-pulse space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-2/3" /></div>)}
        </div>
      ) : groups.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900">{filter === 'non-lues' ? 'Aucune notification non lue' : 'Aucune notification'}</p>
          <p className="text-sm text-gray-500 mt-1">Les nouvelles demandes de devis, les événements proches et les alertes de stock s’affichent ici.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label}>
              <h2 className="px-1 mb-2 text-[15px] font-semibold text-gray-900">{label}</h2>
              <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Info;
                  return (
                    <li key={n.id} className={cn('flex items-start gap-1 pr-2', !n.is_read && 'bg-primary-50/60')}>
                      <button onClick={() => open(n)} className="flex-1 min-w-0 flex items-start gap-3 text-left pl-4 sm:pl-5 py-3.5">
                        <span className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-gray-700" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className={cn('font-semibold', n.is_read ? 'text-gray-700' : 'text-gray-900')}>{n.title}</span>
                            {n.priority === 'high' && !n.is_read && <span className={cn(pill, 'bg-primary text-white')}>Important</span>}
                          </span>
                          <span className="block text-sm text-gray-600 mt-0.5">{n.message}</span>
                          <span className="block text-xs text-gray-500 mt-1">{timeAgo(n.created_at)}</span>
                        </span>
                      </button>
                      <div className="flex items-center pt-2.5">
                        {!n.is_read && (
                          <button onClick={() => markRead(n.id)} className={iconBtn} aria-label={`Marquer « ${n.title} » comme lue`} title="Marquer comme lue"><Check className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => remove(n.id)} className={iconBtnDanger} aria-label={`Supprimer « ${n.title} »`} title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
