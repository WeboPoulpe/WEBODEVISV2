// Destinataires d'un envoi de brochure : les clients cochés dans le fichier, plus les adresses tapées à la main.

import { isValidEmail, normalizeEmail, splitEmails } from './emailList';

export interface BrochureRecipient {
  email: string;
  /** Nom du client : il reçoit alors son propre lien personnalisé. */
  name?: string;
  customerId?: string;
}

/** Fusionne les clients choisis et les adresses tapées, sans doublon (le client choisi l'emporte). */
export function mergeRecipients(chosen: BrochureRecipient[], typed: string): { list: BrochureRecipient[]; invalid: string[] } {
  const seen = new Set<string>();
  const list: BrochureRecipient[] = [];
  const invalid: string[] = [];
  const push = (r: BrochureRecipient) => {
    const email = normalizeEmail(r.email ?? '');
    if (!email || seen.has(email)) return;
    if (!isValidEmail(email)) { invalid.push(email); return; }
    seen.add(email);
    list.push({ ...r, email });
  };
  chosen.forEach(push);
  splitEmails(typed).forEach((email) => push({ email }));
  return { list, invalid };
}
