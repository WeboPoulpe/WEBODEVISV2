// ═══════════════════════════════════════════════════════════════════════════
// Allergènes : les 14 de la réglementation (règlement INCO n° 1169/2011, annexe II)
// ═══════════════════════════════════════════════════════════════════════════
// Un ingrédient porte ses allergènes (cochés par le traiteur). Tant qu'il n'en a pas, des suggestions sont
// tirées de son nom. Une prestation réunit les allergènes de sa recette et ceux ajoutés à la main ;
// le traiteur confirme ensuite l'avoir vérifiée.

export const ALLERGENS = [
  { key: 'gluten', label: 'Gluten', detail: 'blé, seigle, orge, avoine, épeautre' },
  { key: 'crustaces', label: 'Crustacés', detail: 'crevettes, crabe, homard…' },
  { key: 'oeufs', label: 'Œufs', detail: '' },
  { key: 'poissons', label: 'Poissons', detail: '' },
  { key: 'arachides', label: 'Arachides', detail: 'cacahuètes' },
  { key: 'soja', label: 'Soja', detail: '' },
  { key: 'lait', label: 'Lait', detail: 'y compris le lactose' },
  { key: 'fruits_coque', label: 'Fruits à coque', detail: 'amandes, noisettes, noix…' },
  { key: 'celeri', label: 'Céleri', detail: '' },
  { key: 'moutarde', label: 'Moutarde', detail: '' },
  { key: 'sesame', label: 'Sésame', detail: '' },
  { key: 'sulfites', label: 'Sulfites', detail: 'au-delà de 10 mg/kg ou mg/L (vin…)' },
  { key: 'lupin', label: 'Lupin', detail: '' },
  { key: 'mollusques', label: 'Mollusques', detail: 'moules, huîtres, Saint-Jacques…' },
] as const;

export type AllergenKey = (typeof ALLERGENS)[number]['key'];

const ORDER = new Map<string, number>(ALLERGENS.map((a, i) => [a.key, i]));
export const ALLERGEN_LABELS = Object.fromEntries(ALLERGENS.map((a) => [a.key, a.label])) as Record<AllergenKey, string>;

export const isAllergenKey = (k: string): k is AllergenKey => ORDER.has(k);

/** Clés valides, sans doublon, dans l'ordre réglementaire. */
export function sortAllergens(keys: Iterable<string>): AllergenKey[] {
  return [...new Set(keys)].filter(isAllergenKey).sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

const normalize = (s: string) =>
  ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Mots (début de mot) qui signalent un allergène, et expressions qui l'annulent (« lait de coco » n'est pas du lait).
const RULES: { key: AllergenKey; words: string[]; unless?: string[] }[] = [
  { key: 'gluten', words: ['farine', 'ble', 'froment', 'seigle', 'orge', 'avoine', 'epeautre', 'kamut', 'pain', 'brioche', 'pate feuilletee', 'pate brisee', 'pate sablee', 'pates', 'semoule', 'chapelure', 'biscuit', 'couscous', 'boulgour', 'crouton', 'panko', 'gnocchi', 'tortilla', 'blinis', 'galette', 'crepe', 'gaufre'],
    unless: ['farine de riz', 'farine de mais', 'farine de sarrasin', 'farine de chataigne', 'farine de pois', 'farine de coco', 'farine d amande', 'ble noir', 'sans gluten', 'galette de riz'] },
  { key: 'crustaces', words: ['crevette', 'gambas', 'langoustine', 'homard', 'langouste', 'crabe', 'ecrevisse', 'tourteau', 'crustace'] },
  { key: 'oeufs', words: ['oeuf', 'oeufs', 'jaune d oeuf', 'blanc d oeuf', 'mayonnaise', 'meringue'] },
  { key: 'poissons', words: ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'merlu', 'dorade', 'daurade', 'sole', 'truite', 'sardine', 'maquereau', 'anchois', 'haddock', 'lieu', 'fletan', 'turbot', 'eglefin', 'espadon', 'rouget', 'bar', 'loup de mer', 'nuoc mam', 'tarama', 'oeufs de lump', 'caviar', 'surimi'] },
  { key: 'arachides', words: ['arachide', 'cacahuete', 'cacahouete'] },
  { key: 'soja', words: ['soja', 'tofu', 'edamame', 'miso', 'tamari', 'tempeh'] },
  { key: 'lait', words: ['lait', 'beurre', 'creme', 'fromage', 'mozzarella', 'parmesan', 'comte', 'emmental', 'gruyere', 'chevre', 'brie', 'camembert', 'roquefort', 'ricotta', 'mascarpone', 'yaourt', 'yogourt', 'feta', 'burrata', 'lactose', 'chantilly', 'beaufort', 'reblochon', 'raclette', 'cheddar', 'gouda', 'babeurre', 'bechamel', 'fromage blanc', 'petit suisse', 'mimolette', 'tomme', 'cancoillotte', 'ghee'],
    unless: ['lait de coco', 'lait d amande', 'lait de soja', 'lait d avoine', 'lait de riz', 'creme de coco', 'beurre de cacahuete', 'beurre de cacahouete', 'beurre d arachide', 'creme de marron', 'creme de cassis', 'creme de balsamique', 'creme de vinaigre', 'sans lactose'] },
  { key: 'fruits_coque', words: ['amande', 'noisette', 'noix', 'cajou', 'pistache', 'pecan', 'macadamia', 'praline', 'pralin', 'nougat', 'frangipane', 'massepain', 'gianduja'],
    unless: ['noix de coco', 'noix de muscade', 'noix de saint jacques', 'noix de st jacques', 'noix de veau', 'noix de jambon'] },
  { key: 'celeri', words: ['celeri'] },
  { key: 'moutarde', words: ['moutarde'] },
  { key: 'sesame', words: ['sesame', 'tahini', 'tahin', 'gomasio', 'houmous', 'hummus'] },
  { key: 'sulfites', words: ['vin', 'champagne', 'cremant', 'prosecco', 'porto', 'cidre', 'vinaigre de vin', 'abricot sec', 'abricots secs', 'raisin sec', 'raisins secs', 'sulfite'] },
  { key: 'lupin', words: ['lupin'] },
  { key: 'mollusques', words: ['moule', 'huitre', 'saint jacques', 'st jacques', 'calamar', 'encornet', 'poulpe', 'seiche', 'escargot', 'bulot', 'palourde', 'bigorneau', 'mollusque', 'couteaux de mer'] },
];

