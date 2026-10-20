// Rôles d'un collaborateur dans l'entreprise (profiles.company_role). Le titulaire (compte sans parent) a tous les droits.
//  • gérant : tout, y compris l'équipe ;
//  • collaborateur : tout le travail (devis, événements, catalogue, factures), sans l'équipe ni les réglages de l'entreprise ;
//  • consultation (« lecture ») : lecture seule, les écritures sont refusées par la couche d'accès.

export const COMPANY_ROLES = ['gerant', 'collaborateur', 'lecture'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const COMPANY_ROLE_INFO: Record<CompanyRole, { label: string; detail: string }> = {
  gerant: { label: 'Gérant', detail: 'Tout, y compris inviter et retirer des collaborateurs.' },
  collaborateur: { label: 'Collaborateur', detail: 'Devis, événements, catalogue et factures, sans les réglages de l’entreprise ni l’équipe.' },
  lecture: { label: 'Consultation', detail: 'Voit tout, ne modifie rien.' },
};
