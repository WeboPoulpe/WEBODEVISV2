// Historique des actions : vocabulaire partagé par l'écriture (serveur) et la page Historique (navigateur).
// Pas de 'server-only' : les libellés servent aussi à l'interface.

export const ACTIVITY_ACTIONS = [
  'creation', 'modification', 'suppression', 'envoi', 'statut', 'paiement', 'acceptation', 'relance',
  'consultation_client', 'invitation', 'role',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTION_LABELS: Record<ActivityAction, string> = {
  creation: 'Création',
  modification: 'Modification',
  suppression: 'Suppression',
  envoi: 'Envoi',
  statut: 'Changement de statut',
  paiement: 'Paiement',
  acceptation: 'Acceptation',
  relance: 'Relance',
  consultation_client: 'Consultation par le client',
  invitation: 'Invitation',
  role: 'Rôle',
};

export const ACTIVITY_ENTITIES = [
  'devis', 'facture', 'client', 'brochure', 'prestation', 'ingredient', 'extra', 'fournisseur', 'commande', 'stock',
  'materiel', 'modele', 'categorie', 'degustation', 'equipe', 'parametres',
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export const ENTITY_LABELS: Record<ActivityEntity, { one: string; many: string; feminine?: boolean; plural?: boolean }> = {
  devis: { one: 'Devis', many: 'devis' },
  facture: { one: 'Facture', many: 'factures', feminine: true },
  client: { one: 'Client', many: 'clients' },
  brochure: { one: 'Brochure', many: 'brochures', feminine: true },
  prestation: { one: 'Prestation', many: 'prestations', feminine: true },
  ingredient: { one: 'Ingrédient', many: 'ingrédients' },
  extra: { one: 'Extra', many: 'extras' },
  fournisseur: { one: 'Fournisseur', many: 'fournisseurs' },
  commande: { one: 'Commande', many: 'commandes', feminine: true },
  stock: { one: 'Stock', many: 'mouvements de stock' },
  materiel: { one: 'Matériel', many: 'éléments de matériel' },
  modele: { one: 'Modèle', many: 'modèles' },
  categorie: { one: 'Catégorie', many: 'catégories', feminine: true },
  degustation: { one: 'Dégustation', many: 'dégustations', feminine: true },
  equipe: { one: 'Équipe', many: 'membres de l’équipe', feminine: true },
  parametres: { one: 'Paramètres de l’entreprise', many: 'paramètres', plural: true },
};

const PARTICIPLES: Partial<Record<ActivityAction, string>> = {
  creation: 'créé', modification: 'modifié', suppression: 'supprimé', envoi: 'envoyé', statut: 'modifié', relance: 'relancé',
};

/** Phrase de l'historique : « Client Julie Martin créé », « 214 clients créés », « Facture F-2026-017 créée ». */
export function activitySummary(action: ActivityAction, entity: ActivityEntity, label: string, count = 1): string {
  const e = ENTITY_LABELS[entity];
  const base = PARTICIPLES[action] ?? 'modifié';
  const agree = (plural: boolean) => base + (e.feminine ? 'e' : '') + (plural ? 's' : '');
  if (count > 1) return `${count} ${e.many} ${agree(true)}`;
  return `${e.one}${label ? ` ${label}` : ''} ${agree(!!e.plural)}`;
}

const LIST_PAGES: Record<ActivityEntity, string> = {
  devis: '/devis', facture: '/factures', client: '/clients', brochure: '/brochures', prestation: '/prestations',
  ingredient: '/ingredients', extra: '/extras', fournisseur: '/fournisseurs', commande: '/commandes', stock: '/stock',
  materiel: '/materiel', modele: '/modeles', categorie: '/parametres/categories', degustation: '/calendrier',
  equipe: '/parametres', parametres: '/parametres',
};

/** Page où retrouver l'élément ; sans identifiant, la page de liste. */
export function entityHref(entity: ActivityEntity, id: string | null): string {
  const list = LIST_PAGES[entity];
  if (!id) return list;
  if (entity === 'devis') return `/devis/${id}`;
  if (entity === 'brochure') return `/brochures/${id}`;
  if (entity === 'facture') return `/factures/${id}`;
  if (entity === 'client') return `/clients?fiche=${id}`;
  return list;
}

/**
 * Tables dont les écritures (couche /api/db) sont notées automatiquement. `id` et `label` sont des expressions SQL
 * sur l'alias t0 (la ligne écrite). Une ligne « enfant » (ligne de devis, contact) est notée comme une modification
 * de son parent. Les tables absentes (statistiques, notifications, jetons, versions…) ne sont pas suivies.
 */
export interface TrackedTable { entity: ActivityEntity; id: string; label: string; forceAction?: ActivityAction }

const QUOTE_LABEL = (q: string) => `coalesce(${q}.quote_number || ' — ', '') || coalesce(nullif(${q}.name, ''), ${q}.client_name)`;
const parentQuote = (col = 'quote_id'): TrackedTable => ({
  entity: 'devis', id: `t0.${col}`, forceAction: 'modification',
  label: `(select ${QUOTE_LABEL('pq')} from public.quotes pq where pq.id = t0.${col})`,
});
const named = (entity: ActivityEntity): TrackedTable => ({ entity, id: 't0.id', label: `coalesce(t0.name, '')` });
const CUSTOMER_LABEL = (c: string) =>
  `coalesce(nullif(${c}.company_name, ''), nullif(trim(coalesce(${c}.first_name, '') || ' ' || coalesce(${c}.last_name, '')), ''), ${c}.email)`;
const INGREDIENT_OF = (col: string) => `coalesce((select pi.name from public.ingredients pi where pi.id = t0.${col}), '')`;

export const TRACKED_TABLES: Record<string, TrackedTable> = {
  quotes: { entity: 'devis', id: 't0.id', label: QUOTE_LABEL('t0') },
  quote_services: parentQuote(),
  rental_items: parentQuote(),
  event_ingredients: parentQuote(),
  event_extras: parentQuote(),
  customers: { entity: 'client', id: 't0.id', label: CUSTOMER_LABEL('t0') },
  customer_contacts: {
    entity: 'client', id: 't0.customer_id', forceAction: 'modification',
    label: `coalesce((select ${CUSTOMER_LABEL('pc')} from public.customers pc where pc.id = t0.customer_id), '')`,
  },
  prestations: named('prestation'),
  services: named('prestation'),
  prestation_categories: named('categorie'),
  prestation_subcategories: named('categorie'),
  ingredients: named('ingredient'),
  ingredient_stocks: { entity: 'stock', id: 't0.ingredient_id', label: INGREDIENT_OF('ingredient_id'), forceAction: 'modification' },
  stock_movements: { entity: 'stock', id: 't0.ingredient_id', label: INGREDIENT_OF('ingredient_id'), forceAction: 'modification' },
  extras: named('extra'),
  suppliers: named('fournisseur'),
  supplier_orders: {
    entity: 'commande', id: 't0.id',
    label: `coalesce((select ps.name from public.suppliers ps where ps.id = t0.supplier_id), '')`,
  },
  supplier_order_items: {
    entity: 'commande', id: 't0.order_id', forceAction: 'modification',
    label: `coalesce((select ps.name from public.supplier_orders po join public.suppliers ps on ps.id = po.supplier_id where po.id = t0.order_id), '')`,
  },
  quote_templates: named('modele'),
  devis_templates: named('modele'),
  rental_template_sets: named('materiel'),
  rental_templates: { entity: 'materiel', id: 't0.set_id', label: `coalesce(t0.material_name, '')`, forceAction: 'modification' },
  material_template_sets: named('materiel'),
  material_templates: named('materiel'),
  material_presets: named('materiel'),
  profiles: { entity: 'parametres', id: 't0.id', label: `''`, forceAction: 'modification' },
};
