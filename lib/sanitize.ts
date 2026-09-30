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
  // Les repères data-webo-* servent à resynchroniser le document (tableau, client, événement).
  ALLOW_DATA_ATTR: true,
  // Un devis ne contient ni formulaire ni champ : ils ne serviraient qu'à piéger le lecteur.
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'option'],
};

/** Nettoie une chaîne HTML avant injection via dangerouslySetInnerHTML. */
export function sanitizeHtml(html?: string | null, config?: Parameters<typeof DOMPurify.sanitize>[1]): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, config ?? CONFIG) as unknown as string;
}
