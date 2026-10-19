// ═══════════════════════════════════════════════════════════════════════════
// Factures : mentions légales du pied de page (texte brut)
// ═══════════════════════════════════════════════════════════════════════════
// Une seule source pour l'aperçu à l'écran, l'impression et le PDF Factur-X.
// Le pied de page s'affiche ainsi : la ligne d'identité du vendeur (sellerIdentityLine), puis les phrases de
// invoiceMentions dans l'ordre. La mention de franchise de TVA (art. 293 B) fait partie de la ligne d'identité.

import type { Invoice, Seller } from '@/server/invoices';

/** « 2026-10-19 » → « 19/10/2026 », sans passer par le fuseau horaire. */
export function frDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

const clean = (v: string | null | undefined) => (v ?? '').trim();

/** Forme juridique, capital, RCS, SIRET, n° de TVA ou franchise, séparés par « · ». */
export function sellerIdentityLine(seller: Seller): string {
  const capital = clean(seller.shareCapital);
  const parts = [
    clean(seller.legalForm),
    capital ? `Capital de ${/€|eur/i.test(capital) ? capital : `${capital} €`}` : '',
    clean(seller.rcs) ? `RCS ${clean(seller.rcs).replace(/^RCS\s+/i, '')}` : '',
    clean(seller.siret) ? `SIRET ${clean(seller.siret)}` : '',
    seller.vatExempt
      ? 'TVA non applicable, art. 293 B du CGI'
      : clean(seller.vatNumber) ? `N° TVA ${clean(seller.vatNumber)}` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Phrases du pied de page, dans l'ordre d'affichage (sans la ligne d'identité du vendeur). */
export function invoiceMentions(inv: Pick<Invoice, 'kind' | 'status' | 'seller' | 'buyer' | 'due_date'>): string[] {
  const out: string[] = [];
  // Un avoir ne se règle pas : pas de conditions de paiement.
  if (inv.kind !== 'avoir') {
    if (inv.due_date) out.push(`Paiement à régler avant le ${frDate(inv.due_date)}.`);
    else if (inv.status === 'brouillon') out.push('L’échéance sera fixée à l’émission de la facture.');
    else out.push('Paiement à réception.');
    const iban = clean(inv.seller.iban);
    const bic = clean(inv.seller.bic);
    if (iban) out.push(`Règlement par virement : IBAN ${iban}${bic ? ` · BIC ${bic}` : ''}.`);
    else if (bic) out.push(`BIC ${bic}.`);
    out.push('Pas d’escompte pour paiement anticipé.');
    if (inv.buyer.isCompany) {
      out.push('En cas de retard de paiement, pénalités au taux de trois fois le taux d’intérêt légal et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce).');
    }
  }
  out.push('Catégorie de l’opération : prestation de services.');
  return out;
}
