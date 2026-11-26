import type { CSSProperties } from 'react';

// Couleurs du formulaire de demande d'une brochure, réglées dans le Studio (fond, texte, bouton). Posées en variables
// CSS sur son conteneur : BrochureRequestForm et la fenêtre plein écran les reprennent, avec leurs couleurs d'origine
// par défaut.

const isDarkHex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.5;
};

/** Variables de couleur du formulaire (texte, texte discret, bouton et texte du bouton). */
export function formColors(color: string, accent: string): CSSProperties {
  return {
    '--wb-form-text': color,
    '--wb-form-muted': `color-mix(in srgb, ${color} 72%, transparent)`,
    '--wb-form-accent': accent,
    '--wb-form-on-accent': isDarkHex(accent) ? '#ffffff' : '#1c2621',
  } as CSSProperties;
}
