'use client';

// Webo en plein écran, comme Claude : l'historique des conversations à gauche (par date, recherche, renommer,
// supprimer), la conversation à droite. Sur téléphone : la liste, puis la conversation choisie.

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import WeboCoin from '@/components/webo/WeboCoin';
import { useWallet } from '@/components/webo/WalletContext';
import WeboChat from '@/components/webo/assistant/WeboChat';
import { deleteWeboConversation, listWeboConversations, renameWeboConversation, type ConversationRow } from '@/server/webo/chat';

const DAY = 86_400_000;
function groupOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = d.getTime();
  if (t >= today.getTime()) return 'Aujourd’hui';
  if (t >= today.getTime() - DAY) return 'Hier';
  if (t >= today.getTime() - 7 * DAY) return '7 derniers jours';
  if (t >= today.getTime() - 30 * DAY) return '30 derniers jours';
  return 'Plus ancien';
}

function WeboPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { notify, confirm } = useFeedback();
  const { wallet } = useWallet();
  const [conversationId, setConversationId] = useState<string | null>(params.get('c'));
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  // Téléphone : la liste, ou la conversation (choisie ou nouvelle).
  const [chatOpen, setChatOpen] = useState(!!params.get('c'));

  const load = useCallback(async (p: number, q: string) => {
    const res = await listWeboConversations({ page: p, query: q || undefined }).catch(() => ({ rows: [] as ConversationRow[], more: false }));
    setRows((prev) => (p === 0 ? res.rows : [...(prev ?? []), ...res.rows]));
    setMore(res.more);
    setPage(p);
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(0, query), 250); return () => clearTimeout(t); }, [query, load]);

  const choose = (id: string | null) => {
    setConversationId(id);
    setChatOpen(true);
    router.replace(id ? `/webo?c=${id}` : '/webo', { scroll: false });
  };
  // Une conversation créée par Webo apparaît en tête de liste.
  const onChange = (id: string | null) => {
    if (id && !rows?.some((r) => r.id === id)) void load(0, query);
    choose(id);
  };

  const rename = async () => {
    if (!renaming) return;
    const res = await renameWeboConversation(renaming.id, renaming.title).catch(() => ({ error: 'Pas renommée.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    setRows((list) => (list ?? []).map((r) => (r.id === renaming.id ? { ...r, title: renaming.title.trim() } : r)));
    setRenaming(null);
  };
  const remove = async (row: ConversationRow) => {
    if (!(await confirm({ title: 'Supprimer cette conversation ?', message: `« ${row.title || 'Sans titre'} » et ses propositions en attente seront supprimées. Ce qui a déjà été validé (devis, factures…) reste.`, danger: true }))) return;
    const res = await deleteWeboConversation(row.id).catch(() => ({ error: 'Pas supprimée.' }));
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    setRows((list) => (list ?? []).filter((r) => r.id !== row.id));
    if (conversationId === row.id) { choose(null); setChatOpen(false); }
  };

  const groups: [string, ConversationRow[]][] = [];
  for (const r of rows ?? []) {
    const g = groupOf(r.updated_at);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(r); else groups.push([g, [r]]);
  }

  return (
    <div className="flex h-full min-h-0">
      <aside aria-label="Conversations" className={cn('flex w-full flex-col border-r border-[#E6DFD3] bg-white md:w-80 md:flex-shrink-0', chatOpen && 'hidden md:flex')}>
        <div className="space-y-3 border-b border-[#E6DFD3] p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="flex-1 text-lg font-bold text-gray-900">Webo</h1>
            <span className="flex items-center gap-1 text-xs text-gray-500"><WeboCoin size={12} />{wallet ? new Intl.NumberFormat('fr-FR').format(wallet.total) : '…'}</span>
          </div>
          <button type="button" onClick={() => choose(null)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <Plus className="h-4 w-4" /> Nouvelle conversation
          </button>
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher dans l’historique" aria-label="Rechercher dans l’historique"
              className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-[16px] md:text-sm focus:border-primary-400 focus:outline-none" />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {rows === null && <div className="flex justify-center py-6 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {rows?.length === 0 && <p className="px-2 py-4 text-sm text-gray-500">{query ? 'Aucune conversation trouvée.' : 'Aucune conversation pour l’instant.'}</p>}
          {groups.map(([label, list]) => (
            <section key={label} className="mb-3">
              <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</h2>
              <ul>
                {list.map((r) => (
                  <li key={r.id} className={cn('group flex items-center gap-1 rounded-lg', r.id === conversationId ? 'bg-primary-50' : 'hover:bg-gray-50')}>
                    {renaming?.id === r.id ? (
                      <input autoFocus value={renaming.title} aria-label="Nouveau titre" maxLength={120}
                        onChange={(e) => setRenaming({ id: r.id, title: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') void rename(); if (e.key === 'Escape') setRenaming(null); }}
                        onBlur={() => void rename()}
                        className="m-1 h-8 flex-1 rounded-md border border-gray-200 px-2 text-sm" />
                    ) : (
                      <button type="button" onClick={() => choose(r.id)} className={cn('min-w-0 flex-1 truncate px-2 py-2 text-left text-sm', r.id === conversationId ? 'font-semibold text-primary' : 'text-gray-800')}>
                        {r.title || 'Sans titre'}
                      </button>
                    )}
                    <button type="button" onClick={() => setRenaming({ id: r.id, title: r.title })} aria-label={`Renommer « ${r.title} »`} className="rounded-md p-1.5 text-gray-400 hover:text-gray-700 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void remove(r)} aria-label={`Supprimer « ${r.title} »`} className="rounded-md p-1.5 text-gray-400 hover:text-danger md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {more && <button type="button" onClick={() => void load(page + 1, query)} className="w-full py-2 text-sm text-primary">Voir plus</button>}
        </div>
      </aside>
      <section aria-label="Conversation avec Webo" className={cn('min-w-0 flex-1 flex-col bg-[#FBF7F0]', chatOpen ? 'flex' : 'hidden md:flex')}>
        <div className="flex items-center gap-2 border-b border-[#E6DFD3] bg-white px-3 py-2 md:hidden">
          <button type="button" onClick={() => setChatOpen(false)} aria-label="Retour aux conversations" className="rounded-lg p-2 text-gray-500"><ArrowLeft className="h-4 w-4" /></button>
          <span className="truncate text-sm font-semibold">{rows?.find((r) => r.id === conversationId)?.title ?? 'Webo'}</span>
        </div>
        <WeboChat value={conversationId} onChange={onChange} wide />
      </section>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><WeboPage /></Suspense>;
}
