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

/** Le bloc .gastro-menu du document généré (colonne des plats de la carte). */
function menuBlock(html: string): string {
  const m = html.match(/<div class="gastro-menu"[\s\S]*?<\/div>\s*(?=<!-- ── Pied de carte)/);
  return m ? m[0].trim() : '';
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
 * Traduit les textes d'un HTML du français vers l'anglais (service gratuit MyMemory, morceau par morceau), en gardant
 * la mise en forme. Navigateur seulement. Les morceaux qui n'ont pas pu être traduits restent en français.
 */
export async function translateHtmlFrToEn(html: string): Promise<string> {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  for (const n of nodes) {
    const txt = (n.textContent || '').trim();
    if (txt.length < 2) continue;
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=fr|en`);
      const data = await res.json();
      const out = data?.responseData?.translatedText;
      if (typeof out === 'string' && out) n.textContent = (n.textContent || '').replace(txt, out);
    } catch { /* morceau laissé en français */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return tmp.innerHTML;
}
