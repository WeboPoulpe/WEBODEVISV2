'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { accountsError, accountsFrom, isDefaultAccounts, type AccountingAccounts } from '@/lib/accountingExport';
import { companyAccounts } from './accountingExport';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { requireUser, requireWriter } from './session';

// Paramètres > Comptabilité : comptes et journaux de l'export FEC. Réglage de l'entreprise, enregistré sur le
// profil du titulaire (profiles.accounting_settings) : les collaborateurs l'utilisent, seul le titulaire ou un
// gérant le change. Tant que rien n'est réglé (ou si la migration 0029 n'est pas encore passée), ce sont les
// comptes standards de lib/accountingExport.ts.

async function me(uid: string) {
  const [p] = await db.select({ parent: profiles.parent_user_id, role: profiles.company_role }).from(profiles).where(eq(profiles.id, uid)).limit(1);
  return p ?? null;
}

export interface AccountingSettings {
  accounts: AccountingAccounts;
  isDefault: boolean;
  canEdit: boolean;
}

export async function getAccountingSettings(): Promise<AccountingSettings> {
  const user = await requireUser();
  const mine = await me(user.id);
  const accounts = await companyAccounts(mine?.parent ?? user.id);
  return {
    accounts,
    isDefault: isDefaultAccounts(accounts),
    canEdit: !isDemoUser(user.id) && (!mine?.parent || mine.role === 'gerant'),
  };
}

/** Enregistre les comptes ; null : revient aux comptes standards. */
export async function saveAccountingSettings(input: AccountingAccounts | null): Promise<{ error: string | null; accounts?: AccountingAccounts }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const mine = await me(user.id);
  if (mine?.parent && mine.role !== 'gerant') return { error: 'Seul le titulaire du compte ou un gérant peut changer les comptes.' };
  let value: AccountingAccounts | null = null;
  if (input) {
    const error = accountsError(input);
    if (error) return { error };
    value = accountsFrom(input);
    if (isDefaultAccounts(value)) value = null;
  }
  try {
    await db.update(profiles).set({ accounting_settings: value, updated_at: new Date().toISOString() }).where(eq(profiles.id, mine?.parent ?? user.id));
  } catch {
    return { error: 'Les comptes n’ont pas pu être enregistrés. Réessayez dans un instant.' };
  }
  return { error: null, accounts: accountsFrom(value) };
}
