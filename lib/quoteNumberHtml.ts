// Numéro du devis dans le document rédigé (content_html). Le numéro est attribué par la base à la création,
// souvent après la rédaction : il est donc posé à l'affichage, sous la date de l'en-tête, dans un repère
// [data-webo-number] que les affichages suivants mettent à jour au lieu d'en ajouter un second.

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MARKER = /(<([a-z0-9]+)[^>]*\bdata-webo-number(?:="[^"]*")?[^>]*>)[\s\S]*?(<\/\2>)/i;
// Ligne « Date : 19/10/2026 » (ou « Date: … ») de l'en-tête généré.
const DATE_LINE = /(<p\b[^>]*>\s*Date\s*:\s*[^<]*<\/p>)/i;

export function withQuoteNumber(html: string, quoteNumber: string | null | undefined, lang: 'fr' | 'en' = 'fr'): string {
  if (!html || !quoteNumber) return html;
  const label = `${lang === 'en' ? 'No.' : 'N°'} ${escape(quoteNumber)}`;
  if (MARKER.test(html)) return html.replace(MARKER, (_m, open, _tag, close) => `${open}${label}${close}`);
  return html.replace(DATE_LINE, (line) => {
    // Même style que la ligne de date, pour que le numéro s'y aligne.
    const style = /style="([^"]*)"/i.exec(line)?.[1]?.replace(/margin:[^;]*;?/i, 'margin:2px 0 0;') ?? 'margin:2px 0 0;font-size:11px;';
    return `${line}<p data-webo-number="1" style="${style}">${label}</p>`;
  });
}
