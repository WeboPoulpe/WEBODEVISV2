'use client';

// Le texte d'un bloc Texte, tapé directement dans la page de l'éditeur avancé (rendu réel). La mise en forme vient
// de la barre du panneau de droite (TextToolbar), qui agit sur la sélection de cette zone. La zone n'est remplie
// qu'à l'ouverture : React ne la réécrit plus ensuite, sinon le curseur sauterait à chaque frappe. L'objet
// { __html } reste le même d'un rendu à l'autre : React le compare par identité, un nouvel objet réécrirait la zone.

import { useState, type CSSProperties } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

/** Repère des zones de texte de la brochure, lu par la barre de mise en forme. */
export const TEXT_ATTR = 'data-brochure-text';

/** Collage : seule la structure du texte est gardée (gras, italique, listes), pas les polices, couleurs ni images. */
function cleanPastedHtml(html: string): string {
  return sanitizeHtml(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div'],
    ALLOWED_ATTR: [],
  });
}

export default function EditableText({ html, style, onChange }: { html: string; style: CSSProperties; onChange: (html: string) => void }) {
  const [initial] = useState(() => ({ __html: html }));
  return (
    <div
      {...{ [TEXT_ATTR]: '' }}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="Texte du bloc"
      spellCheck
      style={{ ...style, outline: 'none', cursor: 'text', minHeight: '1.55em' }}
      dangerouslySetInnerHTML={initial}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onPaste={(e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        if (pasted) document.execCommand('insertHTML', false, cleanPastedHtml(pasted));
        else if (text) document.execCommand('insertText', false, text);
      }}
      // Glisser du texte sélectionné ne doit pas déplacer le bloc.
      onDragStart={(e) => e.stopPropagation()}
    />
  );
}
