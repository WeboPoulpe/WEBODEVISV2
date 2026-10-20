import 'server-only';
import { sql, type SQL } from 'drizzle-orm';

// Les comptes d'une même entreprise (le titulaire et ses collaborateurs) partagent leurs données :
// devis, clients, catalogue, stock, extras, commandes. Ce fragment est l'ensemble de ces comptes, pour un
// filtre « colonne in (…) ». Même définition que companyMembers dans server/compat/rules.ts.
export const companyIdsOf = (uid: string): SQL =>
  sql`(select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid))`;
