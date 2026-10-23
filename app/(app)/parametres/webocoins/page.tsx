'use client';

// « Mes WeboCoins » : le solde de l'entreprise (pièces du mois, pièces gardées), le renouvellement, l'historique des
// mouvements. La recharge par carte arrive bientôt.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { btnPrimary, btnSecondary, cardCls, iconBtn } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import WeboCoin from '@/components/webo/WeboCoin';
import { useWallet } from '@/components/webo/WalletContext';
import { getMyLedger } from '@/server/weboWalletActions';
import type { LedgerRow } from '@/server/weboWallet';

const KIND_LABEL: Record<string, string> = { allocation: 'Offert', debit: 'Dépense', refund: 'Rendu', gift: 'Offert', purchase: 'Achat' };
const nf = new Intl.NumberFormat('fr-FR');
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function WeboCoinsPage() {
  const { wallet, lowBalance, refresh } = useWallet();
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (p: number) => {
    const res = await getMyLedger(p).catch(() => ({ rows: [] as LedgerRow[], more: false }));
    setRows((prev) => (p === 0 ? res.rows : [...(prev ?? []), ...res.rows]));
    setMore(res.more);
    setPage(p);
  }, []);
  useEffect(() => { void refresh(); void load(0); }, [refresh, load]);

  return (
    <div className="px-4 md:px-6 pb-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/parametres" className={iconBtn} aria-label="Retour aux paramètres"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Mes WeboCoins</h1>
      </div>

      <section className={cn(cardCls, 'p-5 md:p-6')}>
        {!wallet ? (
          <div className="flex justify-center py-6 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-3">
              <WeboCoin size={44} />
              <div>
                <p className="text-[32px] font-bold leading-none text-gray-900 tabular-nums">{nf.format(wallet.total)}</p>
                <p className="text-sm text-gray-500 mt-1">WeboCoins</p>
              </div>
            </div>
            <div className="min-w-0 flex-1 text-sm text-gray-600 space-y-0.5">
              <p><strong className="text-gray-900 tabular-nums">{nf.format(wallet.month)}</strong> pièces du mois · Renouvelées le {day(wallet.renewsAt)}</p>
              <p><strong className="text-gray-900 tabular-nums">{nf.format(wallet.kept)}</strong> pièces gardées (offertes ou achetées, sans date de fin)</p>
              {wallet.total < lowBalance && <p className="text-primary font-medium">Il vous reste peu de WeboCoins.</p>}
            </div>
            <div className="w-full sm:w-auto">
              <button type="button" disabled className={cn(btnPrimary, 'w-full sm:w-auto')}>Recharger · bientôt</button>
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-gray-500">
          1 € = 100 WeboCoins. Les pièces du mois sont dépensées en premier ; ce qui en reste ne passe pas au mois suivant.
          Une fiche traduite par Webo coûte 1 pièce. Les WeboCoins ne servent que dans WeboDevis et ne se remboursent pas.
        </p>
      </section>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Historique</h2>
      <section className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
        {rows === null && <div className="flex justify-center py-6 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {rows?.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">Aucun mouvement pour l’instant.</p>}
        {rows?.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-gray-900">{r.reason}</p>
              <p className="text-xs text-gray-500">{when(r.created_at)} · {KIND_LABEL[r.kind] ?? r.kind}{r.user_name ? ` · ${r.user_name}` : ''}</p>
            </div>
            <span className={cn('flex-shrink-0 font-semibold tabular-nums', r.coins < 0 ? 'text-gray-700' : 'text-forest')}>
              {r.coins > 0 ? '+' : '−'}{nf.format(Math.abs(r.coins))} W
            </span>
          </div>
        ))}
      </section>
      {more && (
        <div className="mt-3 flex justify-center">
          <button type="button" disabled={loadingMore} className={btnSecondary}
            onClick={async () => { setLoadingMore(true); await load(page + 1); setLoadingMore(false); }}>
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Voir plus
          </button>
        </div>
      )}
    </div>
  );
}
