'use client';

// Webo, l'assistant : une bulle sur toutes les pages de l'application, qui ouvre la discussion (panneau à droite,
// plein écran sur téléphone), ou la page /webo pour l'historique complet. Webo propose ; le traiteur valide.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, Maximize2, Plus, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import WeboCoin from '@/components/webo/WeboCoin';
import { useWallet } from '@/components/webo/WalletContext';
import { listWeboConversations, type ConversationRow } from '@/server/webo/chat';
import WeboChat from './WeboChat';

export const LAST_KEY = 'webo:last-conversation';

export default function WeboAssistant() {
  const pathname = usePathname();
  const { wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversationRow[] | null>(null);

  // À l'ouverture : la dernière conversation, si elle existe encore.
  useEffect(() => {
    if (!open || conversationId) return;
    try { const last = localStorage.getItem(LAST_KEY); if (last) setConversationId(last); } catch { /* stockage indisponible */ }
  }, [open, conversationId]);
  useEffect(() => {
    try { if (conversationId) localStorage.setItem(LAST_KEY, conversationId); } catch { /* stockage indisponible */ }
  }, [conversationId]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // La page Webo a sa propre conversation : pas de bulle par-dessus.
  if (pathname?.startsWith('/webo')) return null;

  const fresh = () => {
    setConversationId(null); setHistory(null);
    try { localStorage.removeItem(LAST_KEY); } catch { /* stockage indisponible */ }
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir Webo"
          className="fixed right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-forest px-4 text-sm font-semibold text-white shadow-lg hover:bg-forest/90 print:hidden"
          style={{ bottom: 'calc(var(--tabbar-h, 0px) + 16px)' }}>
          <Sparkles className="h-5 w-5 text-[#E9D18A]" /> <span className="hidden sm:inline">Webo</span>
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="false" aria-label="Webo"
          className="fixed inset-0 z-50 flex flex-col bg-[#FBF7F0] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-[#E6DFD3] print:hidden">
          <header className="flex items-center gap-2 border-b border-[#E6DFD3] bg-white px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 leading-tight">Webo</p>
              <p className="flex items-center gap-1 text-xs text-gray-500">
                <WeboCoin size={12} /> {wallet ? `${new Intl.NumberFormat('fr-FR').format(wallet.total)} WeboCoins` : '…'} · chaque réponse est payée à son coût
              </p>
            </div>
            <button type="button" onClick={async () => setHistory(history ? null : (await listWeboConversations().catch(() => ({ rows: [] as ConversationRow[] }))).rows)} aria-label="Conversations précédentes" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><History className="h-4 w-4" /></button>
            <button type="button" onClick={fresh} aria-label="Nouvelle conversation" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Plus className="h-4 w-4" /></button>
            <Link href={conversationId ? `/webo?c=${conversationId}` : '/webo'} onClick={() => setOpen(false)} aria-label="Agrandir Webo" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Maximize2 className="h-4 w-4" /></Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer Webo" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </header>

          {history && (
            <nav aria-label="Conversations précédentes" className="max-h-60 overflow-y-auto border-b border-[#E6DFD3] bg-white">
              {history.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">Aucune conversation.</p>}
              {history.map((h) => (
                <button key={h.id} type="button" onClick={() => { setConversationId(h.id); setHistory(null); }}
                  className={cn('block w-full truncate px-4 py-2 text-left text-sm hover:bg-gray-50', h.id === conversationId ? 'font-semibold text-primary' : 'text-gray-800')}>
                  {h.title || 'Sans titre'}
                </button>
              ))}
              <Link href="/webo" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm text-primary hover:bg-gray-50">Tout l’historique</Link>
            </nav>
          )}

          <WeboChat value={conversationId} onChange={setConversationId} />
        </div>
      )}
    </>
  );
}
