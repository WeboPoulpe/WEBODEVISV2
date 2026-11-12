// Lien de paiement du traiteur (SumUp, PayPal, sa banque…), collé dans ses paramètres et affiché sur le devis signé,
// la facture et les relances. WeboDevis n'encaisse rien : c'est un simple lien vers la page du traiteur.
// Toujours repassé par cleanPaymentUrl avant d'être affiché : la valeur vient d'une saisie libre.

export const PAYMENT_URL_MAX = 500;

/** L'adresse nettoyée si c'est un lien https valable, sinon null. « paypal.me/moi » est complété en https. */
export function cleanPaymentUrl(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw || raw.length > PAYMENT_URL_MAX || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  // Un vrai nom de domaine : au moins un point, pas une adresse locale.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
  return url.toString();
}
