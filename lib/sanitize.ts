import DOMPurify from 'isomorphic-dompurify';

// ═══════════════════════════════════════════════════════════════════════════
// Sanitisation du HTML rendu via dangerouslySetInnerHTML (anti-XSS stocké)
// ═══════════════════════════════════════════════════════════════════════════
// Le contenu WeboWord / descriptions / CGV est saisi par l'utilisateur puis
// ré-affiché (y compris dans l'espace admin). On neutralise scripts, handlers
// on*, et URI javascript:, tout en conservant la mise en forme riche (styles
// inline, tables, images base64) nécessaire aux devis.

const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  // Conserve les styles inline et les images data: (logos/photos en base64).
  ADD_ATTR: ['target', 'style'],
  ADD_TAGS: ['style'],
  ALLOW_DATA_ATTR: false,
};

/** Nettoie une chaîne HTML avant injection via dangerouslySetInnerHTML. */
export function sanitizeHtml(html?: string | null): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}
