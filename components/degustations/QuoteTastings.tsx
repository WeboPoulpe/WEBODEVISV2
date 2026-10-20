'use client';

// Dégustations d'un devis, dans sa fiche : rendez-vous prévus ou passés, et bouton pour en planifier un,
// pré-rempli avec le client du devis.

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pill } from '@/components/ui/kit';
import { TASTING_STATUS_LABELS, timeFr, type Tasting } from '@/lib/tastings';
import { getQuoteTastings, type QuoteTastings as Data } from '@/server/tastings';
import TastingModal from './TastingModal';

const dayFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function QuoteTastings({ quoteId }: { quoteId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<Tasting | 'new' | null>(null);

  const load = useCallback(() => {
    getQuoteTastings(quoteId).then(setData).catch(() => setData(null));
  }, [quoteId]);
  useEffect(() => { setData(null); load(); }, [load]);

  // Table pas encore créée, ou devis introuvable : rien à montrer.
  if (!data || !data.available) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dégustation</p>
      {data.tastings.length > 0 && (
        <ul className="space-y-2 mb-2">
          {data.tastings.map((t) => (
            <li key={t.id}>
              <button onClick={() => setOpen(t)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-forest/40 text-left transition-colors">
                <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-forest/10 text-forest flex-shrink-0"><CalendarClock className="h-4 w-4" /></span>
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-sm font-medium first-letter:uppercase', t.status === 'annule' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                    {dayFr(t.tasting_date)} à {timeFr(t.start_time)}
                  </span>
                  <span className="block text-xs text-gray-500 truncate">{[t.location, t.guest_count ? `${t.guest_count} pers.` : null].filter(Boolean).join(', ') || t.client_name}</span>
                </span>
                <span className={cn(pill, t.status === 'prevu' ? 'bg-forest/10 text-forest' : 'bg-gray-100 text-gray-600')}>{TASTING_STATUS_LABELS[t.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data.canEdit && (
        <button onClick={() => setOpen('new')}
          className="flex items-center gap-2 w-full px-3 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-forest/40 hover:text-forest transition-colors">
          <Plus className="h-4 w-4" />Planifier une dégustation
        </button>
      )}
      {open && (
        <TastingModal
          tasting={open === 'new' ? null : open}
          draft={open === 'new' ? { quote_id: quoteId, ...data.defaults } : undefined}
          canEdit={data.canEdit}
          onClose={() => setOpen(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