const hasWord = (text: string, w: string) => text.includes(` ${w} `) || text.includes(` ${w}s `) || text.includes(` ${w}x `);

/** Allergènes probables d'après le nom d'un ingrédient (« Beurre doux » → lait). Ce n'est qu'une suggestion. */
export function suggestAllergens(name: string): AllergenKey[] {
  const text = normalize(name);
  const found: AllergenKey[] = [];
  for (const rule of RULES) {
    let cleaned = text;
    for (const u of rule.unless ?? []) cleaned = cleaned.split(` ${u} `).join(' ').split(` ${u}s `).join(' ');
    if (rule.words.some((w) => hasWord(cleaned, w))) found.push(rule.key);
  }
  // « Noix de Saint-Jacques » : un mollusque, pas un fruit à coque (déjà écarté ci-dessus).
  return sortAllergens(found);
}

/** Allergènes retenus pour un ingrédient : ceux cochés s'il y en a (même aucun), sinon les suggestions. */
export function ingredientAllergens(ing: { name: string; allergens: string[] | null | undefined }): { keys: AllergenKey[]; suggested: boolean } {
  if (Array.isArray(ing.allergens)) return { keys: sortAllergens(ing.allergens), suggested: false };
  return { keys: suggestAllergens(ing.name), suggested: true };
}

export interface PrestationAllergenInput {
  name: string;
  allergens_extra?: string[] | null;
  allergens_checked?: boolean | null;
  ingredients: { name: string; allergens: string[] | null | undefined }[];
}

export interface PrestationAllergens {
  keys: AllergenKey[];
  /** D'où vient chaque allergène : noms des ingrédients, ou « ajouté » à la main. */
  sources: Partial<Record<AllergenKey, string[]>>;
  /** Le traiteur a confirmé la liste. */
  checked: boolean;
  /** Une partie vient de suggestions par le nom : à vérifier. */
  hasSuggestions: boolean;
}

export function prestationAllergens(p: PrestationAllergenInput): PrestationAllergens {
  const sources: Partial<Record<AllergenKey, string[]>> = {};
  let hasSuggestions = false;
  for (const ing of p.ingredients) {
    const { keys, suggested } = ingredientAllergens(ing);
    if (suggested && keys.length) hasSuggestions = true;
    for (const k of keys) (sources[k] ??= []).push(ing.name);
  }
  for (const k of sortAllergens(p.allergens_extra ?? [])) (sources[k] ??= []).push('ajouté à la main');
  return { keys: sortAllergens(Object.keys(sources)), sources, checked: !!p.allergens_checked, hasSuggestions };
}

// ── Fiche allergènes d'un devis ──────────────────────────────────────────────

export interface AllergenSheetRow {
  dish: string;
  keys: AllergenKey[];
  checked: boolean;
  hasSuggestions: boolean;
}

const dishKey = (name: string) => normalize(name).trim();

/**
 * Plats du devis et leurs allergènes : chaque ligne est rapprochée de la prestation du catalogue du même nom.
 * Une prestation présente sur plusieurs lignes n'apparaît qu'une fois ; les lignes sans prestation (location,
 * personnel, plats saisis à la main) sont listées à part.
 */
export function allergenSheet(
  lines: { name?: string | null; removed?: boolean; isPageBreak?: boolean }[],
  prestations: PrestationAllergenInput[],
): { rows: AllergenSheetRow[]; unmatched: string[] } {
  const byName = new Map<string, PrestationAllergenInput>();
  for (const p of prestations) {
    const k = dishKey(p.name);
    // Deux prestations du même nom : celle qui a une recette l'emporte.
    if (!byName.has(k) || (p.ingredients.length > 0 && byName.get(k)!.ingredients.length === 0)) byName.set(k, p);
  }
  const rows: AllergenSheetRow[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    const name = (l.name ?? '').trim();
    if (!name || l.removed || l.isPageBreak) continue;
    const k = dishKey(name);
    if (seen.has(k)) continue;
    seen.add(k);
    const p = byName.get(k);
    if (!p) { unmatched.push(name); continue; }
    const a = prestationAllergens(p);
    rows.push({ dish: name, keys: a.keys, checked: a.checked, hasSuggestions: a.hasSuggestions });
  }
  return { rows, unmatched };
}
