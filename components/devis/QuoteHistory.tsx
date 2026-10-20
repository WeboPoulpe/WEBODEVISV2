'use client';

// Historique d'un devis : une chronologie, du plus récent au plus ancien.

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Eye, FilePlus2, Mail, MessageCircle, Receipt, RefreshCw, Repeat, Wallet } from 'lucide-react';
import { getQuoteHistory, type HistoryEntry, type HistoryKind } from '@/server/quoteHistory';
import { cn } from '@/lib/utils';

const ICONS: Record<HistoryKind, { icon: typeof Mail; tone: string }> = {
  creation: { icon: FilePlus2, tone: 'bg-gray-100 text-gray-600' },
  statut: { icon: Repeat, tone: 'bg-gray-100 text-gray-600' },
  envoi_email: { icon: Mail, tone: 'bg-primary-50 text-primary' },
  envoi_whatsapp: { icon: MessageCircle, tone: 'bg-emerald-50 text-emerald-700' },
  consultation: { icon: Eye, tone: 'bg-sky-50 text-sky-700' },
  acceptation: { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
  relance: { icon: RefreshCw, tone: 'bg-amber-50 text-amber-700' },
  facture: { icon: Receipt, tone: 'bg-primary-50 text-primary' },
  paiement: { icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
  degustation: { icon: CalendarClock, tone: 'bg-forest/10 text-forest' },
};

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function QuoteHistory({ quoteId }: { quoteId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setEntries(null); setError(false);
    getQuoteHistory(quoteId)
      .then((h) => { if (alive) setEntries(h ?? []); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [quoteId]);

  if (error) return <p className="text-sm text-danger">L’historique n’a pas pu être chargé. Réessayez dans un instant.</p>;
  if (!entries) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-50 animate-pulse" />)}</div>;
  if (entries.length === 0) return <p className="text-sm text-gray-500">Aucun événement pour ce devis.</p>;

  return (
    <ol className="relative space-y-4" aria-label="Historique du devis">
      <span className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" aria-hidden />
      {entries.map((e, i) => {
        const { icon: Icon, tone } = ICONS[e.kind];
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-3">
            <span className={cn('relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0', tone)}><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 pt-1">
              <span className="block text-sm font-medium text-gray-900">{e.title}</span>
              {e.detail && <span className="block text-sm text-gray-600 break-words">{e.detail}</span>}
              <span className="block text-xs text-gray-400 mt-0.5">{when(e.at)}{e.by ? ` · ${e.by}` : ''}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
