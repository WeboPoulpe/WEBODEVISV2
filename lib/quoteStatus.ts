// ═══════════════════════════════════════════════════════════════════════════
// Statuts de devis (table `quotes`) — source de vérité unique
// ═══════════════════════════════════════════════════════════════════════════
// Vocabulaire de prospection défini par la migration sql/add_prospect_quote_link.sql.
// NE PAS confondre avec les statuts de commandes fournisseurs (supplier_orders :
// 'draft' | 'sent' | 'received' | 'cancelled'), qui sont un domaine distinct.
// Centralisé ici pour éviter la divergence entre pages (dashboard, listes globales…).

/** Tous les statuts valides d'un devis (doit rester synchro avec le CHECK SQL). */
export const QUOTE_STATUSES = [
  'nouveau',
  'broch_envoyee',
  'devis_a_faire',
  'devis_envoye',
  'rdv_deg_a_venir',
  'rdv_deg_fait',
  'devis_final',
  'valide',
  'acompte',
  'paye',
  'refus_client',
  'refus_traiteur',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Devis « gagné » / confirmé → événement à réaliser, CA acquis. */
export const CONFIRMED_STATUSES: QuoteStatus[] = ['valide', 'acompte', 'paye'];

/** Devis « en cours » → prospection avant décision du client. */
export const PENDING_STATUSES: QuoteStatus[] = [
  'nouveau',
  'broch_envoyee',
  'devis_a_faire',
  'devis_envoye',
  'rdv_deg_a_venir',
  'rdv_deg_fait',
  'devis_final',
];

/** Devis refusés (par le client ou le traiteur). */
export const REJECTED_STATUSES: QuoteStatus[] = ['refus_client', 'refus_traiteur'];

/** Statut par défaut d'un nouveau devis / brouillon. */
export const DEFAULT_QUOTE_STATUS: QuoteStatus = 'devis_a_faire';

export const isConfirmed = (status?: string | null): boolean =>
  !!status && (CONFIRMED_STATUSES as string[]).includes(status);

export const isPending = (status?: string | null): boolean =>
  !!status && (PENDING_STATUSES as string[]).includes(status);
