// Tri des demandes du formulaire de contact : une demande suspecte est gardée à part dans l'admin (statut
// « suspecte ») et ne déclenche aucun email, ni l'alerte à l'équipe ni l'accusé de réception. Un vrai prospect qui
// colle un lien reste lisible dans l'admin : rien n'est supprimé.

/** En dessous de ce délai entre l'ouverture du formulaire et l'envoi, c'est un robot. */
export const MIN_FILL_MS = 4000;

// Un lien : http(s)://, www., ou un domaine suivi d'un chemin (une adresse email seule n'en est pas un).
const LINK = /(https?:\/\/|\bwww\.)\S+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/i;

export function spamReason(input: { message: string; name: string; company?: string | null; elapsedMs?: number | null }): string | null {
  if (LINK.test(input.message) || LINK.test(input.name) || LINK.test(input.company ?? '')) return 'le message contient un lien';
  if (typeof input.elapsedMs === 'number' && input.elapsedMs >= 0 && input.elapsedMs < MIN_FILL_MS) return 'formulaire rempli en moins de 4 secondes';
  return null;
}
