import { departmentByCode } from './departments';
import type { EventType } from './eventTypes';

// Tournures françaises de l'annuaire : « un mariage », « dans l’Aube », « en Guadeloupe », et les départements de la
// même région (proposés quand une recherche ne trouve personne).

const EVENT_PHRASE: Record<EventType, string> = {
  Mariage: 'un mariage',
  Anniversaire: 'un anniversaire',
  Cocktail: 'un cocktail',
  Séminaire: 'un séminaire',
  Gala: 'un gala',
  Communion: 'une communion',
  Baptême: 'un baptême',
  Autre: 'un autre événement',
};

/** « un mariage » ; sans type, « un événement ». */
export function eventPhrase(type: string | null | undefined): string {
  return (type && EVENT_PHRASE[type as EventType]) || 'un événement';
}

// Article de chaque département, quand ce n'est pas « le » (masculin commençant par une consonne).
const FEMININE = new Set([
  '16', '17', '19', '2A', '2B', '21', '23', '24', '26', '31', '33', '42', '43', '44', '48', '50', '51', '52', '53',
  '54', '55', '57', '58', '70', '71', '72', '73', '74', '76', '77', '80', '85', '86', '87', '93',
]);
const PLURAL = new Set(['04', '05', '06', '08', '13', '22', '40', '64', '65', '66', '78', '79', '88', '92']);
// Préposition propre : villes et îles.
const SPECIAL: Record<string, string> = {
  '75': 'à Paris', '971': 'en Guadeloupe', '972': 'en Martinique', '973': 'en Guyane', '974': 'à La Réunion', '976': 'à Mayotte',
};

const typographic = (s: string) => s.replace(/'/g, '’');

/** Nom du département avec son article : « l’Aube », « la Marne », « les Vosges », « le Nord ». */
export function departmentWithArticle(code: string): string {
  const d = departmentByCode(code);
  if (!d) return '';
  const name = typographic(d.name);
  if (code === '75') return 'Paris';
  if (SPECIAL[code]) return name;
  if (PLURAL.has(code)) return `les ${name}`;
  // Voyelle, ou h muet (Hérault) ; les « Haute-… » et « Haut-Rhin » gardent l'article plein.
  if (/^[aeiouyéèêâîôû]/i.test(name) || code === '34') return `l’${name}`;
  return FEMININE.has(code) ? `la ${name}` : `le ${name}`;
}

/** « dans l’Aube », « à Paris », « en Guadeloupe » ; sans département, « partout en France ». */
export function inDepartment(code: string | null | undefined): string {
  if (!code || !departmentByCode(code)) return 'partout en France';
  return SPECIAL[code] ?? `dans ${departmentWithArticle(code)}`;
}

// Régions (2016) : sert à proposer des départements proches quand une recherche ne trouve personne.
const REGIONS: string[][] = [
  ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  ['21', '25', '39', '58', '70', '71', '89', '90'],
  ['22', '29', '35', '56'],
  ['18', '28', '36', '37', '41', '45'],
  ['2A', '2B'],
  ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  ['02', '59', '60', '62', '80'],
  ['75', '77', '78', '91', '92', '93', '94', '95'],
  ['14', '27', '50', '61', '76'],
  ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  ['44', '49', '53', '72', '85'],
  ['04', '05', '06', '13', '83', '84'],
];

/** Les autres départements de la même région (vide pour l'outre-mer). */
export function sameRegion(code: string): string[] {
  return (REGIONS.find((r) => r.includes(code)) ?? []).filter((c) => c !== code);
}

/** Où se déplace le traiteur : « dans l’Aube », « dans l’Aube et la Marne », « dans 4 départements ». */
export function servedPhrase(codes: string[]): string {
  const known = codes.filter((c) => departmentByCode(c));
  if (known.length === 0) return '';
  if (known.length === 1) return inDepartment(known[0]);
  if (known.length === 2) {
    const [a, b] = known;
    return SPECIAL[a] || SPECIAL[b] ? `${inDepartment(a)} et ${inDepartment(b)}` : `dans ${departmentWithArticle(a)} et ${departmentWithArticle(b)}`;
  }
  return `dans ${known.length} départements`;
}

/** Ligne de lieu d'une carte : « Troyes, se déplace dans l’Aube et la Marne ». */
export function placeLine(city: string, codes: string[]): string {
  const served = servedPhrase(codes);
  if (!served) return city;
  return city ? `${city}, se déplace ${served}` : `Se déplace ${served}`;
}
