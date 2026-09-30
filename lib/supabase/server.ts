import 'server-only';
import { QueryBuilder } from '@/lib/compat/builder';
import { executeQuery } from '@/server/compat/execute';
import { getSessionUser } from '@/server/session';

// Même syntaxe que le client navigateur, exécutée directement côté serveur avec l'utilisateur de la session.
export async function createClient() {
  const user = await getSessionUser();
  return {
    from: (table: string) => new QueryBuilder((d) => executeQuery(d, { uid: user?.id ?? null }), table),
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
    },
  };
}
