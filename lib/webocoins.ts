// ═══════════════════════════════════════════════════════════════════════════
// WeboCoins : calculs sans base
// ═══════════════════════════════════════════════════════════════════════════
// Voir docs/superpowers/specs/2026-10-23-webocoins-traduction-webo-design.md. 1 € = 100 WeboCoins, nombres entiers.
// Les pièces du mois se renouvellent au mois civil de Paris ; un débit prend d'abord dans les pièces du mois.

const PARIS = 'Europe/Paris';

function parisParts(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: PARIS, year: 'numeric', month: '2-digit' }).formatToParts(d);
  return { year: Number(parts.find((p) => p.type === 'year')!.value), month: Number(parts.find((p) => p.type === 'month')!.value) };
}

/** Mois civil à Paris : « 2026-10 ». */
export function monthKeyParis(d: Date): string {
  const { year, month } = parisParts(d);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Minuit à Paris, le premier jour du mois suivant : le renouvellement des pièces du mois. */
export function nextMonthStartParis(d: Date): Date {
  const { year, month } = parisParts(d);
  const y = month === 12 ? year + 1 : year;
  const m = month === 12 ? 1 : month + 1;
  // Minuit UTC ce jour-là, corrigé du décalage de Paris à cet instant (une ou deux heures).
  const utc = Date.UTC(y, m - 1, 1);
  const shown = new Date(new Date(utc).toLocaleString('en-US', { timeZone: PARIS }));
  const asUtc = new Date(new Date(utc).toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(utc - (shown.getTime() - asUtc.getTime()));
}

/** Répartition d'un débit : pièces du mois puis pièces gardées ; null si le solde ne suffit pas. */
export function splitDebit(month: number, kept: number, amount: number): { fromMonth: number; fromKept: number } | null {
  if (amount > month + kept) return null;
  const fromMonth = Math.min(month, amount);
  return { fromMonth, fromKept: amount - fromMonth };
}

/** Coût réel d'un appel à Claude Haiku 5.5, en dollars (0,10 $ / 0,50 $ par million de jetons ; cache ×1,25 / ×0,1). */
export function haikuCostUsd(u: { input: number; output: number; cacheWrite?: number; cacheRead?: number }): number {
  const IN = 0.10 / 1_000_000;
  const OUT = 0.50 / 1_000_000;
  return u.input * IN + u.output * OUT + (u.cacheWrite ?? 0) * IN * 1.25 + (u.cacheRead ?? 0) * IN * 0.1;
}

/** Prix en pièces d'une action au coût réel : coût en euros × coefficient, arrondi à la pièce supérieure (1 au moins). */
export function coinsForCost(costUsd: number, coefficient: number, usdEur: number): number {
  return Math.max(1, Math.ceil(costUsd * usdEur * 100 * coefficient - 1e-9));
}

export function formatCoins(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} W`;
}
