import 'server-only';

// Règles d'accès par table : l'équivalent applicatif des règles RLS de Supabase.
// Chaque prédicat reçoit l'alias SQL de la table (t) et l'expression de l'utilisateur connecté (u).
// Reprises des policies exportées le 2026-09-30, sans les accès « public » trop larges
// (lecture de toutes les demandes prospects et de tous les extras par n'importe qui).

type Predicate = (t: string, u: string) => string;
type Op = 'select' | 'insert' | 'update' | 'delete';

export interface TableRule {
  /** Lignes visibles. */
  read: Predicate;
  /** Lignes modifiables, et condition que doit respecter toute ligne écrite. */
  write: Predicate;
  /** Opérations qu'un administrateur peut faire sur toutes les lignes. */
  admin?: Op[];
  /** Lignes globales (sans propriétaire) qu'un administrateur peut écrire. */
  adminWrite?: Predicate;
  /** Accès sans être connecté (pages publiques à jeton). */
  anonRead?: { predicate: Predicate; requiredEq: string };
  anonInsert?: Predicate;
  /** Colonnes que seul un administrateur peut écrire. */
  adminOnlyColumns?: string[];
}

const own = (column: string): Predicate => (t, u) => `${t}.${column} = ${u}`;
const company: Predicate = (t, u) => `public.get_owner_user_id(${u}) = public.get_owner_user_id(${t}.owner_user_id)`;
const quoteAccess: Predicate = (t, u) => `(${t}.user_id = ${u} or ${t}.owner_user_id = ${u} or ${company(t, u)})`;
const viaQuote: Predicate = (t, u) =>
  `exists (select 1 from public.quotes pq where pq.id = ${t}.quote_id and ${quoteAccess('pq', u)})`;
const globalOrOwn: Predicate = (t, u) => `(${t}.user_id is null or ${t}.user_id = ${u})`;
const both = (p: Predicate): Pick<TableRule, 'read' | 'write'> => ({ read: p, write: p });

const ALL: Op[] = ['select', 'insert', 'update', 'delete'];

export const RULES: Record<string, TableRule> = {
  quotes: { ...both(quoteAccess), admin: ['select', 'update'] },
  customers: both((t, u) => `(${t}.owner_user_id = ${u} or ${company(t, u)})`),
  customer_contacts: {
    ...both((t, u) =>
      `(${t}.owner_user_id = ${u} and exists (select 1 from public.customers pc where pc.id = ${t}.customer_id and pc.owner_user_id = ${u}))`),
    admin: ALL,
  },
  profiles: {
    ...both(own('id')),
    admin: ['select', 'update'],
    adminOnlyColumns: ['role', 'is_active', 'subscription_type', 'subscription_plan', 'max_linked_users', 'parent_user_id', 'can_view_all_company_data'],
  },
  prestations: both(own('user_id')),
  prestation_categories: { read: globalOrOwn, write: own('user_id'), adminWrite: (t) => `${t}.user_id is null` },
  prestation_subcategories: { read: globalOrOwn, write: own('user_id'), adminWrite: (t) => `${t}.user_id is null` },
  services: both(company),
  quote_services: both(viaQuote),
  quote_folders: { ...both(own('owner_user_id')), admin: ALL },
  quote_templates: both((t, u) => `(${t}.owner_user_id = ${u} or ${t}.user_id = ${u})`),
  devis_templates: both(own('user_id')),
  prospect_requests: {
    ...both((t, u) =>
      `(${t}.owner_user_id = ${u} or ${t}.user_token in (select k.token from public.user_prospect_tokens k where k.user_id = ${u}))`),
    admin: ALL,
    anonInsert: (t) =>
      `exists (select 1 from public.user_prospect_tokens k where k.token = ${t}.user_token and k.is_active and (${t}.owner_user_id is null or ${t}.owner_user_id = k.user_id))`,
  },
  user_prospect_tokens: {
    ...both(own('user_id')),
    anonRead: { predicate: (t) => `${t}.is_active = true`, requiredEq: 'token' },
  },
  notifications: both(own('user_id')),
  suppliers: both((t, u) => `(${t}.user_id = ${u} or ${company(t, u)})`),
  ingredients: { read: globalOrOwn, write: own('user_id') },
  service_ingredients: both(own('user_id')),
  service_materials: both(own('user_id')),
  stock_movements: both(own('user_id')),
  supplier_orders: both(own('user_id')),
  supplier_order_items: both((t, u) =>
    `exists (select 1 from public.supplier_orders po where po.id = ${t}.order_id and po.user_id = ${u})`),
  extras: both(own('user_id')),
  event_extras: both((t, u) =>
    `exists (select 1 from public.extras pe where pe.id = ${t}.extra_id and pe.user_id = ${u})`),
  event_ingredients: both(viaQuote),
  rental_items: both(viaQuote),
  rental_templates: both(own('user_id')),
};
