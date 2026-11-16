// La semaine de Julien, traiteur : l'histoire que raconte l'accueil du site. Julien, ses clients et ses chiffres
// sont inventés ; ils restent cohérents d'un jour à l'autre (le même mariage, du devis à la facture).

export const STORY = {
  couple: 'Léa & Hugo',
  client: 'Léa Martin',
  dateLabel: 'samedi 14 juin',
  place: 'Domaine des Tilleuls',
  /** Convives du premier devis, le lundi. */
  guests: 120,
  /** Convives après le coup de fil du jeudi : ce qui est servi et facturé. */
  finalGuests: 130,
  minGuests: 20,
  maxGuests: 300,
  step: 10,
} as const;

const VAT = 0.1;

/** Les trois lignes du devis du mariage, hors taxes. */
export function quoteLines(guests: number): { label: string; amount: number }[] {
  return [
    { label: 'Cocktail, 12 pièces par convive', amount: guests * 18 },
    { label: 'Dîner, entrée, plat et dessert', amount: guests * 52 },
    { label: 'Service et vaisselle', amount: 600 + guests * 7 },
  ];
}

/** Total du devis, TVA de 10 % comprise, à l'euro. */
export function quoteTotalTtc(guests: number): number {
  const ht = quoteLines(guests).reduce((sum, l) => sum + l.amount, 0);
  return Math.round(ht * (1 + VAT));
}

/** Nombre de convives accepté par le compteur du devis. */
export function clampGuests(n: number): number {
  if (!Number.isFinite(n)) return STORY.guests;
  return Math.min(STORY.maxGuests, Math.max(STORY.minGuests, Math.round(n)));
}

/** Ce que Julien facture le lundi suivant : le devis, au nombre final de convives. */
export const INVOICED = quoteTotalTtc(STORY.finalGuests);
/** Sa marge sur ce mariage (exemple). */
export const MARGIN = 4080;

/** Les six demandes arrivées pendant le week-end. */
export const REQUESTS: { source: string; text: string }[] = [
  { source: 'brochure', text: 'Mariage, 120 personnes, 14 juin' },
  { source: 'brochure', text: 'Séminaire Altéa, 45 personnes' },
  { source: 'site', text: 'Baptême, 30 personnes' },
  { source: 'QR code du salon', text: 'Anniversaire, 60 personnes' },
  { source: 'brochure', text: 'Cocktail d’entreprise, 80 personnes' },
  { source: 'brochure', text: 'Repas de famille, 25 personnes' },
];

/** Les six devis partis le lundi matin. */
export const SENT = ['Mariage', 'Séminaire', 'Baptême', 'Anniversaire', 'Cocktail', 'Repas'];

/** Trois des extras du samedi, et ce que chacun lit sur son téléphone. */
export const CREW: { name: string; role: string; when: string; where: string; outfit: string }[] = [
  { name: 'Thomas', role: 'Service en salle', when: 'Samedi 14 juin, 15 h', where: STORY.place, outfit: 'Chemise blanche' },
  { name: 'Inès', role: 'Cheffe de rang', when: 'Samedi 14 juin, 14 h', where: STORY.place, outfit: 'Tablier noir' },
  { name: 'Karim', role: 'Cuisine, chaud', when: 'Samedi 14 juin, 11 h', where: 'Au laboratoire', outfit: 'Veste de cuisine' },
];

/** La checklist du chargement. Les `CHECKED` premières sont déjà cochées. */
export const CHECKLIST = [
  '14 caisses de vaisselle',
  '3 étuves',
  'Nappage, 15 tables',
  'Pièce montée, au frais',
  'Plan de table imprimé',
];
export const CHECKED = 4;

/** Les étapes de la semaine : la barre collante de l'accueil et les ancres des sections. */
export const DAYS: { id: string; label: string }[] = [
  { id: 'lun', label: 'Lundi 7 h 30' },
  { id: 'devis', label: 'Lundi 9 h' },
  { id: 'mer', label: 'Mercredi' },
  { id: 'jeu', label: 'Jeudi' },
  { id: 'ven', label: 'Vendredi' },
  { id: 'sam', label: 'Samedi' },
  { id: 'fin', label: 'Lundi suivant' },
  { id: 'tarif', label: 'Le tarif' },
];
