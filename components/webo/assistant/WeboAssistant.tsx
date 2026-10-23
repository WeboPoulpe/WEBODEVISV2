'use client';

// Webo, l'assistant : une bulle sur toutes les pages de l'application, qui ouvre la discussion (panneau à droite,
// plein écran sur téléphone). Webo propose ; le traiteur valide chaque action dans sa carte.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { History, Loader2, Plus, Send, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import WeboCoin from '@/components/webo/WeboCoin';
import { useWallet } from '@/components/webo/WalletContext';
import { getWeboConversation, listWeboConversations, type ProposalView, type TranscriptEntry } from '@/server/webo/chat';
import { streamWebo } from '@/lib/webo/stream';
import ProposalCard from './ProposalCard';

const AGENT_LABEL: Record<string, string> = { devis: 'Devis', factures: 'Factures', catalogue: 'Catalogue', prospects: 'Prospects', aide: 'Aide' };
const SUGGESTIONS = [
  'Prépare un devis pour un mariage de 80 personnes le 14 juin, menu Tentation',
  'Fais l’acompte de 30 % du dernier devis',
  'Comment je fais une variante de devis ?',
];
const LAST_KEY = 'webo:last-conversation';

export default function WeboAssistant() {
  const { notify } = useFeedback();
  const { wallet, refresh } = useWallet();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [proposals, setProposals] = useState<Record<string, ProposalView>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Réponse en cours, affichée au fil de l'eau.
  const [live, setLive] = useState<{ agent?: string; text: string } | null>(null);
  const [history, setHistory] = useState<{ id: string; title: string; updated_at: string }[] | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async (id: string) => {
    const conv = await getWeboConversation(id).catch(() => null);
    if (!conv) return;
    setConversationId(conv.id);
    setEntries(conv.transcript);
    setProposals(conv.proposals);
  }, []);

  // À l'ouverture : la dernière conversation, si elle existe encore.
  useEffect(() => {
    if (!open || conversationId) return;
    let last: string | null = null;
    try { last = localStorage.getItem(LAST_KEY); } catch { /* stockage indisponible */ }
    if (last) void load(last);
  }, [open, conversationId, load]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [entries, sending]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (message = text) => {
    const msg = message.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    const now = new Date().toISOString();
    setEntries((e) => [...e, { role: 'user', text: msg, at: now }]);
    setLive({ text: '' });
    let finished = false;
    await streamWebo({ conversationId, text: msg, path: window.location.pathname }, (ev) => {
      if (ev.type === 'agent') setLive((l) => ({ text: l?.text ?? '', agent: ev.agent }));
      else if (ev.type === 'text') setLive((l) => ({ agent: l?.agent, text: (l?.text ?? '') + ev.delta }));
      else if (ev.type === 'done') {
        finished = true;
        const reply = ev.reply;
        setConversationId(ev.conversationId);
        try { localStorage.setItem(LAST_KEY, ev.conversationId); } catch { /* stockage indisponible */ }
        setProposals((p) => ({ ...p, ...Object.fromEntries(reply.proposals.map((x) => [x.id, x])) }));
        setEntries((e) => [...e, { role: 'assistant', text: reply.text, agent: reply.agent, proposalIds: reply.proposals.map((x) => x.id), coins: reply.coins, at: new Date().toISOString() }]);
      } else if (ev.type === 'error') {
        finished = true;
        if (ev.conversationId) {
          // Échange gardé côté serveur (réponse ratée mais payée) : on le recharge tel quel.
          setConversationId(ev.conversationId);
          void load(ev.conversationId);
        } else {
          setEntries((e) => e.slice(0, -1));
          setText(msg);
        }
        notify(ev.error, { tone: 'error' });
      }
    }).catch(() => {
      if (!finished) { setEntries((e) => e.slice(0, -1)); setText(msg); notify('Webo n’a pas pu répondre. Vérifiez votre connexion.', { tone: 'error' }); }
    });
    setLive(null);
    setSending(false);
    void refresh();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const fresh = () => {
    setConversationId(null); setEntries([]); setProposals({}); setHistory(null);
    try { localStorage.removeItem(LAST_KEY); } catch { /* stockage indisponible */ }
    input.current?.focus();
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
            <button type="button" onClick={async () => setHistory(history ? null : await listWeboConversations().catch(() => []))} aria-label="Conversations précédentes" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><History className="h-4 w-4" /></button>
            <button type="button" onClick={fresh} aria-label="Nouvelle conversation" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><Plus className="h-4 w-4" /></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer Webo" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
          </header>

          {history && (
            <nav aria-label="Conversations précédentes" className="max-h-60 overflow-y-auto border-b border-[#E6DFD3] bg-white">
              {history.length === 0 && <p className="px-4 py-3 text-sm text-gray-500">Aucune conversation.</p>}
              {history.map((h) => (
                <button key={h.id} type="button" onClick={async () => { await load(h.id); setHistory(null); try { localStorage.setItem(LAST_KEY, h.id); } catch { /* */ } }}
                  className={cn('block w-full truncate px-4 py-2 text-left text-sm hover:bg-gray-50', h.id === conversationId ? 'font-semibold text-primary' : 'text-gray-800')}>
                  {h.title || 'Sans titre'}
                </button>
              ))}
            </nav>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {entries.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">Bonjour ! Je suis Webo. Je prépare vos devis, factures, prestations et réponses aux prospects : vous validez chaque action avant qu’elle soit faite.</p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => setText(s)} className="block w-full rounded-xl border border-[#E6DFD3] bg-white px-3 py-2 text-left text-sm text-gray-800 hover:border-primary/40">{s}</button>
                  ))}
                </div>
              </div>
            )}
            <ul className="space-y-3">
              {entries.map((e, i) => (
                <li key={i} className={cn('flex', e.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[92%] text-sm', e.role === 'user' ? 'rounded-2xl rounded-br-md bg-primary-50 px-3 py-2 text-gray-900' : 'w-full')}>
                    {e.role === 'assistant' && (
                      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Webo{e.agent ? ` · ${AGENT_LABEL[e.agent] ?? e.agent}` : ''}{e.coins ? <span className="font-normal normal-case tracking-normal">· {e.coins} W</span> : null}
                      </p>
                    )}
                    <p className={cn('whitespace-pre-line break-words', e.role === 'assistant' && 'rounded-2xl rounded-bl-md bg-white px-3 py-2 text-gray-900 shadow-sm')}>{e.text}</p>
                    {(e.proposalIds ?? []).map((id) => proposals[id] && (
                      <ProposalCard key={id} proposal={proposals[id]}
                        onChange={(next) => setProposals((p) => ({ ...p, [id]: next }))}
                        onModify={(title) => { setText(`Pour « ${title} » : `); input.current?.focus(); }} />
                    ))}
                  </div>
                </li>
              ))}
              {sending && live?.text ? (
                <li className="flex justify-start">
                  <div className="w-full max-w-[92%] text-sm">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Webo{live.agent ? ` · ${AGENT_LABEL[live.agent] ?? live.agent}` : ''}</p>
                    <p className="whitespace-pre-line break-words rounded-2xl rounded-bl-md bg-white px-3 py-2 text-gray-900 shadow-sm">{live.text}</p>
                  </div>
                </li>
              ) : sending && (
                <li className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Webo réfléchit…</li>
              )}
            </ul>
            <div ref={bottom} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="border-t border-[#E6DFD3] bg-white p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-end gap-2">
              <textarea ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} rows={2} maxLength={4000}
                aria-label="Votre message à Webo" placeholder="Demandez à Webo…"
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-[15px] focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
              <button type="submit" disabled={sending || !text.trim()} aria-label="Envoyer"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-dark disabled:opacity-40">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
