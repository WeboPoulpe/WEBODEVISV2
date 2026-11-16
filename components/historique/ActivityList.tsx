'use client';

// Lignes de l'historique, groupées par jour (heure de Paris).

import Link from 'next/link';
import {
  CheckCircle2, Eye, FilePlus2, KeyRound, Mail, Pencil, RefreshCw, Repeat, Trash2, UserPlus, Wallet,
} from 'lucide-react';
import type { ActivityAction } from '@/lib/activity';
import type { ActivityEntry } from '@/server/activity';
import { cn } from '@/lib/utils';

const ICONS: Record<ActivityAction, { icon: typeof Mail; tone: string }> = {
  creation: { icon: FilePlus2, tone: 'bg-forest/10 text-forest' },
  modification: { icon: Pencil, tone: 'bg-gray-100 text-gray-600' },
  suppression: { icon: Trash2, tone: 'bg-danger/10 text-danger' },
  envoi: { icon: Mail, tone: 'bg-primary-50 text-primary' },
  statut: { icon: Repeat, tone: 'bg-gray-100 text-gray-600' },
  paiement: { icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
  acceptation: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
  relance: { icon: RefreshCw, tone: 'bg-amber-50 text-amber-700' },
  consultation_client: { icon: Eye, tone: 'bg-sky-50 text-sky-700' },
  invitation: { icon: UserPlus, tone: 'bg-primary-50 text-primary' },
  role: { icon: KeyRound, tone: 'bg-gray-100 text-gray-600' },
};

const TZ = 'Europe/Paris';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('fr-CA', { timeZone: TZ });
const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

function dayTitle(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400_000).toISOString());
  if (key === today) return 'Aujourd’hui';
  if (key === yesterday) return 'Hier';
  const d = new Date(`${key}T12:00:00Z`);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }), timeZone: TZ });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const who = (e: ActivityEntry) => e.viaAdmin ? 'l’équipe WeboDevis' : e.actor ?? (e.action === 'relance' ? 'Relance automatique' : 'Client');

function Row({ e }: { e: ActivityEntry }) {
  const { icon: Icon, tone } = ICONS[e.action] ?? ICONS.modification;
  const count = typeof e.details?.count === 'number' && e.details.count > 1 ? e.details.count : 0;
  const body = (
    <>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone)} aria-hidden><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-900 break-words">{e.summary}</span>
        <span className="mt-0.5 block text-xs text-gray-500">
          {time(e.at)}{e.until && time(e.until) !== time(e.at) ? ` → ${time(e.until)}` : ''}
          {count ? ` · ${count} fois` : ''} · {who(e)}
        </span>
      </span>
    </>
  );
  return (
    <li>
      {e.href ? (
        <Link href={e.href} className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-gray-50">{body}</Link>
      ) : (
        <div className="flex items-start gap-3 px-2 py-2">{body}</div>
      )}
    </li>
  );
}

export default function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  const days: { key: string; items: ActivityEntry[] }[] = [];
  for (const e of entries) {
    const key = dayKey(e.at);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(e);
    else days.push({ key, items: [e] });
  }
  return (
    <div className="space-y-5">
      {days.map((d) => (
        <section key={d.key}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{dayTitle(d.key)}</h2>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-2">
            {d.items.map((e) => <Row key={e.id} e={e} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
