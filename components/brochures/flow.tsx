'use client';

// Suite de page : une page dont le contenu ne tient pas continue sur des pages ajoutées. Le contenu est rendu une
// fois dans un mesureur caché, à une largeur fixe ; ses boîtes (lignes de texte, titres, photos) donnent les
// coupures (lib/flowBreaks) ; chaque page affiche ensuite une tranche du même contenu. Tout est en cqw (centièmes
// de la largeur de page) : les coupures sont les mêmes à toutes les tailles d'écran.

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { computeBreaks, type FlowUnit } from '@/lib/flowBreaks';

/** Le contenu d'une page qui peut continuer : ses marges (cqw), son style de page, son contenu. */
export interface Flow { pad: number; style: CSSProperties; content: ReactNode }
/** Tranche du contenu montrée par une page, en cqw depuis le haut du contenu. */
export interface PageSlice { from: number; to: number }

/** Hauteur d'une page A4 en centièmes de sa largeur. */
export const PAGE_HEIGHT = (297 / 210) * 100;
/** Largeur de mesure tant qu'aucune page n'est affichée. */
const DEFAULT_WIDTH = 420;

/** Le cadre d'une page : sa tranche du contenu, ou (sans tranche) tout le contenu, qui défile si besoin. */
export function FlowFrame({ flow, slice, markers }: { flow: Flow; slice?: PageSlice | null; markers?: number[] }) {
  if (slice) {
    return (
      <div style={{ position: 'absolute', inset: 0, padding: `${flow.pad}cqw`, ...flow.style }}>
        <div data-page-slice="" style={{ height: `${slice.to - slice.from}cqw`, overflow: 'hidden' }}>
          <div style={{ transform: `translateY(-${slice.from}cqw)` }}>{flow.content}</div>
        </div>
      </div>
    );
  }
  return (
    <div data-page-scroll="" style={{ position: 'absolute', inset: 0, padding: `${flow.pad}cqw`, overflowY: 'auto', ...flow.style }}>
      <div style={{ position: 'relative' }}>
        {flow.content}
        {markers?.map((m) => (
          <div key={m} aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: `${m}cqw`, borderTop: '2px dashed #B4502D', pointerEvents: 'none' }}>
            <span style={{ position: 'absolute', right: 0, top: '0.4cqw', fontSize: '2.4cqw', fontFamily: 'system-ui, sans-serif', color: '#B4502D', background: '#FBF7F0', padding: '0 1cqw' }}>
              page suivante
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const isBlockDisplay = (el: Element) => {
  const d = getComputedStyle(el).display;
  return d !== 'none' && d !== 'contents' && !d.startsWith('inline');
};

/** Les lignes réelles d'un texte : boîtes de ses caractères, regroupées par ligne. */
function lineBoxes(el: HTMLElement): { top: number; bottom: number }[] {
  const rects: DOMRect[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    rects.push(...Array.from(range.getClientRects()).filter((r) => r.height > 0));
  }
  // Images et autres éléments en ligne comptent aussi dans la hauteur de leur ligne.
  el.querySelectorAll('img, svg, br').forEach((x) => { const r = x.getBoundingClientRect(); if (r.height > 0) rects.push(r); });
  rects.sort((a, b) => a.top - b.top);
  const lines: { top: number; bottom: number }[] = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (last && r.top < last.bottom - 1) last.bottom = Math.max(last.bottom, r.bottom);
    else lines.push({ top: r.top, bottom: r.bottom });
  }
  return lines;
}

/** Les boîtes du contenu, en cqw depuis son haut : feuilles de texte (avec leurs lignes), titres, blocs insécables. */
function collect(root: HTMLElement, scale: number): FlowUnit[] {
  const origin = root.getBoundingClientRect().top;
  const at = (y: number) => (y - origin) * scale;
  const units: FlowUnit[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const c = child as HTMLElement;
      const r = c.getBoundingClientRect();
      if (r.height < 0.5) continue;
      const top = at(r.top);
      const bottom = at(r.bottom);
      if (c.hasAttribute('data-flow-block') || /^(IMG|TABLE|SVG|VIDEO|IFRAME|HR)$/i.test(c.tagName)) { units.push({ top, bottom, kind: 'block' }); continue; }
      if (/^H[1-6]$/.test(c.tagName) || c.hasAttribute('data-flow-heading')) { units.push({ top, bottom, kind: 'heading' }); continue; }
      if (Array.from(c.children).some(isBlockDisplay)) { walk(c); continue; }
      units.push({ top, bottom, kind: 'line', lines: lineBoxes(c).map((l) => ({ top: at(l.top), bottom: at(l.bottom) })) });
    }
  };
  walk(root);
  return units;
}

/**
 * Les débuts de pages de chaque contenu (null : pas un contenu qui continue, ou pas encore mesuré), et le mesureur
 * à placer dans la page. Mesure refaite quand une image ou une police change la hauteur.
 */
export function useFlowBreaks(flows: (Flow | null)[]): { breaks: (number[] | null)[]; measurer: ReactNode } {
  const host = useRef<HTMLDivElement>(null);
  // Le mesureur vit dans un DOM fantôme fermé : sa copie du contenu n'est ni lue, ni trouvée, ni cherchée.
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);
  const [breaks, setBreaks] = useState<(number[] | null)[]>(() => flows.map(() => null));
  // Mesure à la largeur réelle des pages : les fiches écrivent leurs tailles en pixels, le texte ne suit pas la page.
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const flowsRef = useRef(flows);
  flowsRef.current = flows;

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    // Rejoué deux fois en développement (StrictMode) : le DOM fantôme n'est créé qu'une fois.
    const shadow = shadowRef.current ?? el.attachShadow({ mode: 'closed' });
    shadowRef.current = shadow;
    shadow.replaceChildren();
    // Mêmes styles que la page (Tailwind, polices), copiés ; ceux ajoutés ensuite (développement) suivent.
    const copy = (n: Node) => {
      if (n instanceof HTMLLinkElement && n.rel === 'stylesheet') shadow.appendChild(n.cloneNode(true));
      else if (n instanceof HTMLStyleElement) shadow.appendChild(n.cloneNode(true));
    };
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(copy);
    const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(copy)));
    mo.observe(document.head, { childList: true });
    const div = document.createElement('div');
    shadow.appendChild(div);
    setMount(div);
    // Créé une seule fois (deux en StrictMode) : l'observateur des styles vit autant que le mesureur.
    return () => mo.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!mount) return;
    const sheetOf = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flow-sheet]')).find((e) => e.getBoundingClientRect().width > 120);
    const measure = () => {
      const shown = sheetOf()?.getBoundingClientRect().width;
      if (shown && Math.abs(shown - width) > 1) { setWidth(shown); return; }
      const scale = 100 / width;
      const next = flowsRef.current.map((f, i) => {
        const root = f && mount.querySelector<HTMLElement>(`[data-flow-i="${i}"] [data-flow-root]`);
        if (!f || !root) return null;
        const total = root.getBoundingClientRect().height * scale;
        return computeBreaks(collect(root, scale), PAGE_HEIGHT - 2 * f.pad, total);
      });
      setBreaks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    mount.querySelectorAll('[data-flow-root]').forEach((r) => ro.observe(r));
    const sheet = sheetOf();
    if (sheet) ro.observe(sheet);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; ro.disconnect(); };
    // Pas à chaque rendu (une frappe dans le formulaire du lien public) : images et polices passent par les observateurs.
  }, [mount, width, flows]);

  const content = (
    <>
      {flows.map((f, i) => f && (
        <div key={i} data-flow-i={i} className="wb-sheet" style={{ width, containerType: 'inline-size', fontFamily: 'Georgia, "Times New Roman", serif' }}>
          <div style={{ padding: `0 ${f.pad}cqw`, ...f.style }}>
            <div data-flow-root="" style={{ display: 'flow-root' }}>{f.content}</div>
          </div>
        </div>
      ))}
    </>
  );
  const measurer = (
    <div ref={host} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      {mount && createPortal(content, mount)}
    </div>
  );
  return { breaks, measurer };
}

/** Les pages, chaque contenu qui continue étendu en autant de pages que de tranches. */
export function expandPages<T>(pages: T[], flows: (Flow | null)[], breaks: (number[] | null)[]): { page: T; slice: PageSlice | null; source: number }[] {
  return pages.flatMap((page, i): { page: T; slice: PageSlice | null; source: number }[] => {
    const b = breaks[i];
    const f = flows[i];
    if (!f || !b || b.length < 2) return [{ page, slice: null, source: i }];
    const height = PAGE_HEIGHT - 2 * f.pad;
    return b.map((from, k) => ({ page, slice: { from, to: b[k + 1] ?? from + height }, source: i }));
  });
}
