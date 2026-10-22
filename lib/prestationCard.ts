// Bloc d'une prestation dans la carte du menu d'un devis, pour l'éditer sur place depuis la fiche prestation.
//
// Le bloc vient du générateur des devis (generateQuoteHtml) : mêmes styles en ligne, même colonne (.gastro-menu),
// mêmes marges. On y remplace seulement le texte de la prestation par une zone vide, marquée data-presta-edit,
// que l'éditeur rend modifiable. Ce qui s'y tape est donc mis en page exactement comme dans le devis.
//
// Deux cas, comme dans le générateur :
//  • sans fiche mise en page : la carte montre le nom, puis la description (.svc-desc) ; c'est elle qu'on édite ;
//  • avec une fiche (gastro_card_html, ou gastro_card_html_en pour un devis en anglais) : elle remplace le nom
//    et la description ; c'est elle qu'on édite, entière.

import { generateQuoteHtml, type QuoteHtmlOptions } from './generateQuoteHtml';

export type CardKind = 'description' | 'card';

const MARK = 'PRESTA-EDIT-MARK';
/** Attribut de la zone modifiable dans le bloc. */
export const EDIT_ATTR = 'data-presta-edit';

/** Le bloc .gastro-menu du document généré (colonne des plats de la carte), sans le repère des plats du devis. */
function menuBlock(html: string): string {
  const m = html.match(/<div class="gastro-menu"[\s\S]*?<\/div>\s*(?=<!-- ── Pied de carte)/);
  return m ? m[0].trim().replace(/ data-webo-(?:dish|lang)="[^"]*"/g, '') : '';
}

/**
 * Le bloc de la carte pour une prestation, avec une zone vide marquée data-presta-edit à la place de son texte
 * (la description, ou la fiche entière). Chaîne vide si le générateur change de forme.
 */
export function carteShell(p: {
  name: string;
  isOption: boolean;
  kind: CardKind;
  lang: 'fr' | 'en';
}, opts: QuoteHtmlOptions): string {
  const card = p.kind === 'card' ? MARK : null;
  const html = generateQuoteHtml({
    companyName: '',
    clientName: '',
    language: p.lang,
    services: [{
      name: p.name.trim() || 'Nom de la prestation',
      description: p.kind === 'description' ? MARK : null,
      quantity: 1,
      unitPrice: 0,
      isOption: p.isOption,
      gastroCardHtml: p.lang === 'fr' ? card : null,
      gastroCardHtmlEn: p.lang === 'en' ? card : null,
    }],
    vatRate: 20,
  }, opts);
  const menu = menuBlock(html);
  if (!menu.includes(MARK)) return '';
  if (p.kind === 'description') {
    // <div class="svc-desc" style="…">MARK</div>
    return menu.replace(/<div class="svc-desc"([^>]*)>PRESTA-EDIT-MARK<\/div>/, `<div class="svc-desc"$1 ${EDIT_ATTR}="1"></div>`);
  }
  // Fiche : le conteneur du plat devient la zone modifiable.
  return menu.replace(/<div style="([^"]*)">PRESTA-EDIT-MARK<\/div>/, `<div style="$1" ${EDIT_ATTR}="1"></div>`);
}

/**
 * Fiche (pour la version anglaise) qui reprend à l'identique le bloc « nom + description » de la carte.
 * Le nom devient un titre h3 : c'est là que le devis en anglais lit le nom de la prestation pour son tableau.
 */
export function cardFromDescription(p: { name: string; description: string }, opts: QuoteHtmlOptions): string {
  const html = generateQuoteHtml({
    companyName: '',
    clientName: '',
    services: [{ name: p.name.trim() || 'Nom de la prestation', description: p.description || null, quantity: 1, unitPrice: 0 }],
    vatRate: 20,
  }, opts);
  const menu = menuBlock(html);
  const item = menu.match(/<div style="(margin-bottom:22px;[^"]*)">([\s\S]*)<\/div>\s*<\/div>$/);
  if (!item) return '';
  const inner = item[2].trim().replace(/<p style="(font-size:15px;[^"]*)">([\s\S]*?)<\/p>/, '<h3 style="$1">$2</h3>');
  return `<div style="text-align:center;">${inner}</div>`;
}

/** Vrai si le HTML ne contient aucun texte (ni image). */
export function isBlankHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return !html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '');
}

/**
 * Titres de carte traduits tels quels (le service gratuit les traduit mal : « Votre entrée » → « your entrance »).
 * Clés en minuscules, sans ponctuation finale.
 */
const MENU_TITLES: Record<string, string> = {
  'votre entrée': 'Starter', 'entrée': 'Starter', 'entrées': 'Starters', 'votre entrée au choix': 'Your choice of starter',
  'votre plat': 'Main course', 'votre plat chaud': 'Main course', 'plat chaud': 'Main course', 'plats': 'Main courses',
  'votre plat chaud et ses deux légumes': 'Main course with two vegetables', 'votre plat chaud et ses 2 légumes': 'Main course with two vegetables',
  'fromage': 'Cheese', 'fromages': 'Cheese', 'votre dessert': 'Dessert', 'dessert': 'Dessert', 'desserts': 'Desserts',
  'au choix': 'Your choice of', 'ou': 'or', 'pour finir': 'To finish', 'boissons': 'Drinks',
  'les pièces cocktail': 'Cocktail canapés', 'pièces cocktail': 'Cocktail canapés', 'les pièces prestige': 'Premium canapés',
  'vin d’honneur': 'Drinks reception', "vin d'honneur": 'Drinks reception',
};

