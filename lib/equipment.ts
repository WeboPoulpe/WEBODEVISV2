// Listes de base proposées à chaque traiteur : les articles de location courants et le matériel qu'on emporte.
// Elles évitent de tout saisir : on coche, les unités et les quantités habituelles sont déjà remplies.
// Chaque compte garde ensuite sa propre liste, qu'il complète ou réduit.

/** Unités proposées, pour que tout le monde écrive la même chose (« pièce » et non « pcs », « pce », « u »). */
export const UNITS = ['pièce', 'jeu', 'lot', 'paire', 'mètre', 'rouleau', 'boîte', 'carton', 'bouteille', 'kg', 'litre'] as const;

export interface BaseArticle {
  name: string;
  unit: (typeof UNITS)[number];
  /** Quantité habituelle par couvert (0,1 : une pour dix couverts). */
  perGuest: number;
  group: string;
}

/** Articles de location (vaisselle, verrerie, nappage, mobilier), avec leur quantité par couvert. */
export const RENTAL_BASE: BaseArticle[] = [
  // Assiettes
  { group: 'Assiettes', name: 'Assiette plate 27 cm', unit: 'pièce', perGuest: 1 },
  { group: 'Assiettes', name: 'Assiette à entrée 23 cm', unit: 'pièce', perGuest: 1 },
  { group: 'Assiettes', name: 'Assiette à dessert 21 cm', unit: 'pièce', perGuest: 1 },
  { group: 'Assiettes', name: 'Assiette creuse', unit: 'pièce', perGuest: 1 },
  { group: 'Assiettes', name: 'Assiette à pain', unit: 'pièce', perGuest: 1 },
  { group: 'Assiettes', name: 'Assiette cocktail 16 cm', unit: 'pièce', perGuest: 1.5 },
  { group: 'Assiettes', name: 'Tasse et sous-tasse à café', unit: 'jeu', perGuest: 1 },
  // Couverts
  { group: 'Couverts', name: 'Fourchette de table', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Couteau de table', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Fourchette à entrée', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Couteau à entrée', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Cuillère à soupe', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Fourchette à dessert', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Cuillère à café', unit: 'pièce', perGuest: 1 },
  { group: 'Couverts', name: 'Couteau à fromage', unit: 'pièce', perGuest: 1 },
  // Verrerie
  { group: 'Verrerie', name: 'Verre à eau', unit: 'pièce', perGuest: 1 },
  { group: 'Verrerie', name: 'Verre à vin rouge', unit: 'pièce', perGuest: 1 },
  { group: 'Verrerie', name: 'Verre à vin blanc', unit: 'pièce', perGuest: 1 },
  { group: 'Verrerie', name: 'Flûte à champagne', unit: 'pièce', perGuest: 1 },
  { group: 'Verrerie', name: 'Verre à cocktail', unit: 'pièce', perGuest: 1.5 },
  { group: 'Verrerie', name: 'Carafe à eau', unit: 'pièce', perGuest: 0.2 },
  { group: 'Verrerie', name: 'Seau à champagne', unit: 'pièce', perGuest: 0.1 },
  // Nappage
  { group: 'Nappage', name: 'Serviette en tissu', unit: 'pièce', perGuest: 1 },
  { group: 'Nappage', name: 'Nappe ronde 240 cm', unit: 'pièce', perGuest: 0.1 },
  { group: 'Nappage', name: 'Nappe rectangulaire 180 × 300 cm', unit: 'pièce', perGuest: 0.1 },
  { group: 'Nappage', name: 'Chemin de table', unit: 'pièce', perGuest: 0.1 },
  { group: 'Nappage', name: 'Housse de chaise', unit: 'pièce', perGuest: 1 },
  { group: 'Nappage', name: 'Nappe de buffet', unit: 'pièce', perGuest: 0.02 },
  // Mobilier
  { group: 'Mobilier', name: 'Table ronde 10 personnes', unit: 'pièce', perGuest: 0.1 },
  { group: 'Mobilier', name: 'Table rectangulaire 8 personnes', unit: 'pièce', perGuest: 0.125 },
  { group: 'Mobilier', name: 'Chaise', unit: 'pièce', perGuest: 1 },
  { group: 'Mobilier', name: 'Mange-debout', unit: 'pièce', perGuest: 0.1 },
  { group: 'Mobilier', name: 'Table de buffet', unit: 'pièce', perGuest: 0.02 },
];

