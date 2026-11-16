'use client';

// Choix des destinataires d'une brochure : les clients du fichier (recherche, cases à cocher) et des adresses libres.

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inputCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { BrochureRecipient } from '@/lib/brochureRecipients';

interface CustomerRow {
  id: string;
  customer_type: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
}

const nameOf = (c: CustomerRow) =>
  (c.customer_type === 'entreprise' && c.company_name) || [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company_name || c.email || '';
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function RecipientPicker({ chosen, onChosen, typed, onTyped, max }: {
  chosen: BrochureRecipient[];
  onChosen: (v: BrochureRecipient[]) => void;
  /** Adresses tapées à la main (séparées par des virgules). */
  typed: string;
  onTyped: (v: string) => void;
  max: number;
}) {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    createClient().from('customers').select('id, customer_type, first_name, last_name, company_name, email').order('created_at', { ascending: false }).limit(2000)
      .then(({ data }: { data: CustomerRow[] | null }) => { if (alive) setCustomers(data ?? []); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const q = fold(search.trim());
    const list = customers ?? [];
    return (q ? list.filter((c) => fold(`${nameOf(c)} ${c.email ?? ''}`).includes(q)) : list).slice(0, 60);
  }, [customers, search]);

  const isChosen = (id: string) => chosen.some((r) => r.customerId === id);
  const toggle = (c: CustomerRow) => {
    if (!c.email) return;
    if (isChosen(c.id)) onChosen(chosen.filter((r) => r.customerId !== c.id));
    else if (chosen.length < max) onChosen([...chosen, { email: c.email, name: nameOf(c), customerId: c.id }]);
  };

  return (
    <div className="space-y-2">
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Clients choisis">
          {chosen.map((r) => (
            <li key={r.customerId ?? r.email} className="inline-flex items-center gap-1 rounded-full bg-primary-50 pl-2.5 pr-1 py-0.5 text-xs font-medium text-primary">
              {r.name || r.email}
              <button type="button" onClick={() => onChosen(chosen.filter((x) => x !== r))} className="rounded-full p-0.5 hover:bg-primary/10" aria-label={`Retirer ${r.name || r.email}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-gray-200">
        <label className="flex items-center gap-2 border-b border-gray-100 px-3">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client" aria-label="Rechercher un client"
            className="w-full bg-transparent py-2 text-sm outline-none" />
        </label>
        <div className="max-h-52 overflow-y-auto py-1">
          {customers === null ? (
            <div className="flex justify-center py-4 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">{customers.length ? 'Aucun client ne correspond.' : 'Aucun client dans votre fichier.'}</p>
          ) : shown.map((c) => {
            const on = isChosen(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c)} disabled={!c.email || (!on && chosen.length >= max)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50', on && 'bg-primary-50/50')}>
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-white' : 'border-gray-300')}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{nameOf(c)}</span>
                  <span className="block truncate text-xs text-gray-500">{c.email || 'Pas d’adresse email'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Autres adresses</span>
        <input type="text" value={typed} onChange={(e) => onTyped(e.target.value)} placeholder="client@exemple.fr, autre@exemple.fr" className={inputCls} />
      </label>
      <p className="text-xs text-gray-500">{chosen.length} client{chosen.length > 1 ? 's' : ''} choisi{chosen.length > 1 ? 's' : ''} · {max} destinataires au plus par envoi.</p>
    </div>
  );
}
