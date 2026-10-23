'use client';

// Webo, l'assistant : une bulle sur toutes les pages de l'application, qui ouvre la discussion (panneau à droite,
// plein écran sur téléphone). Webo propose ; le traiteur valide chaque action dans sa carte.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { History, ImagePlus, Loader2, Mic, Plus, Send, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { fileToWebp } from '@/lib/imageToWebp';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import WeboCoin from '@/components/webo/WeboCoin';
import { useWallet } from '@/components/webo/WalletContext';
import { getWeboConversation, listWeboConversations, rateWeboReply, type ProposalView, type TranscriptEntry } from '@/server/webo/chat';
import { streamWebo } from '@/lib/webo/stream';
import ProposalCard from './ProposalCard';

const AGENT_LABEL: Record<string, string> = { devis: 'Devis', factures: 'Factures', catalogue: 'Catalogue', prospects: 'Prospects', journee: 'Journée', aide: 'Aide' };
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
  // Photo jointe (réduite et convertie avant l'envoi) et dictée.
  const [photo, setPhoto] = useState<{ mediaType: 'image/webp' | 'image/jpeg' | 'image/png'; data: string; preview: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const recognition = useRef<{ stop: () => void } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setCanDictate(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) { notify('Photo JPEG, PNG ou WebP.', { tone: 'error' }); return; }
    const small = await fileToWebp(file, { maxDim: 1600, quality: 0.85 }).catch(() => file);
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(small.type)) { notify('Ce format de photo n’a pas pu être lu : prenez-la en JPEG ou faites une capture d’écran.', { tone: 'error' }); return; }
    if (small.size > 5 * 1024 * 1024) { notify('Photo trop lourde (5 Mo au plus).', { tone: 'error' }); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(small); });
    const mediaType = small.type as 'image/webp' | 'image/jpeg' | 'image/png';
    setPhoto({ mediaType, data: dataUrl.split(',')[1] ?? '', preview: dataUrl });
  };

  /** Dictée : la reconnaissance vocale du navigateur (français) écrit dans la zone de saisie. */
  const dictate = () => {
    if (listening) { recognition.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.continuous = false;
    const before = text;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' ').trim();
      if (said) setText(`${before}${before && !before.endsWith(' ') ? ' ' : ''}${said}`);
    };
    rec.onend = () => { setListening(false); recognition.current = null; };
    rec.onerror = () => { setListening(false); recognition.current = null; };
    recognition.current = rec;
    setListening(true);
    rec.start();
  };
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
    const image = photo;
    if ((!msg && !image) || sending) return;
    setSending(true);
    setText('');
    const now = new Date().toISOString();
    setEntries((e) => [...e, { role: 'user', text: image ? `${msg}${msg ? ' ' : ''}[photo jointe]` : msg, at: now }]);
    setPhoto(null);
    setLive({ text: '' });
    let finished = false;
    await streamWebo({ conversationId, text: msg, path: window.location.pathname, image: image ? { mediaType: image.mediaType, data: image.data } : null }, (ev) => {
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
                    {e.role === 'assistant' && conversationId && (
                      <div className="mt-1 flex gap-1">
                        {([['up', 'Réponse utile', ThumbsUp], ['down', 'Réponse à revoir', ThumbsDown]] as const).map(([r, label, Icon]) => (
                          <button key={r} type="button" aria-label={label} aria-pressed={e.rating === r} title={label}
                            onClick={async () => {
                              const next = e.rating === r ? null : r;
                              const res = await rateWeboReply(conversationId, i, next).catch(() => ({ error: 'Note non enregistrée.' }));
                              if (res.error) { notify(res.error, { tone: 'error' }); return; }
                              setEntries((list) => list.map((x, j) => (j === i ? { ...x, rating: next ?? undefined } : x)));
                            }}
                            className={cn('rounded-md p-1', e.rating === r ? 'text-primary' : 'text-gray-300 hover:text-gray-500')}>
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
                    )}
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
            {photo && (
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt="Photo jointe" className="h-12 w-12 rounded-lg object-cover" />
                <span className="flex-1">Photo jointe</span>
                <button type="button" onClick={() => setPhoto(null)} aria-label="Retirer la photo" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" aria-label="Choisir une photo"
                onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => fileInput.current?.click()} aria-label="Joindre une photo" title="Joindre une photo (menu, ancien devis)"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><ImagePlus className="h-4 w-4" /></button>
                {canDictate && (
                  <button type="button" onClick={dictate} aria-label={listening ? 'Arrêter la dictée' : 'Dicter'} aria-pressed={listening}
                    title="Dicter (reconnaissance vocale du navigateur)"
                    className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg', listening ? 'bg-primary-50 text-primary animate-pulse' : 'text-gray-500 hover:bg-gray-100')}><Mic className="h-4 w-4" /></button>
                )}
              </div>
              <textarea ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} rows={2} maxLength={4000}
                aria-label="Votre message à Webo" placeholder="Demandez à Webo…"
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-[15px] focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
              <button type="submit" disabled={sending || (!text.trim() && !photo)} aria-label="Envoyer"
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

/** Ce que la dictée utilise de la reconnaissance vocale du navigateur. */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