/** Matériel que le traiteur emporte (cuisine, service, transport). La quantité est fixe par événement. */
export const EQUIPMENT_BASE: { name: string; unit: (typeof UNITS)[number]; qty: number; group: string }[] = [
  // Service chaud
  { group: 'Service chaud', name: 'Chafing dish', unit: 'pièce', qty: 4 },
  { group: 'Service chaud', name: 'Étuve chauffante', unit: 'pièce', qty: 1 },
  { group: 'Service chaud', name: 'Plaque à induction', unit: 'pièce', qty: 2 },
  { group: 'Service chaud', name: 'Four mixte portable', unit: 'pièce', qty: 1 },
  { group: 'Service chaud', name: 'Brûleurs pour chafing dish', unit: 'boîte', qty: 1 },
  // Froid et transport
  { group: 'Froid et transport', name: 'Caisse isotherme', unit: 'pièce', qty: 6 },
  { group: 'Froid et transport', name: 'Glacière', unit: 'pièce', qty: 2 },
  { group: 'Froid et transport', name: 'Pains de glace', unit: 'lot', qty: 1 },
  { group: 'Froid et transport', name: 'Bacs gastronormes GN 1/1', unit: 'pièce', qty: 10 },
  { group: 'Froid et transport', name: 'Bacs gastronormes GN 1/2', unit: 'pièce', qty: 10 },
  { group: 'Froid et transport', name: 'Chariot de transport', unit: 'pièce', qty: 1 },
  // Service
  { group: 'Service', name: 'Plateaux de service', unit: 'pièce', qty: 10 },
  { group: 'Service', name: 'Planches à découper', unit: 'pièce', qty: 3 },
  { group: 'Service', name: 'Pinces de service', unit: 'pièce', qty: 10 },
  { group: 'Service', name: 'Louches', unit: 'pièce', qty: 4 },
  { group: 'Service', name: 'Couteaux de cuisine', unit: 'jeu', qty: 1 },
  { group: 'Service', name: 'Percolateur', unit: 'pièce', qty: 1 },
  { group: 'Service', name: 'Fontaine à eau', unit: 'pièce', qty: 1 },
  { group: 'Service', name: 'Bouilloire', unit: 'pièce', qty: 1 },
  { group: 'Service', name: 'Tire-bouchons', unit: 'pièce', qty: 3 },
  // Installation et nettoyage
  { group: 'Installation et nettoyage', name: 'Tables de préparation pliantes', unit: 'pièce', qty: 2 },
  { group: 'Installation et nettoyage', name: 'Rallonges électriques', unit: 'pièce', qty: 3 },
  { group: 'Installation et nettoyage', name: 'Sacs poubelle', unit: 'rouleau', qty: 2 },
  { group: 'Installation et nettoyage', name: 'Film étirable', unit: 'rouleau', qty: 1 },
  { group: 'Installation et nettoyage', name: 'Papier aluminium', unit: 'rouleau', qty: 1 },
  { group: 'Installation et nettoyage', name: 'Essuie-tout', unit: 'rouleau', qty: 4 },
  { group: 'Installation et nettoyage', name: 'Gants jetables', unit: 'boîte', qty: 1 },
  { group: 'Installation et nettoyage', name: 'Produit vaisselle et éponges', unit: 'lot', qty: 1 },
  { group: 'Installation et nettoyage', name: 'Trousse de secours', unit: 'pièce', qty: 1 },
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** L'article de base qui porte ce nom, pour préremplir son unité et sa quantité. */
export function findBaseArticle<T extends { name: string }>(list: T[], name: string): T | undefined {
  const key = fold(name);
  return key ? list.find((a) => fold(a.name) === key) : undefined;
}

export const sameName = (a: string, b: string) => fold(a) === fold(b);
