'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { generateQuoteHtml, type QuoteHtmlOptions } from '@/lib/generateQuoteHtml';
import { useHydrated } from '@/lib/useHydrated';
import { googleFontHref, outputSettings, quoteOutputCss } from '@/lib/quoteOutput';
import { sanitizeHtml } from '@/lib/sanitize';

// Aperçu d'une prestation telle qu'elle sortira dans un devis : la ligne du tableau et son bloc dans la carte du menu.
// Le HTML vient du générateur des devis (generateQuoteHtml) et la mise en forme de la feuille de sortie
// (quoteOutputCss) : mêmes couleurs, même police, mêmes interlignes que le document envoyé au client.
// Chaque bloc est rendu à sa largeur réelle sur la page A4, puis réduit si la place manque ; un contenu plus
// large que prévu (largeur fixe dans une fiche) est réduit avec le reste au lieu de déborder.

/** Largeur utile d'une page A4 à l'écran : 210 mm moins deux marges de 20 mm, à 96 px par pouce. */
const CONTENT_WIDTH = Math.round(((210 - 40) * 96) / 25.4);
/** Largeur de la colonne des plats dans la carte (max-width de .gastro-menu dans le générateur). */
const MENU_WIDTH = 400;
/** En colonne étroite, le tableau est rendu sur au moins cette largeur avant réduction. */
const TABLE_MIN_WIDTH = 460;

type Template = NonNullable<QuoteHtmlOptions['template']>;
const TEMPLATES: Template[] = ['standard', 'mariage', 'business', 'classique'];

export interface PrestationPreviewData {
  name: string;
  unitPrice: number;
  isOption: boolean;
  description: string;
  /** Fiche mise en page (éditeur plein écran) : quand elle existe, c'est elle qui figure dans la carte. */
  gastroCardHtml: string | null;
}

export default function PrestationQuotePreview({ data, style, font }: {
  data: PrestationPreviewData;
  /** Style des nouveaux devis (profil), « classique » par défaut. */
  style?: string | null;
  /** Police des nouveaux devis (profil), Georgia par défaut. */
  font?: string | null;
}) {
  const template: Template = TEMPLATES.includes(style as Template) ? (style as Template) : 'classique';
  const fontName = font || 'Georgia';

  // Le découpage passe par DOMParser, qui n'existe que dans le navigateur : rien n'est calculé au rendu serveur.
  const hydrated = useHydrated();
  const { table, menu } = useMemo(() => {
    if (!hydrated) return { table: '', menu: '' };
    const html = generateQuoteHtml({
      companyName: '',
      clientName: '',
      services: [{
        name: data.name.trim() || 'Nom de la prestation',
        description: data.description || null,
        quantity: 1,
        unitPrice: data.unitPrice,
        isOption: data.isOption,
        gastroCardHtml: data.gastroCardHtml,
      }],
      vatRate: 20,
    }, { template, font: fontName });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      table: doc.querySelector('[data-webo-financials] table')?.outerHTML ?? '',
      menu: doc.querySelector('.gastro-menu')?.outerHTML ?? '',
    };
  }, [hydrated, data.name, data.unitPrice, data.isOption, data.description, data.gastroCardHtml, template, fontName]);

  // Feuille de sortie des devis, sans la règle @page (elle changerait l'impression de la page Prestations).
  const css = useMemo(() => quoteOutputCss(outputSettings({ selected_font: fontName })).replace(/@page\s*\{[^}]*\}/, ''), [fontName]);
  const fontHref = googleFontHref(fontName);

  return (
    <div className="space-y-5">
      {fontHref && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={fontHref} />
      )}
      <style>{css}</style>
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Ligne du devis</h3>
        <ScaledDoc html={table} width={CONTENT_WIDTH} minWidth={TABLE_MIN_WIDTH} label="Ligne de la prestation dans le tableau du devis" />
      </section>
      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Dans la carte du menu</h3>
        <p className="text-sm text-gray-500 mb-2">
          {data.gastroCardHtml ? 'Votre fiche mise en page, telle qu’elle figure dans la carte.' : 'Le nom et la description, tels qu’ils figurent dans la carte.'}
        </p>
        <ScaledDoc html={menu} width={MENU_WIDTH} label="Prestation dans la carte du menu" />
      </section>
    </div>
  );
}

/** Marge blanche autour du morceau de document, en pixels du document. */
const PAD = 12;

/**
 * Un morceau du document, réduit pour tenir dans la colonne (jamais agrandi).
 * `width` est sa largeur sur la page A4 ; `minWidth` permet de le rendre un peu plus étroit quand la place manque
 * (le tableau : seule la colonne Désignation rétrécit), pour que le texte reste lisible une fois réduit.
 */
function ScaledDoc({ html, width, minWidth = width, label }: { html: string; width: number; minWidth?: number; label: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0, layout: width, natural: width + 2 * PAD, height: 0 });
  const clean = useMemo(() => sanitizeHtml(html), [html]);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const fit = () => {
      const available = o.clientWidth;
      if (!available) return;
      const layout = Math.round(Math.min(width, Math.max(minWidth, available - 2 * PAD)));
      // Un contenu à largeur fixe peut dépasser la colonne prévue : on réduit l'ensemble pour tout montrer.
      const content = i.firstElementChild as HTMLElement | null;
      const natural = Math.max(layout, content?.scrollWidth ?? 0) + 2 * PAD;
      const scale = Math.min(1, available / natural);
      const height = i.offsetHeight;
      setBox((prev) => (prev.scale === scale && prev.layout === layout && prev.natural === natural && prev.height === height
        ? prev : { scale, layout, natural, height }));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, [width, minWidth, clean]);

  return (
    <div ref={outer} className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white" role="img" aria-label={label}>
      <div className="relative overflow-hidden mx-auto" style={{ width: box.natural * box.scale, height: box.height * box.scale }}>
        <div
          ref={inner}
          className="quote-out absolute top-0 left-0 origin-top-left pointer-events-none select-none"
          style={{ width: box.natural, padding: PAD, transform: `scale(${box.scale})`, visibility: box.scale ? 'visible' : 'hidden' }}
        >
          <div className="quote-doc" style={{ width: box.layout, padding: 0 }} dangerouslySetInnerHTML={{ __html: clean }} />
        </div>
      </div>
    </div>
  );
}
