// Glossaire de cuisine français → anglais, partagé par la traduction gratuite (remplacements avant l'envoi) et par
// Webo (consigne donnée à Claude). Un seul endroit pour l'étendre.

/**
 * Titres de carte traduits tels quels (le service gratuit les traduit mal : « Votre entrée » → « your entrance »).
 * Clés en minuscules, sans ponctuation finale.
 */
export const MENU_TITLES: Record<string, string> = {
  'votre entrée': 'Starter', 'entrée': 'Starter', 'entrées': 'Starters', 'votre entrée au choix': 'Your choice of starter',
  'votre plat': 'Main course', 'votre plat chaud': 'Main course', 'plat chaud': 'Main course', 'plats': 'Main courses',
  'votre plat chaud et ses deux légumes': 'Main course with two vegetables', 'votre plat chaud et ses 2 légumes': 'Main course with two vegetables',
  'fromage': 'Cheese', 'fromages': 'Cheese', 'votre dessert': 'Dessert', 'dessert': 'Dessert', 'desserts': 'Desserts',
  'au choix': 'Your choice of', 'ou': 'or', 'pour finir': 'To finish', 'boissons': 'Drinks',
  'les pièces cocktail': 'Cocktail canapés', 'pièces cocktail': 'Cocktail canapés', 'les pièces prestige': 'Premium canapés',
  'vin d’honneur': 'Drinks reception', "vin d'honneur": 'Drinks reception',
};

/** Termes de cuisine remplacés avant traduction (le service les laisse ensuite tels quels). */
export const MENU_TERMS: [RegExp, string][] = [
  [/gratin dauphinois/gi, 'dauphinoise potatoes'],
  [/pièces? montées?(?: à choux)?/gi, 'croquembouche'],
  [/cascade (?:à|de) champagne/gi, 'champagne tower'],
  [/pièces? cocktail/gi, 'canapés'],
  [/poêlée forestière/gi, 'pan-fried wild mushrooms'],
  [/vin d[’']honneur/gi, 'drinks reception'],
  [/mesclun/gi, 'mixed leaves'],
  [/petits pains/gi, 'bread rolls'],
];


/** Le glossaire lisible, donné à Webo : terme français → traduction attendue. */
export const MENU_GLOSSARY: [string, string][] = [
  ['gratin dauphinois', 'dauphinoise potatoes'],
  ['pièce montée (à choux)', 'croquembouche'],
  ['cascade de champagne', 'champagne tower'],
  ['pièces cocktail', 'canapés'],
  ['pièces prestige', 'premium canapés'],
  ['poêlée forestière', 'pan-fried wild mushrooms'],
  ["vin d'honneur", 'drinks reception'],
  ['mesclun', 'mixed leaves'],
  ['petits pains', 'bread rolls'],
  ['mise en bouche', 'amuse-bouche'],
  ['trou normand', 'trou normand (apple brandy sorbet)'],
  ['entrée', 'starter'],
  ['plat chaud', 'main course'],
  ['au choix', 'your choice of'],
];
