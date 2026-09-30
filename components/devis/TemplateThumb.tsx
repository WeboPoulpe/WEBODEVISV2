'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { useHydrated } from '@/lib/useHydrated';

// Vignette d'un modèle de devis : la première page du document, réduite. Un clic ouvre l'aperçu complet.
// Le document est rendu à sa largeur réelle (A4 à l'écran) puis mis à l'échelle de la vignette.

const PAGE_WIDTH = 794;

export default function TemplateThumb({ html, lines, loading, label, onClick }: {
  /** Document du modèle ; absent pour un modèle enregistré sans mise en page. */
  html: string | null | undefined;
  /** Noms des prestations, affichés à la place du document quand il n'existe pas. */
  lines: string[];
  loading: boolean;
  label: string;
  onClick: () => void;
}) {
  const box = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(0);
  const hydrated = useHydrated();
  const clean = useMemo(() => (html && hydrated ? sanitizeHtml(html) : null), [html, hydrated]);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PAGE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={box}
      onClick={onClick}
      aria-label={label}
      className="group relative block w-full aspect-[3/4] overflow-hidden rounded-xl bg-white border border-gray-200 hover:border-primary-300 focus-visible:border-primary transition-colors"
    >
      {loading ? (
        <span className="absolute inset-0 animate-pulse bg-gray-100" />
      ) : (
        <span
          aria-hidden
          className="quote-render absolute top-0 left-0 block origin-top-left pointer-events-none select-none text-left text-gray-900"
          style={{ width: PAGE_WIDTH, padding: 56, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
        >
          {clean ? (
            <span className="block" dangerouslySetInnerHTML={{ __html: clean }} />
          ) : (
            <span className="block font-display">
              {lines.slice(0, 12).map((line, i) => (
                <span key={i} className="block py-4 text-[30px] leading-tight border-b border-gray-200">{line}</span>
              ))}
            </span>
          )}
        </span>
      )}
      <span className="absolute inset-x-0 bottom-0 flex justify-center pb-2.5 pt-8 bg-gradient-to-t from-white via-white/80 to-transparent">
        <span className="px-3 h-7 inline-flex items-center rounded-full bg-forest text-white text-xs font-medium opacity-90 group-hover:opacity-100">Voir en grand</span>
      </span>
    </button>
  );
}
