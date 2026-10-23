'use client';

// Le portefeuille de WeboCoins de l'entreprise, chargé une fois pour toute l'application et rafraîchi après une dépense.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMyWallet } from '@/server/weboWalletActions';
import type { Wallet } from '@/server/weboWallet';

interface WalletApi {
  wallet: Wallet | null;
  lowBalance: number;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletApi>({ wallet: null, lowBalance: 20, refresh: async () => {} });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [lowBalance, setLowBalance] = useState(20);
  const refresh = useCallback(async () => {
    try {
      const r = await getMyWallet();
      setWallet(r.wallet);
      setLowBalance(r.lowBalance);
    } catch { /* hors ligne, session expirée : le solde n'est simplement pas affiché */ }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <WalletContext.Provider value={{ wallet, lowBalance, refresh }}>{children}</WalletContext.Provider>;
}

export const useWallet = () => useContext(WalletContext);
