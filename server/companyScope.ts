import 'server-only';
import { sql, type SQL } from 'drizzle-orm';

// Les comptes d'une même entreprise (le titulaire et ses collaborateurs) partagent leurs données :
// devis, clients, catalogue, stock, extras, commandes. Ce fragment est l'ensemble de ces comptes, pour un
// filtre « colonne in (…) ». Même définition que companyMembers dans server/compat/rules.ts.
export const companyIdsOf = (uid: string): SQL =>
  sql`(select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid))`;

// L'entreprise du compte : son titulaire (compte parent) s'il en a un, sinon lui-même. C'est la clé du stock
// (ingredient_stocks.company_id), comme la fonction SQL public.company_of.
export const companyOf = (uid: string): SQL =>
  sql`(select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)`;

// Ingrédients sous leur seuil d'alerte dans le stock de l'entreprise (alias s : ingredient_stocks, i : ingredients),
// parmi ceux qu'elle peut voir : les siens et ceux du catalogue commun.
export const lowStockOf = (uid: string): SQL =>
  sql`s.company_id = ${companyOf(uid)} and (i.user_id is null or i.user_id in ${companyIdsOf(uid)})
    and s.min_alert > 0 and s.quantity <= s.min_alert`;
