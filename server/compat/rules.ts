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
// Comptes d'une même entreprise : ceux qui partagent le même compte parent. Écrit comme un ensemble
// (une sous-requête évaluée une fois) plutôt qu'avec get_owner_user_id(), qui lançait une requête par ligne.
export const companyMembers = (u: string) =>
  `(select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${u}))`;
const company: Predicate = (t, u) => `${t}.owner_user_id in ${companyMembers(u)}`;
const quoteAccess: Predicate = (t, u) => `(${t}.user_id = ${u} or ${t}.owner_user_id = ${u} or ${company(t, u)})`;
const viaQuote: Predicate = (t, u) =>
  `exists (select 1 from public.quotes pq where pq.id = ${t}.quote_id and ${quoteAccess('pq', u)})`;
// Ligne d'un des comptes de l'entreprise : le catalogue, le stock, les extras… sont partagés entre collaborateurs
// (décision du 2026-10-20 : un collaborateur travaille sur le même catalogue que le titulaire).
const team = (column: string): Predicate => (t, u) => `${t}.${column} in ${companyMembers(u)}`;
const globalOrTeam: Predicate = (t, u) => `(${t}.user_id is null or ${team('user_id')(t, u)})`;
// Une ligne écrite ne peut pointer que vers des lignes que l'utilisateur a le droit de voir.
const readableIngredient = (col: string): Predicate => (t, u) =>
  `exists (select 1 from public.ingredients pi where pi.id = ${t}.${col} and (pi.user_id is null or pi.user_id in ${companyMembers(u)}))`;
const teamOrder = (t: string, u: string) => `exists (select 1 from public.supplier_orders po where po.id = ${t} and po.user_id in ${companyMembers(u)})`;
const both = (p: Predicate): Pick<TableRule, 'read' | 'write'> => ({ read: p, write: p });

const ALL: Op[] = ['select', 'insert', 'update', 'delete'];

export const RULES: Record<string, TableRule> = {
  quotes: {
    read: quoteAccess,
    // Un devis écrit reste dans l'entreprise de l'utilisateur : on ne peut pas le glisser dans un autre compte.
    write: (t, u) => `(${quoteAccess(t, u)} and (${t}.owner_user_id is null or ${t}.owner_user_id = ${u} or ${company(t, u)}))`,
    admin: ['select', 'update'],
  },
  customers: both((t, u) => `(${t}.owner_user_id = ${u} or ${company(t, u)})`),
  customer_contacts: {
    ...both((t, u) =>
      `(${t}.owner_user_id = ${u} and exists (select 1 from public.customers pc where pc.id = ${t}.customer_id and pc.owner_user_id = ${u}))`),
    admin: ALL,
  },
  profiles: {
    // Un collaborateur lit aussi le profil du titulaire (logo, CGV, mentions légales des documents), sans le modifier.
    read: (t, u) => `(${t}.id = ${u} or ${t}.id = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${u}))`,
    write: own('id'),
    admin: ['select', 'update'],
    adminOnlyColumns: ['modules', 'role', 'is_active', 'deletion_requested_at', 'company_role', 'ical_token', 'last_seen_at', 'subscription_type', 'subscription_plan', 'max_linked_users', 'parent_user_id', 'can_view_all_company_data', 'accounting_settings'],
  },
  prestations: both(team('user_id')),
  prestation_categories: { read: globalOrTeam, write: team('user_id'), adminWrite: (t) => `${t}.user_id is null` },
  prestation_subcategories: { read: globalOrTeam, write: team('user_id'), adminWrite: (t) => `${t}.user_id is null` },
  services: both(company),
  quote_services: both(viaQuote),
  quote_folders: { ...both(team('owner_user_id')), admin: ALL },
  quote_templates: both((t, u) => `(${t}.owner_user_id = ${u} or ${t}.user_id = ${u})`),
  devis_templates: both(team('user_id')),
  // Brochures : l'équipe de l'entreprise. Le lien public est lu côté serveur seulement (server/brochures.ts).
  brochures: both(team('owner_user_id')),
  prospect_requests: {
    ...both((t, u) =>
      `(${t}.owner_user_id in ${companyMembers(u)} or ${t}.user_token in (select k.token from public.user_prospect_tokens k where k.user_id in ${companyMembers(u)}))`),
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
  ingredients: { read: globalOrTeam, write: team('user_id') },
  service_ingredients: {
    read: team('user_id'),
    write: (t, u) =>
      `(${team('user_id')(t, u)} and exists (select 1 from public.prestations pp where pp.id = ${t}.service_id and pp.user_id in ${companyMembers(u)}) and ${readableIngredient('ingredient_id')(t, u)})`,
  },
  service_materials: both(team('user_id')),
  stock_movements: {
    read: team('user_id'),
    write: (t, u) =>
      `(${team('user_id')(t, u)} and ${readableIngredient('ingredient_id')(t, u)}`
      + ` and (${t}.event_id is null or exists (select 1 from public.quotes pq where pq.id = ${t}.event_id and ${quoteAccess('pq', u)}))`
      + ` and (${t}.order_id is null or ${teamOrder(`${t}.order_id`, u)}))`,
  },
  // Stock et seuil d'alerte de chaque ingrédient, propres à l'entreprise (même pour un ingrédient du catalogue commun).
  ingredient_stocks: {
    read: team('company_id'),
    write: (t, u) => `(${team('company_id')(t, u)} and ${readableIngredient('ingredient_id')(t, u)})`,
  },
  supplier_orders: both(team('user_id')),
  supplier_order_items: both((t, u) => teamOrder(`${t}.order_id`, u)),
  extras: both(team('user_id')),
  // L'extra ET le devis doivent appartenir à l'entreprise : sinon la page mission de l'extra
  // exposerait le devis (et la liste de courses) d'un autre compte.
  event_extras: both((t, u) =>
    `(exists (select 1 from public.extras pe where pe.id = ${t}.extra_id and pe.user_id in ${companyMembers(u)}) and ${viaQuote(t, u)})`),
  event_ingredients: both(viaQuote),
  // Accords signés en ligne : lisibles par le traiteur, écrits seulement par le serveur (page publique).
  quote_acceptances: { read: viaQuote, write: () => 'false' },
  // Envois et consultations d'un devis : lisibles par l'entreprise, écrits seulement par le serveur.
  quote_events: { read: viaQuote, write: () => 'false' },
  rental_items: both(viaQuote),
  rental_templates: both(team('user_id')),
  rental_template_sets: both(team('user_id')),
  material_presets: both(team('user_id')),
  material_template_sets: both(team('user_id')),
  // Un article ne peut entrer que dans un modèle de l'entreprise.
  material_templates: {
    read: team('user_id'),
    write: (t, u) => `(${team('user_id')(t, u)} and exists (select 1 from public.material_template_sets ms where ms.id = ${t}.set_id and ms.user_id in ${companyMembers(u)}))`,
  },
};
