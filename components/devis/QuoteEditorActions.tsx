'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Copy, Loader2, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { isConfirmed, QUOTE_STATUSES, QUOTE_STATUS_LABELS } from '@/lib/quoteStatus';
import { cn } from '@/lib/utils';
import SendQuoteModal from './SendQuoteModal';
import DuplicateQuoteModal from './DuplicateQuoteModal';

// Actions du devis depuis l'éditeur : statut, envoi au client, copie, événement. Plus besoin de repasser par la liste.
// Envoyer et dupliquer enregistrent d'abord le document ouvert.

interface QuoteMeta { status: string; client_email: string | null; event_type: string | null; event_date: string | null; prospect_id: string | null }

/** Demande à l'éditeur d'enregistrer et attend le résultat. */
const saveOpenDocument = () => new Promise<boolean>((resolve) => {
  const timer = setTimeout(() => resolve(true), 15_000);
  window.dispatchEvent(new CustomEvent('weboword:save', { detail: { done: (ok: boolean) => { clearTimeout(timer); resolve(ok); } } }));
});

export default function QuoteEditorActions({ quoteId, itemBase, itemIdle, light }: { quoteId: string; itemBase: string; itemIdle: string; /** Menu clair (téléphone) plutôt que la barre latérale foncée. */ light?: boolean }) {
  const { user, profile } = useAuth();
  const [meta, setMeta] = useState<QuoteMeta | null>(null);
  const [busy, setBusy] = useState<'send' | 'copy' | 'status' | null>(null);
  const [open, setOpen] = useState<'send' | 'copy' | null>(null);

  const load = useCallback(() => {
    createClient().from('quotes').select('status, client_email, event_type, event_date, prospect_id').eq('id', quoteId).maybeSingle()
      .then(({ data }) => { if (data) setMeta(data as QuoteMeta); });
  }, [quoteId]);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (status: string) => {
    if (!meta) return;
    setBusy('status');
    const supabase = createClient();
    const { error } = await supabase.from('quotes').update({ status }).eq('id', quoteId);
    if (!error && meta.prospect_id) await supabase.from('prospect_requests').update({ status }).eq('id', meta.prospect_id);
    setBusy(null);
    if (error) { alert('Le statut n’a pas pu être changé. Réessayez.'); return; }
    setMeta({ ...meta, status });
  };

  const saveThenOpen = async (what: 'send' | 'copy') => {
    setBusy(what);
    const ok = await saveOpenDocument();
    setBusy(null);
    if (ok) { load(); setOpen(what); }
  };

  if (!meta) return null;
  return (
    <>
      <label className={cn('block px-3 pt-2', !light && 'sb-label')}>
        <span className={cn('block text-xs mb-1', light ? 'text-gray-500' : 'text-white/50')}>Statut du devis</span>
        <select value={meta.status} onChange={(e) => changeStatus(e.target.value)} disabled={busy === 'status'} aria-label="Statut du devis"
          className={cn('w-full h-10 px-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 [&>option]:text-gray-900', light ? 'bg-white text-gray-900 border border-gray-200 focus:ring-primary/30' : 'bg-white/[0.08] text-white border border-white/10 focus:ring-white/30')}>
          {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{QUOTE_STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <button onClick={() => saveThenOpen('send')} disabled={!!busy} title="Envoyer au client" className={cn(itemBase, itemIdle, 'w-full')}>
        {busy === 'send' ? <Loader2 className="h-[18px] w-[18px] flex-shrink-0 animate-spin" /> : <Send className="h-[18px] w-[18px] flex-shrink-0" />}
        <span className={light ? undefined : 'sb-label'}>Envoyer au client</span>
      </button>
      <button onClick={() => saveThenOpen('copy')} disabled={!!busy} title="Dupliquer" className={cn(itemBase, itemIdle, 'w-full')}>
        {busy === 'copy' ? <Loader2 className="h-[18px] w-[18px] flex-shrink-0 animate-spin" /> : <Copy className="h-[18px] w-[18px] flex-shrink-0" />}
        <span className={light ? undefined : 'sb-label'}>Dupliquer</span>
      </button>
      {isConfirmed(meta.status) && (
        <Link href={`/evenements/${quoteId}`} title="Préparer l’événement" className={cn(itemBase, itemIdle)}>
          <CalendarCheck className="h-[18px] w-[18px] flex-shrink-0" />
          <span className={light ? undefined : 'sb-label'}>Préparer l’événement</span>
        </Link>
      )}

      {open === 'send' && (
        <SendQuoteModal
          quote={{ id: quoteId, client_email: meta.client_email, event_type: meta.event_type, event_date: meta.event_date }}
          companyName={profile?.company_name}
          onClose={() => setOpen(null)}
          onSent={({ status, clientEmail }) => setMeta((m) => (m ? { ...m, status: status ?? m.status, client_email: clientEmail ?? m.client_email } : m))}
        />
      )}
      {open === 'copy' && user && <DuplicateQuoteModal quoteId={quoteId} userId={user.id} onClose={() => setOpen(null)} />}
    </>
  );
}
