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
const WIDTH = 420;
const SCALE = 100 / WIDTH;

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

/** Les boîtes du contenu, en cqw depuis son haut : feuilles de texte, titres, et blocs insécables. */
function collect(root: HTMLElement): FlowUnit[] {
  const origin = root.getBoundingClientRect().top;
  const units: FlowUnit[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const c = child as HTMLElement;
      const r = c.getBoundingClientRect();
      if (r.height < 0.5) continue;
      const top = (r.top - origin) * SCALE;
      const bottom = (r.bottom - origin) * SCALE;
      if (c.hasAttribute('data-flow-block') || /^(IMG|TABLE|SVG|VIDEO|IFRAME|HR)$/i.test(c.tagName)) { units.push({ top, bottom, kind: 'block' }); continue; }
      if (/^H[1-6]$/.test(c.tagName) || c.hasAttribute('data-flow-heading')) { units.push({ top, bottom, kind: 'heading' }); continue; }
      if (Array.from(c.children).some(isBlockDisplay)) { walk(c); continue; }
      const cs = getComputedStyle(c);
      const fontSize = parseFloat(cs.fontSize) || 16;
      const lh = cs.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(cs.lineHeight) || fontSize * 1.2;
      const inset = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.borderTopWidth) || 0);
      const insetBottom = (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      units.push({ top: top + inset * SCALE, bottom: bottom - insetBottom * SCALE, kind: 'line', lineHeight: lh * SCALE });
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
  const flowsRef = useRef(flows);
  flowsRef.current = flows;

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || mount) return;
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
    return () => mo.disconnect();
  }, [mount]);

  useLayoutEffect(() => {
    if (!mount) return;
    const measure = () => {
      const next = flowsRef.current.map((f, i) => {
        const root = f && mount.querySelector<HTMLElement>(`[data-flow-i="${i}"] [data-flow-root]`);
        if (!f || !root) return null;
        const total = root.getBoundingClientRect().height * SCALE;
        return computeBreaks(collect(root), PAGE_HEIGHT - 2 * f.pad, total);
      });
      setBreaks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    mount.querySelectorAll('[data-flow-root]').forEach((r) => ro.observe(r));
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) measure(); });
    return () => { alive = false; ro.disconnect(); };
  });

  const content = (
    <>
      {flows.map((f, i) => f && (
        <div key={i} data-flow-i={i} className="wb-sheet" style={{ width: WIDTH, containerType: 'inline-size', fontFamily: 'Georgia, "Times New Roman", serif' }}>
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
    return b.map((from, k) => ({ page, slice: { from, to: Math.min(b[k + 1] ?? from + height, from + height) }, source: i }));
  });
}
