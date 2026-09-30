import { NextResponse, type NextRequest } from 'next/server';
import type { QueryDescriptor } from '@/lib/compat/builder';
import { executeQuery } from '@/server/compat/execute';
import { getSessionUser } from '@/server/session';

/**
 * Point d'entrée des requêtes venant du navigateur.
 * L'utilisateur vient de la session, jamais de la requête : les règles d'accès
 * (server/compat/rules.ts) sont appliquées côté serveur à chaque appel.
 * Une route plutôt qu'une fonction serveur : le navigateur peut lancer plusieurs requêtes en parallèle,
 * alors que les fonctions serveur s'exécutent l'une après l'autre.
 */
export async function POST(request: NextRequest) {
  let descriptor: QueryDescriptor;
  try {
    descriptor = await request.json();
  } catch {
    return NextResponse.json({ data: null, count: null, error: { message: 'Requête illisible' } }, { status: 400 });
  }
  if (!descriptor || typeof descriptor.table !== 'string' || !Array.isArray(descriptor.filters) || !Array.isArray(descriptor.order)) {
    return NextResponse.json({ data: null, count: null, error: { message: 'Requête incomplète' } }, { status: 400 });
  }
  const user = await getSessionUser();
  return NextResponse.json(await executeQuery(descriptor, { uid: user?.id ?? null }));
}
