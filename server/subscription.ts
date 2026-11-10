import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { company_subscriptions, profiles } from '@/db/schema';
import { accessFrom, type Access, type SubRow } from '@/lib/subscription';
import { isDemoUser } from '@/lib/demo';
import { getBillingEnforced, onBillingEnforcedChange } from './settings';
import { companyIdFor } from './weboWallet';

// Accès d'une entreprise à l'application selon son abonnement (règle : lib/subscription.ts).

export type SubscriptionRow = SubRow & { stripe_customer_id: string | null; stripe_subscription_id: string | null };

export async function getSubscription(companyId: string): Promise<SubscriptionRow | null> {
  const [row] = await db.select({
    status: company_subscriptions.status,
    comped: company_subscriptions.comped,
    ever_subscribed: company_subscriptions.ever_subscribed,
    cancel_at_period_end: company_subscriptions.cancel_at_period_end,
    current_period_end: company_subscriptions.current_period_end,
    plan: company_subscriptions.plan,
    anchor_day: company_subscriptions.anchor_day,
    stripe_customer_id: company_subscriptions.stripe_customer_id,
    stripe_subscription_id: company_subscriptions.stripe_subscription_id,
  }).from(company_subscriptions).where(eq(company_subscriptions.company_id, companyId)).limit(1);
  return (row as SubscriptionRow | undefined) ?? null;
}

const TTL_MS = 60_000;
const accessCache = new Map<string, { access: Access; at: number }>();
let enforcedCache: { value: boolean; at: number } | null = null;

/** Vide tout le cache (changement du réglage ; tests). */
export function clearAccessCache(): void {
  accessCache.clear();
  enforcedCache = null;
}
onBillingEnforcedChange(clearAccessCache);

async function enforced(): Promise<boolean> {
  if (enforcedCache && Date.now() - enforcedCache.at < TTL_MS) return enforcedCache.value;
  const value = await getBillingEnforced();
  enforcedCache = { value, at: Date.now() };
  return value;
}

/**
 * Accès d'une entreprise. Seul « full » est gardé 60 s en mémoire : le cache est propre à chaque instance, donc un refus
 * est toujours relu en base (un client qui vient de payer ne reste pas bloqué sur une autre instance).
 * Dans le doute (base injoignable), on laisse l'accès, sans le garder.
 */
export async function accessOf(companyId: string): Promise<Access> {
  const hit = accessCache.get(companyId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.access;
  try {
    // Un compte administrateur n'est jamais soumis à l'abonnement (sinon il se verrouille lui-même).
    const [profile] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
    const access: Access = profile?.role === 'admin'
      ? 'full'
      : accessFrom(await getSubscription(companyId), { demo: isDemoUser(companyId), enforced: await enforced() });
    if (access === 'full') accessCache.set(companyId, { access, at: Date.now() });
    return access;
  } catch (e) {
    console.error('accessOf : lecture de l’abonnement impossible, accès laissé', e);
    return 'full';
  }
}

export async function accessOfUser(userId: string): Promise<Access> {
  return accessOf(await companyIdFor(userId));
}

/** À appeler après tout changement d'abonnement de l'entreprise (webhook, accès offert). */
export function invalidateAccess(companyId: string): void {
  accessCache.delete(companyId);
}

/** Accès offert (compte bêta, geste commercial) ; la ligne est créée au besoin. Offrir compte comme « déjà abonné ». */
export async function setComped(companyId: string, comped: boolean, note: string): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(company_subscriptions).values({ company_id: companyId, comped, comped_note: note, ever_subscribed: comped })
    .onConflictDoUpdate({
      target: company_subscriptions.company_id,
      set: { comped, comped_note: note, updated_at: now, ...(comped ? { ever_subscribed: true } : {}) },
    });
  invalidateAccess(companyId);
}
