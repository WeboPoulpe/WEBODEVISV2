import { NextResponse, type NextRequest } from 'next/server';
import type { QueryDescriptor } from '@/lib/compat/builder';
import { executeQuery } from '@/server/compat/execute';
import { getSessionUser } from '@/server/session';

/**
 * Point d'entrée des requêtes venant du navigateur.
 * L'utilisateur vient de la session, jamais de la requête : les règles d'accès
 * (server/compat/rules.ts) sont appliquées côté serveur à chaque appel.
 * Le navigateur regroupe les requêtes lancées au même moment en un seul appel (voir lib/supabase/client.ts).
 */
const MAX_BATCH = 40;

export async function POST(request: NextRequest) {
  let body: { batch?: QueryDescriptor[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requête illisible' }, { status: 400 });
  }
  const batch = body?.batch;
  const valid = (d: QueryDescriptor) => d && typeof d.table === 'string' && Array.isArray(d.filters) && Array.isArray(d.order);
  if (!Array.isArray(batch) || batch.length === 0 || batch.length > MAX_BATCH || !batch.every(valid)) {
    return NextResponse.json({ error: 'Requête incomplète' }, { status: 400 });
  }
  // La session est lue une fois pour tout le lot ; les requêtes s'exécutent en parallèle.
  const user = await getSessionUser();
  const results = await Promise.all(batch.map((d) => executeQuery(d, { uid: user?.id ?? null })));
  return NextResponse.json({ results });
}
