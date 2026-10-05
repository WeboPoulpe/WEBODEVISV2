// Taux de TVA proposés : métropole (20, 10, 5,5 %), départements d'outre-mer (8,5 et 2,1 %) et 0 %
// (auto-entrepreneur en franchise). Un nouveau devis prend le taux par défaut du compte.

export const VAT_RATES = [20, 10, 8.5, 5.5, 2.1, 0] as const;

export const vatLabel = (r: number) => `${r.toLocaleString('fr-FR')} %`;

/** Taux d'un nouveau devis : celui du compte, sinon 20 %. */
export function defaultVatRate(profile: { default_vat_rate?: number | string | null } | null | undefined): number {
  const n = Number(profile?.default_vat_rate);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 20;
}
