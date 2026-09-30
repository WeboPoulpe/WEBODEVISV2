import DOMPurify from 'dompurify';
import sanitizeServer from 'sanitize-html';

// ═══════════════════════════════════════════════════════════════════════════
// Nettoyage du HTML saisi par les utilisateurs (devis, descriptions, CGV) avant affichage.
// Scripts, gestionnaires on*, liens javascript:, iframes et formulaires sont retirés ; la mise en forme
// (styles en ligne, tableaux, images) est gardée.
//
// Deux moteurs, un seul jeu de règles :
//  • dans le navigateur, DOMPurify, qui s'appuie sur le vrai DOM ;
//  • sur le serveur, sanitize-html, qui n'a pas besoin d'émuler un navigateur. (L'ancienne version chargeait
//    jsdom côté serveur, trop lourd pour les fonctions de Vercel : les pages qui nettoyaient du HTML y
//    répondaient en erreur.)
// ═══════════════════════════════════════════════════════════════════════════

const FORBIDDEN = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'base'];

type BrowserConfig = Parameters<typeof DOMPurify.sanitize>[1];

const BROWSER_CONFIG: BrowserConfig = {
  // Conserve les styles en ligne et les images data: (logos, photos).
  ADD_ATTR: ['target', 'style'],
  ADD_TAGS: ['style'],
  // Les repères data-webo-* servent à resynchroniser le document (tableau, client, événement).
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: FORBIDDEN,
};

const SERVER_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'center', 'code', 'col', 'colgroup', 'div', 'em', 'font', 'h1', 'h2', 'h3', 'h4',
  'h5', 'h6', 'hr', 'i', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strike', 'strong', 'style', 'sub', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'section', 'article', 'header', 'footer', 'figure', 'figcaption',
];

const SERVER_CONFIG: sanitizeServer.IOptions = {
  allowedTags: SERVER_TAGS,
  allowedAttributes: {
    '*': ['style', 'class', 'id', 'title', 'align', 'width', 'height', 'colspan', 'rowspan', 'valign', 'dir', 'lang', 'data-*', 'color', 'face', 'size'],
    a: ['href', 'target', 'rel', 'name'],
    img: ['src', 'alt', 'srcset', 'sizes', 'loading'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  // <style> reste autorisé (police du document), comme dans le navigateur.
  allowVulnerableTags: true,
  disallowedTagsMode: 'discard',
};

/** Règles particulières, par exemple pour un collage : balises et attributs autorisés seulement. */
export interface SanitizeOptions {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
}

/** Nettoie une chaîne HTML avant injection via dangerouslySetInnerHTML ou innerHTML. */
export function sanitizeHtml(html?: string | null, options?: SanitizeOptions): string {
  if (!html) return '';
  if (typeof window !== 'undefined') {
    const config: BrowserConfig = options ? { ALLOWED_TAGS: options.ALLOWED_TAGS, ALLOWED_ATTR: options.ALLOWED_ATTR } : BROWSER_CONFIG;
    return DOMPurify.sanitize(html, config) as unknown as string;
  }
  if (options) {
    return sanitizeServer(html, {
      allowedTags: options.ALLOWED_TAGS ?? SERVER_TAGS,
      allowedAttributes: { '*': options.ALLOWED_ATTR ?? [] },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    });
  }
  return sanitizeServer(html, SERVER_CONFIG);
}
