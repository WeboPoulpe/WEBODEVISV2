import { getSession } from 'next-auth/react';
import { QueryBuilder, type QueryDescriptor } from '@/lib/compat/builder';
import { runQuery } from '@/server/compat/action';

// Client historique de l'app, désormais branché sur Neon : même syntaxe `.from(...).select(...)`,
// mais chaque requête passe par le serveur, qui applique les règles d'accès.

const STORAGE_PENDING = { message: 'Le stockage de fichiers est en cours de migration.' };

// Passage en JSON comme le faisait supabase-js : les `undefined` disparaissent, les dates deviennent du texte.
const execute = (d: QueryDescriptor) => runQuery(JSON.parse(JSON.stringify(d)) as QueryDescriptor);

export function createClient() {
  return {
    from: (table: string) => new QueryBuilder(execute, table),
    auth: {
      async getUser() {
        const session = await getSession();
        return { data: { user: session?.user ? { id: session.user.id, email: session.user.email } : null }, error: null };
      },
    },
    storage: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      from: (_bucket: string) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async upload(_path: string, _file: Blob, _options?: { upsert?: boolean }) {
          return { data: null, error: STORAGE_PENDING };
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getPublicUrl(_path: string) {
          return { data: { publicUrl: '' } };
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async remove(_paths: string[]) {
          return { data: null, error: STORAGE_PENDING };
        },
      }),
    },
  };
}
