'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { webo_wallets } from '@/db/schema';
import { requireUser, requireWriter } from './session';
import { getWeboSettings } from './settings';
import { companyIdFor, ledgerOf, walletOf, type LedgerRow, type Wallet } from './weboWallet';

// Le portefeuille de WeboCoins vu par le traiteur : tous les membres de l'entreprise le voient ; seuls ceux qui peuvent
// modifier changent le mode de traduction.

export async function getMyWallet(): Promise<{ wallet: Wallet; lowBalance: number }> {
  const user = await requireUser();
  const [wallet, settings] = await Promise.all([walletOf(await companyIdFor(user.id)), getWeboSettings()]);
  return { wallet, lowBalance: settings.lowBalance };
}

export async function getMyLedger(page: number): Promise<{ rows: LedgerRow[]; more: boolean }> {
  const user = await requireUser();
  return ledgerOf(await companyIdFor(user.id), Math.max(0, Math.floor(Number(page) || 0)));
}

export async function setTranslationMode(mode: 'webo' | 'free'): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (mode !== 'webo' && mode !== 'free') return { error: 'Mode inconnu.' };
  const companyId = await companyIdFor(user.id);
  await walletOf(companyId);
  await db.update(webo_wallets).set({ translation_mode: mode }).where(eq(webo_wallets.company_id, companyId));
  return { error: null };
}
