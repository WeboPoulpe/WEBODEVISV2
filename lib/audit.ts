import 'server-only';
import { db } from '@/db';
import { audit_log } from '@/db/schema';

// Journal des actions sensibles (lu dans l'administration). Une écriture qui échoue n'empêche jamais l'action.

export const AUDIT_LABELS = {
  entree_compte_client: 'Entrée dans le compte d’un client',
  sortie_compte_client: 'Sortie du compte d’un client',
  compte_cree: 'Compte créé',
  compte_modifie: 'Identité ou options modifiées',
  compte_desactive: 'Compte désactivé',
  compte_reactive: 'Compte réactivé',
  role_modifie: 'Rôle modifié',
  lien_mot_de_passe: 'Lien de mot de passe envoyé',
  compte_supprime: 'Compte vide supprimé',
  suppression_demandee: 'Suppression demandée par le titulaire',
  suppression_annulee: 'Suppression annulée',
  compte_purge: 'Compte et données effacés',
} as const;

export type AuditAction = keyof typeof AUDIT_LABELS;

export async function logAudit(entry: { actor: string | null; target?: string | null; action: AuditAction; details?: Record<string, unknown> }): Promise<void> {
  try {
    await db.insert(audit_log).values({ actor_id: entry.actor, target_user_id: entry.target ?? null, action: entry.action, details: entry.details ?? null });
  } catch (e) {
    console.error('[journal]', entry.action, e);
  }
}
