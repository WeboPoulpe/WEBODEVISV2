import 'server-only';
import { QueryBuilder } from '@/lib/compat/builder';
import { executeQuery } from '@/server/compat/execute';

/**
 * Accès serveur sans filtre par utilisateur (remplace la clé service-role de Supabase).
 * À n'utiliser que côté serveur, pour les pages publiques à jeton qui valident elles-mêmes l'accès.
 */
export const adminSupabase = {
  from: (table: string) => new QueryBuilder((d) => executeQuery(d, { uid: null, bypass: true }), table),
};
