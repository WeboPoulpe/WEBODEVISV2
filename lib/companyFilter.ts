// Filtres « toute l'entreprise » pour les tables qu'un administrateur peut lire en entier (devis, demandes) :
// sans eux, la page d'un administrateur listerait les données de tous les clients. Les autres tables partagées
// (catalogue, extras, stock…) n'ont pas besoin de filtre : les règles d'accès les limitent déjà à l'entreprise.

/** Comptes de l'entreprise de l'utilisateur ; à défaut (profil pas encore chargé), lui seul. */
export function companyIds(userId: string, profile: { company_ids?: string[] | null } | null | undefined): string[] {
  const ids = profile?.company_ids?.filter((id) => /^[0-9a-f-]{36}$/i.test(id)) ?? [];
  return ids.length ? ids : [userId];
}

/** Devis de l'entreprise : créés par l'utilisateur, ou appartenant à un compte de l'entreprise. */
export const companyQuotesFilter = (userId: string, ids: string[]) =>
  `user_id.eq.${userId},owner_user_id.in.(${ids.join(',')})`;
