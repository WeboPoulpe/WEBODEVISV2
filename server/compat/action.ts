'use server';

import type { QueryDescriptor, QueryResult } from '@/lib/compat/builder';
import { getSessionUser } from '@/server/session';
import { executeQuery } from './execute';

/**
 * Point d'entrée unique des requêtes venant du navigateur.
 * L'utilisateur vient de la session, jamais de la requête : les règles d'accès
 * (server/compat/rules.ts) sont appliquées côté serveur à chaque appel.
 */
export async function runQuery(descriptor: QueryDescriptor): Promise<QueryResult> {
  const user = await getSessionUser();
  return executeQuery(descriptor, { uid: user?.id ?? null });
}
