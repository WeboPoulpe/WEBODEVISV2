// Version claire d'un devis sur fond noir (styles Prestige et réservés, repère webo-dark) : le même document,
// sur papier blanc, pour l'imprimer sans vider la cartouche. Les couleurs de la palette noire sont remplacées par
// celles du papier clair (texte foncé, or plus soutenu pour rester lisible sur le blanc) ; les photos restent.

/** Couleurs du document noir → couleurs du document clair. */
const LIGHT: [RegExp, string][] = [
  // Fonds
  [/#0a0a0a(?![0-9a-f])/gi, '#ffffff'],
  [/#0d0d0d(?![0-9a-f])/gi, '#fffdf8'],
  [/#141414(?![0-9a-f])/gi, '#faf6ee'],
  [/rgba\(10,\s*10,\s*10,\s*0?\.55\)/gi, 'rgba(255,255,255,0.2)'],
  // Filets
  [/#3a3226(?![0-9a-f])/gi, '#e9dfca'],
  [/#2a241c(?![0-9a-f])/gi, '#f1e7d2'],
  // Or : plus soutenu sur le blanc
  [/#c9a96e(?![0-9a-f])/gi, '#9c7a36'],
  [/#d4b97a(?![0-9a-f])/gi, '#8a6a2c'],
  [/#e8d9b5(?![0-9a-f])/gi, '#6b5428'],
  // Textes crème → textes foncés
  [/#f5f0eb(?![0-9a-f])/gi, '#1a1a1a'],
  [/#d9d0c1(?![0-9a-f])/gi, '#555555'],
  [/#cfc5b4(?![0-9a-f])/gi, '#666666'],
  [/#bdb3a3(?![0-9a-f])/gi, '#777777'],
  [/#a89f92(?![0-9a-f])/gi, '#888888'],
  [/#8a8174(?![0-9a-f])/gi, '#999999'],
  [/#7d7468(?![0-9a-f])/gi, '#9ca3af'],
  [/#6b6358(?![0-9a-f])/gi, '#bbbbbb'],
  // Textes blancs translucides des bandeaux
  [/rgba\(255,\s*255,\s*255,\s*(0?\.\d+)\)/gi, 'rgba(26,26,26,$1)'],
];

/** Le document est-il sur fond noir ? */
export function isDarkQuote(html: string | null | undefined): boolean {
  return !!html && /class="[^"]*\bwebo-dark\b/.test(html);
}

/** Le même document sur papier blanc. Un document qui n'est pas sur fond noir est rendu tel quel. */
export function lightQuoteHtml(html: string): string {
  if (!isDarkQuote(html)) return html;
  let out = html.replace(/(class="[^"]*?)\s*\bwebo-dark\b/g, '$1');
  for (const [re, to] of LIGHT) out = out.replace(re, to);
  return out;
}
