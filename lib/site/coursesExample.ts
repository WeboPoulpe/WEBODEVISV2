// Le menu d'exemple du site : quantité par convive dans l'unité d'achat, comme sur la fiche d'une prestation.
// Partagé par l'aperçu d'un événement et par le calculateur de courses ; données inventées.

export type CourseLine = { name: string; per: number; unit: 'g' | 'cl' | 'pièces' };

export const EXAMPLE_COURSES: CourseLine[] = [
  { name: 'Filet de bœuf', per: 180, unit: 'g' },
  { name: 'Pommes grenaille', per: 200, unit: 'g' },
  { name: 'Asperges vertes', per: 80, unit: 'g' },
  { name: 'Fraises gariguette', per: 100, unit: 'g' },
  { name: 'Crème liquide', per: 5, unit: 'cl' },
];

export const frNumber = (n: number, digits = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits });

/** 180 g × 120 = 21,6 kg ; 5 cl × 120 = 6 L ; les pièces restent des pièces. */
export function courseTotal(per: number, unit: CourseLine['unit'], guests: number): string {
  const sum = per * guests;
  if (unit === 'g') return sum >= 1000 ? `${frNumber(sum / 1000)} kg` : `${frNumber(sum, 0)} g`;
  if (unit === 'cl') return sum >= 100 ? `${frNumber(sum / 100)} L` : `${frNumber(sum, 0)} cl`;
  return `${frNumber(sum, 0)} pièces`;
}