/** Termes de cuisine remplacés avant traduction (le service les laisse ensuite tels quels). */
const MENU_TERMS: [RegExp, string][] = [
  [/gratin dauphinois/gi, 'dauphinoise potatoes'],
  [/pièces? montées?(?: à choux)?/gi, 'croquembouche'],
  [/cascade (?:à|de) champagne/gi, 'champagne tower'],
  [/pièces? cocktail/gi, 'canapés'],
  [/poêlée forestière/gi, 'pan-fried wild mushrooms'],
  [/vin d[’']honneur/gi, 'drinks reception'],
  [/mesclun/gi, 'mixed leaves'],
  [/petits pains/gi, 'bread rolls'],
];

/**
 * Traduit un texte du français vers l'anglais (service gratuit MyMemory, après le glossaire de cuisine ci-dessus).
 * Navigateur seulement. Null si le service n'a pas donné de vraie traduction (réseau, quota du jour épuisé…) : le
 * texte reste alors en français.
 */
export async function translateTextFrToEn(text: string): Promise<string | null> {
  const txt = text.trim();
  if (txt.length < 2) return null;
  const title = MENU_TITLES[txt.toLowerCase().replace(/[\s:.…]+$/, '')];
  if (title) return title;
  const prepared = MENU_TERMS.reduce((acc, [re, en]) => acc.replace(re, en), txt);
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(prepared)}&langpair=fr|en`);
    const data = await res.json();
    const out = data?.responseData?.translatedText;
    // Quota épuisé ou erreur : le service répond par un message (« MYMEMORY WARNING… »), pas par une traduction.
    if (Number(data?.responseStatus) !== 200 || typeof out !== 'string' || !out.trim() || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) return null;
    // Le service renvoie parfois des entités HTML (&#39;, &quot;) : on les décode en texte.
    const decode = document.createElement('textarea');
    decode.innerHTML = out;
    return decode.value;
  } catch {
    return null;
  }
}

/**
 * Traduit les textes d'un HTML du français vers l'anglais, morceau par morceau, en gardant la mise en forme.
 * Navigateur seulement. `missed` : morceaux restés en français (service indisponible, quota du jour épuisé).
 */
export async function translateHtmlFrToEnDetailed(html: string): Promise<{ html: string; missed: number }> {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  let missed = 0;
  for (const n of nodes) {
    const txt = (n.textContent || '').trim();
    if (txt.length < 2 || !/[a-zà-ÿ]/i.test(txt)) continue;
    const out = await translateTextFrToEn(txt);
    if (out) n.textContent = (n.textContent || '').replace(txt, out); else missed++;
    await new Promise((r) => setTimeout(r, 100));
  }
  return { html: tmp.innerHTML, missed };
}

/** Comme translateHtmlFrToEnDetailed, sans le compte des morceaux restés en français. */
export async function translateHtmlFrToEn(html: string): Promise<string> {
  return (await translateHtmlFrToEnDetailed(html)).html;
}

/** Repères propres au devis : ils ne passent pas dans la fiche (l'interligne et la police d'un paragraphe, oui). */
const QUOTE_ONLY = /^data-webo-(?!lh$|font$)/;

/** Fiche de la carte tirée d'un plat : son contenu, sans les repères du devis, centré s'il l'était. */
export function dishCardHtml(el: HTMLElement): string {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('*').forEach((n) => {
    Array.from(n.attributes).forEach((a) => { if (QUOTE_ONLY.test(a.name)) n.removeAttribute(a.name); });
  });
  const inner = copy.innerHTML.trim();
  // Le plat sans fiche est centré par son enveloppe, que la fiche n'a pas : le centrage passe dans la fiche.
  return el.style.textAlign === 'center' ? `<div style="text-align:center;">${inner}</div>` : inner;
}

/**
 * Devis en anglais : passe en anglais chaque plat de la carte encore en français (sans repère data-webo-lang="en"),
 * qu'il corresponde à une ligne du devis ou non, et le marque comme anglais. Un plat dont la prestation a déjà sa
 * fiche anglaise (`known`, par nom) la reprend telle quelle ; les autres sont traduits. Navigateur seulement.
 * `cards` : fiche anglaise de chaque plat traduit et repéré (nom de sa prestation), à enregistrer dans la prestation.
 */
export async function translateCarteToEnglish(
  html: string,
  onProgress?: (done: number, total: number) => void,
  known: ReadonlyMap<string, string> = new Map(),
): Promise<{ html: string; missed: number; cards: [string, string][] }> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const dishes = Array.from(doc.querySelectorAll<HTMLElement>('.gastro-menu > div'))
    .filter((d) => d.getAttribute('data-webo-lang') !== 'en' && !isBlankHtml(d.innerHTML));
  if (dishes.length === 0) return { html, missed: 0, cards: [] };
  let missed = 0;
  const cards: [string, string][] = [];
  for (const [i, d] of dishes.entries()) {
    onProgress?.(i + 1, dishes.length);
    const name = d.getAttribute('data-webo-dish');
    const existing = name ? known.get(name) : undefined;
    if (existing) {
      // Fiche anglaise du catalogue : pas de traduction. (Le plat sans fiche était centré par son enveloppe.)
      d.style.textAlign = '';
      d.innerHTML = existing;
      d.setAttribute('data-webo-lang', 'en');
      continue;
    }
    const res = await translateHtmlFrToEnDetailed(d.innerHTML);
    missed += res.missed;
    if (res.html === d.innerHTML) continue;
    d.innerHTML = res.html;
    d.setAttribute('data-webo-lang', 'en');
    if (name) cards.push([name, dishCardHtml(d)]);
  }
  return { html: doc.body.innerHTML, missed, cards };
}
