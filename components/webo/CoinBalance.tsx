'use client';

// Pastille de l'en-tête : la pièce W et le solde de WeboCoins ; mène à « Mes WeboCoins ». Terracotta quand il reste peu.

import Link from 'next/link';
import { cn } from '@/lib/utils';
import WeboCoin from './WeboCoin';
import { useWallet } from './WalletContext';

export default function CoinBalance() {
  const { wallet, lowBalance } = useWallet();
  if (!wallet) return null;
  const low = wallet.total < lowBalance;
  return (
    <Link href="/parametres/webocoins" aria-label={`Solde : ${wallet.total} WeboCoins`}
      title={low ? 'Il vous reste peu de WeboCoins' : 'Mes WeboCoins'}
      className={cn('inline-flex h-10 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-semibold tabular-nums transition-colors',
        low ? 'border-primary/40 bg-primary-50 text-primary' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300')}>
      <WeboCoin size={18} />
      {new Intl.NumberFormat('fr-FR').format(wallet.total)}
    </Link>
  );
}
