import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { activitySummary, type ActivityAction, type ActivityEntity } from '@/lib/activity';
import { isDemoUser } from '@/lib/demo';

// Écriture dans l'historique (page Historique) depuis une fonction serveur. Une écriture qui échoue n'empêche jamais
// l'action : elle est seulement signalée dans les journaux du serveur.

export interface ActivityInput {
  /** Entreprise (compte titulaire). Obligatoire quand il n'y a pas d'auteur (le client, une tâche automatique). */
  company?: string | null;
  actor: string | null;
  viaAdmin?: boolean;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
}

export async function logActivity(e: ActivityInput): Promise<void> {
  if (isDemoUser(e.actor) || isDemoUser(e.company)) return;
  try {
    const summary = e.summary ?? activitySummary(e.action, e.entity, e.label);
    await db.execute(sql`select public.log_activity(${e.company ?? null}::uuid, ${e.actor}::uuid, ${!!e.viaAdmin}, ${e.action},
      ${e.entity}, ${e.entityId ?? null}::uuid, ${e.label}, ${summary}, ${e.details ? JSON.stringify(e.details) : null}::jsonb)`);
  } catch (err) {
    console.error('[historique]', e.action, e.entity, err);
  }
}
