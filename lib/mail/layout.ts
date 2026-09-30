// Gabarit commun à tous les emails, dans la direction artistique de l'app : fond crème, bandeau vert
// sapin, bouton terracotta. Mise en page en tableaux et styles en ligne : c'est ce que les
// messageries (Gmail, Outlook, Mail) affichent de façon fiable.

const COLORS = {
  page: '#F3EEE6',
  card: '#FFFFFF',
  forest: '#1C2621',
  ink: '#1B1A17',
  text: '#57534C',
  muted: '#A39C8E',
  line: '#E6DFD3',
  soft: '#F7F3EC',
  primary: '#B4502D',
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Échappe un texte avant de l'insérer dans le HTML d'un email. */
export const esc = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface EmailLayout {
  /** Nom affiché dans le bandeau : « WeboDevis », ou l'entreprise du traiteur pour un email à son client. */
  brand?: string;
  /** Aperçu affiché par la messagerie à côté de l'objet. */
  preheader: string;
  title: string;
  /** Paragraphes du message (HTML déjà échappé). */
  paragraphs: string[];
  /** Tableau de faits, par exemple le détail d'une demande. */
  facts?: [label: string, value: string][];
  button?: { label: string; url: string };
  /** Petit texte sous le bouton (HTML déjà échappé). */
  note?: string;
  /** Mention en pied de page. */
  footer?: string;
}

export function renderEmail(layout: EmailLayout): string {
  const brand = layout.brand ?? 'WeboDevis';
  const facts = (layout.facts ?? []).filter(([, value]) => value);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(layout.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT};color:${COLORS.ink};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.page};">${esc(layout.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="background:${COLORS.forest};border-radius:20px 20px 0 0;padding:22px 32px;">
      <span style="font-family:${FONT};font-size:22px;font-weight:600;letter-spacing:-0.04em;color:#FFFFFF;">${esc(brand)}</span>
    </td></tr>
    <tr><td style="background:${COLORS.card};border-radius:0 0 20px 20px;padding:32px;">
      <h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${COLORS.ink};">${esc(layout.title)}</h1>
      ${layout.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${COLORS.text};">${p}</p>`).join('\n      ')}
      ${facts.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:${COLORS.soft};border-radius:14px;">
        ${facts.map(([label, value], i) => `<tr>
          <td style="padding:12px 16px;font-size:14px;color:${COLORS.text};${i ? `border-top:1px solid ${COLORS.line};` : ''}width:40%;vertical-align:top;">${esc(label)}</td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${COLORS.ink};${i ? `border-top:1px solid ${COLORS.line};` : ''}">${esc(value)}</td>
        </tr>`).join('')}
      </table>` : ''}
      ${layout.button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 6px;"><tr>
        <td style="background:${COLORS.primary};border-radius:12px;">
          <a href="${esc(layout.button.url)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;">${esc(layout.button.label)}</a>
        </td>
      </tr></table>` : ''}
      ${layout.note ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${COLORS.muted};">${layout.note}</p>` : ''}
    </td></tr>
    <tr><td style="padding:18px 32px 0;font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center;">
      ${esc(layout.footer ?? 'WeboDevis, le logiciel des traiteurs.')}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
