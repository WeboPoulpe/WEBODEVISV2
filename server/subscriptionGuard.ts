import 'server-only';
import { SUBSCRIPTION_REQUIRED_MESSAGE, type Access } from '@/lib/subscription';
import { logAudit } from '@/lib/audit';
import { accessOfUser } from './subscription';

// Porte d'écriture liée à l'abonnement, partagée par requireWriter (server/session.ts) et executeQuery
// (server/compat/execute.ts). Dans le doute, on laisse écrire : un client qui paie ne doit jamais être bloqué.

// Le message vit dans lib/subscription.ts pour que le navigateur le reconnaisse.
export { SUBSCRIPTION_REQUIRED_MESSAGE };

/** Message neutre pour le client final d'un traiteur sans abonnement (acceptation en ligne, « Je veux ce menu »). */
export const OWNER_UNAVAILABLE_MESSAGE = 'Ce traiteur ne peut pas recevoir de réponse en ligne pour le moment, contactez-le directement.';

export class SubscriptionRequiredError extends Error {
  constructor() {
    super(SUBSCRIPTION_REQUIRED_MESSAGE);
    this.name = 'SubscriptionRequiredError';
  }
}

/** Accès de l'entreprise d'un compte ; « full » si on ne peut pas le lire (erreur notée). */
export async function companyAccessOfUser(userId: string): Promise<Access> {
  try {
    return await accessOfUser(userId);
  } catch (e) {
    console.error('companyAccessOfUser : entreprise introuvable, accès laissé', e);
    return 'full';
  }
}

const ADMIN_LOG_EVERY_MS = 60_000;
const lastAdminLog = new Map<string, number>();

/**
 * L'écriture est-elle permise par l'abonnement ? Un administrateur entré dans le compte d'un client sans abonnement
 * peut écrire (dépannage) : c'est inscrit au journal, au plus une fois par minute et par compte.
 */
export async function subscriptionAllowsWrite(userId: string, actingAsAdmin = false): Promise<boolean> {
  const access = await companyAccessOfUser(userId);
  if (access === 'full') return true;
  if (!actingAsAdmin) return false;
  const now = Date.now();
  if (now - (lastAdminLog.get(userId) ?? 0) >= ADMIN_LOG_EVERY_MS) {
    lastAdminLog.set(userId, now);
    await logAudit({ actor: null, target: userId, action: 'ecriture_admin_compte_inactif', details: { access } });
  }
  return true;
}

/** Tests : oublie les inscriptions récentes au journal. */
export function clearAdminWriteLog(): void {
  lastAdminLog.clear();
}
