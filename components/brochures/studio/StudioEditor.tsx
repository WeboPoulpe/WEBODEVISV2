'use client';

// Le Studio : composer chaque page de la brochure librement, comme une affiche (à la Canva), avec la mise en forme
// du texte d'un traitement de texte (à la WeboWord).
// - Panneau « Ajouter » : modèles de pages, textes, photos, formes, prestations du catalogue.
// - La page : glisser pour déplacer (repères d'alignement magnétiques), poignées pour redimensionner, poignée ronde
//   pour faire pivoter, double-clic (ou « Modifier le texte ») pour écrire dans le texte, directement sur la page.
// - Barre du haut : mise en forme (police, taille, gras, couleur, alignement, listes, interligne…), calques,
//   dupliquer, verrouiller, supprimer ; annuler / rétablir.
// - Panneau « Réglages » : position au millimètre, transparence, réglages propres à l'élément, ou fond de la page.
// - Bandeau des pages : vignettes, ajouter, dupliquer, déplacer, supprimer. Le formulaire est toujours la dernière.
// Raccourcis : Suppr, flèches (Maj : plus loin), Ctrl+Z / Ctrl+Y, Ctrl+D, Ctrl+C / Ctrl+V, Échap.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Bold, BringToFront, CaseUpper, Copy, Italic, List,
  ListOrdered, Lock, LockOpen, Minus, Pencil, Plus, Redo2, RemoveFormatting, SendToBack, Trash2, Underline, Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import { sanitizeHtml } from '@/lib/sanitize';
import type { BrochureCover, CatalogPrestation } from '@/lib/brochure';
import {
  PAGE_H, PAGE_TEMPLATES, STUDIO_FONTS, blankPage, cloneElement, clonePage, imageEl, prestationEl, resolveStudio, shapeEl, studioFontsHref, textEl,
  type ResolvedStudioElement, type ResolvedStudioPage, type StudioDoc, type StudioElement, type StudioPage, type StudioText, type TemplateContext,
} from '@/lib/brochureStudio';
import ItemRetouch from '../ItemRetouch';
import type { BrochureCompany } from '../BrochurePages';
import { ElementContent, PageBackground, STUDIO_CSS, elementBox, textStyle } from './StudioPage';
import {
  AddPanel, ColorField, FontSelect, Group, NumberField, PagesStrip, PhotoGroup, PositionGroup, Segmented, Slider, TEXT_PRESETS,
  type AddTab, type ShapeKind,
} from './StudioPanels';
import { useHistory } from './useHistory';

const RATIO = PAGE_H / 100;
/** Une taille de texte (centièmes de page) en points, comme dans un traitement de texte (A4 : 595 pt de large). */
const PT = 5.95;
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const round = (n: number) => Math.round(n * 10) / 10;
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

/** Repères d'alignement : bords et milieux de la page et des autres éléments. */
function snap(box: { x: number; y: number; w: number; h: number }, others: { x: number; y: number; w: number; h: number }[], thr: number) {
  const xs = [0, 50, 100, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
  const ys = [0, PAGE_H / 2, PAGE_H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
  const best = (edges: number[], targets: number[]) => {
    let r: { d: number; t: number } | null = null;
    for (const e of edges) for (const t of targets) {
      const d = t - e;
      if (Math.abs(d) < thr && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, t };
    }
    return r;
  };
  const bx = best([box.x, box.x + box.w / 2, box.x + box.w], xs);
  const by = best([box.y, box.y + box.h / 2, box.y + box.h], ys);
  return { x: box.x + (bx?.d ?? 0), y: box.y + (by?.d ?? 0), gx: bx ? [bx.t] : [], gy: by ? [by.t] : [] };
}

/** Le texte en cours de saisie, directement dans la page. React ne le réécrit pas pendant la frappe. */
function TextEditing({ el, onInput, onDone, caret }: { el: StudioText; onInput: (html: string) => void; onDone: () => void; caret: { x: number; y: number } | 'all' | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => ({ __html: el.html }));
  useEffect(() => {
    const n = ref.current;
    if (!n) return;
    n.focus({ preventScroll: true });
    const sel = document.getSelection();
    let range: Range | null = null;
    if (caret && caret !== 'all' && 'caretRangeFromPoint' in document) range = document.caretRangeFromPoint(caret.x, caret.y);
    if (!range || !n.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(n);
      if (caret !== 'all') range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} data-studio-text={el.id} data-editing="" className="wb-studio-text" contentEditable suppressContentEditableWarning role="textbox"
      aria-multiline="true" aria-label="Texte" spellCheck dangerouslySetInnerHTML={initial}
      style={{ ...textStyle(el), outline: 'none', cursor: 'text', minHeight: '1em', userSelect: 'text' }}
      onInput={(e) => onInput(e.currentTarget.innerHTML)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onDone(); } }}
      onPaste={(e) => {
        // Collage : la structure du texte seulement (gras, italique, listes), pas les polices ni les couleurs d'ailleurs.
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        if (html) document.execCommand('insertHTML', false, sanitizeHtml(html, { ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div'], ALLOWED_ATTR: [] }));
        else if (text) document.execCommand('insertText', false, text);
      }} />
  );
}

function ToolBtn({ label, onPress, active, disabled, children }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled}
      // Le clic ne prend pas le focus : la sélection reste dans le texte.
      onMouseDown={(e) => e.preventDefault()} onClick={onPress}
      className={cn('inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition-colors disabled:opacity-35',
        active ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100')}>
      {children}
    </button>
  );
}
const Sep = () => <span aria-hidden className="mx-0.5 h-5 w-px bg-gray-200" />;

export interface StudioSettings {
  language: 'fr' | 'en';
  cover: BrochureCover;
  prices: { show: boolean; mode: 'ht' | 'ttc'; vatRate: number };
}

export default function StudioEditor({ initial, onChange, catalog, company, settings }: {
  initial: StudioDoc;
  onChange: (doc: StudioDoc) => void;
  catalog: CatalogPrestation[];
  company: BrochureCompany;
  settings: StudioSettings;
}) {
  const { confirm } = useFeedback();
  const { doc, set, undo, redo, canUndo, canRedo } = useHistory(initial);
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; caret: { x: number; y: number } | 'all' | null } | null>(null);
  const [addTab, setAddTab] = useState<AddTab>('templates');
  const [panel, setPanel] = useState<'add' | 'settings'>('add');
  const [guides, setGuides] = useState<{ gx: number[]; gy: number[] } | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [overflow, setOverflow] = useState<Set<string>>(new Set());
  const [retouch, setRetouch] = useState<string | null>(null);
  const clipboard = useRef<StudioElement | null>(null);
  const savedRange = useRef<Range | null>(null);

  // Le document part vers l'enregistrement automatique à chaque changement.
  const first = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => { if (first.current) { first.current = false; return; } onChangeRef.current(doc); }, [doc]);

  const pageIndex = Math.min(pi, doc.pages.length - 1);
  const page = doc.pages[pageIndex];
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const priceOpts = useMemo(() => ({ ...settings.prices, language: settings.language, forEditor: true }), [settings.prices, settings.language]);
  const resolved = useMemo(() => resolveStudio(doc, byId, priceOpts), [doc, byId, priceOpts]);
  const resolvePage = useCallback((p: StudioPage) => resolveStudio({ pages: [p] }, byId, priceOpts)[0], [byId, priceOpts]);
  const rpage = resolved[pageIndex];
  const rById = useMemo(() => new Map(rpage.els.map((e) => [e.id, e])), [rpage]);
  const selected = page.els.find((e) => e.id === sel) ?? null;
  const used = useMemo(() => new Set(doc.pages.flatMap((p) => p.els.flatMap((e) => (e.type === 'prestation' ? [e.prestationId] : [])))), [doc]);

  // Toutes les polices du Studio chargées une fois (listes et aperçus), comme sur le lien public pour celles utilisées.
  const fontsHref = useMemo(() => studioFontsHref(STUDIO_FONTS), []);

  // ── Changements ────────────────────────────────────────────────────────────
  const setPage = useCallback((fn: (p: StudioPage) => StudioPage, merge?: string) => {
    set((d) => ({ pages: d.pages.map((p, i) => (i === pageIndex ? fn(p) : p)) }), merge);
  }, [set, pageIndex]);
  const update = useCallback((id: string, patch: Partial<StudioElement>, merge?: string) => {
    setPage((p) => ({ ...p, els: p.els.map((e) => (e.id === id ? { ...e, ...patch } as StudioElement : e)) }), merge);
  }, [setPage]);
  const add = (el: StudioElement, edit = false) => {
    setPage((p) => ({ ...p, els: [...p.els, el] }));
    setSel(el.id);
    setEditing(edit ? { id: el.id, caret: 'all' } : null);
  };
  const remove = (id: string) => {
    const el = page.els.find((e) => e.id === id);
    if (!el || el.type === 'form') return;
    setPage((p) => ({ ...p, els: p.els.filter((e) => e.id !== id) }));
    setSel(null); setEditing(null);
  };
  const duplicate = (id: string) => {
    const el = page.els.find((e) => e.id === id);
    if (!el || el.type === 'form') return;
    const copy = { ...cloneElement(el), x: round(el.x + 3), y: round(el.y + 3), locked: undefined };
    setPage((p) => ({ ...p, els: [...p.els, copy] }));
    setSel(copy.id);
  };
  const layer = (id: string, to: 'up' | 'down' | 'front' | 'back') => setPage((p) => {
    const i = p.els.findIndex((e) => e.id === id);
    if (i < 0) return p;
    const els = [...p.els];
    const [el] = els.splice(i, 1);
    const j = to === 'front' ? els.length : to === 'back' ? 0 : Math.max(0, Math.min(els.length, i + (to === 'up' ? 1 : -1)));
    els.splice(j, 0, el);
    return { ...p, els };
  });
  const stopEditing = () => {
    if (editing) {
      const el = page.els.find((e) => e.id === editing.id);
      // Un texte vidé disparaît, comme dans un logiciel de mise en page.
      if (el?.type === 'text' && !el.html.replace(/<[^>]+>|&nbsp;/g, '').trim()) setPage((p) => ({ ...p, els: p.els.filter((e) => e.id !== el.id) }));
    }
    setEditing(null);
  };

  // ── Pages ──────────────────────────────────────────────────────────────────
  const insertPage = (p: StudioPage) => {
    const at = Math.min(pageIndex + 1, doc.pages.length - 1);
    set((d) => ({ pages: [...d.pages.slice(0, at), p, ...d.pages.slice(at)] }));
    setPi(at); setSel(null); setEditing(null);
  };
  const templateContext: TemplateContext = useMemo(() => ({
    title: settings.cover.title, subtitle: settings.cover.subtitle ?? null, photoUrl: settings.cover.photoUrl ?? null, photoFrame: settings.cover.photoFrame ?? null,
    company: { name: company.name, address: company.address, phone: company.phone, email: company.email, website: company.website }, language: settings.language,
  }), [settings.cover, settings.language, company]);
  const addTemplate = (id: string) => {
    const t = PAGE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const ids = [...catalog.filter((p) => !used.has(p.id)), ...catalog.filter((p) => used.has(p.id))].map((p) => p.id);
    insertPage(t.make(templateContext, ids));
  };
  const deletePage = async () => {
    if (page.form) return;
    if (page.els.length && !(await confirm({ title: `Supprimer la page ${pageIndex + 1} ?`, message: 'Ses éléments seront retirés. « Annuler » (Ctrl+Z) la fait revenir.', confirmLabel: 'Supprimer', danger: true }))) return;
    set((d) => ({ pages: d.pages.filter((_, i) => i !== pageIndex) }));
    setPi(Math.max(0, pageIndex - 1)); setSel(null); setEditing(null);
  };
  const movePage = (dir: -1 | 1) => {
    const j = pageIndex + dir;
    if (page.form || j < 0 || j >= doc.pages.length - 1) return;
    set((d) => {
      const pages = [...d.pages];
      [pages[pageIndex], pages[j]] = [pages[j], pages[pageIndex]];
      return { pages };
    });
    setPi(j);
  };

  // ── Ajouts depuis le panneau ───────────────────────────────────────────────
  const addText = (presetId: (typeof TEXT_PRESETS)[number]['id']) => {
    const p = TEXT_PRESETS.find((x) => x.id === presetId)!;
    const w = presetId === 'body' ? 70 : 80;
    add(textEl({ x: (100 - w) / 2, y: PAGE_H / 2 - 8, w, html: `<p>${p.sample}</p>`, ...p.style }), true);
  };
  const addPhoto = (url: string) => {
    if (selected?.type === 'image') { update(selected.id, { url, frame: undefined }); return; }
    const img = new Image();
    const place = (ratio: number) => {
      let w = 60;
      let h = w * ratio;
      if (h > PAGE_H * 0.7) { h = PAGE_H * 0.7; w = h / ratio; }
      add(imageEl({ x: round((100 - w) / 2), y: round((PAGE_H - h) / 2), w: round(w), h: round(h), url }));
    };
    img.onload = () => place(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.75);
    img.onerror = () => place(0.75);
    img.src = url;
  };
  const addShape = (s: ShapeKind) => {
    if (s === 'line') add(shapeEl({ x: 30, y: PAGE_H / 2, w: 40, h: 2, shape: 'line', fill: null, stroke: '#b4502d', strokeWidth: 0.3 }));
    else if (s === 'frame') add(shapeEl({ x: 10, y: 20, w: 80, h: 100, fill: null, stroke: '#a8844f', strokeWidth: 0.4 }));
    else add(shapeEl({ x: 30, y: PAGE_H / 2 - 20, w: 40, h: 40, shape: s === 'ellipse' ? 'ellipse' : 'rect', radius: s === 'rounded' ? 4 : 0 }));
  };
  const addPrestation = (id: string) => add(prestationEl({ x: 8, y: round(PAGE_H / 2 - 22), w: 84, h: 44, prestationId: id, photo: 'left' }));

  // ── La page à l'écran ──────────────────────────────────────────────────────
  const wrap = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(420);
  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const measure = () => {
      const cw = node.clientWidth;
      const phone = window.innerWidth < 768;
      setW(Math.floor(Math.max(220, phone ? cw - 8 : Math.min(cw - 48, (window.innerHeight - 200) / RATIO, 700))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const unit = W / 100;

  // Hauteur réelle des textes (elle suit leur contenu) et prestations dont le texte dépasse.
  useLayoutEffect(() => {
    const node = pageRef.current;
    if (!node) return;
    const next: Record<string, number> = {};
    node.querySelectorAll<HTMLElement>('[data-el-type="text"]').forEach((n) => { next[n.dataset.el!] = round(n.offsetHeight / unit); });
    setHeights((h) => (JSON.stringify(h) === JSON.stringify(next) ? h : next));
    const over = new Set<string>();
    node.querySelectorAll<HTMLElement>('[data-el-type="prestation"]').forEach((n) => {
      const inner = n.querySelector<HTMLElement>('[data-studio-overflow]');
      if (inner && inner.scrollHeight > inner.clientHeight + 2) over.add(n.dataset.el!);
    });
    setOverflow((o) => (o.size === over.size && [...o].every((x) => over.has(x)) ? o : over));
  });
  const heightOf = (e: StudioElement) => (e.type === 'text' ? heights[e.id] ?? e.h : e.h);

  // ── Gestes : déplacer, redimensionner, faire pivoter ───────────────────────
  const gesture = (e: React.PointerEvent, el: StudioElement, kind: 'move' | 'rotate' | Handle) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (el.locked && kind === 'move') { setSel(el.id); return; }
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, el, h: heightOf(el), key: `${kind}-${el.id}-${Date.now()}` };
    const rect = pageRef.current!.getBoundingClientRect();
    const cx = rect.left + (el.x + el.w / 2) * unit;
    const cy = rect.top + (el.y + start.h / 2) * unit;
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx);
    const others = page.els.filter((o) => o.id !== el.id && !o.rot).map((o) => ({ x: o.x, y: o.y, w: o.w, h: heightOf(o) }));
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / unit;
      const dy = (ev.clientY - start.py) / unit;
      if (!moved && Math.hypot(ev.clientX - start.px, ev.clientY - start.py) < 3) return;
      moved = true;
      if (kind === 'move') {
        const box = { x: el.x + dx, y: el.y + dy, w: el.w, h: start.h };
        const s = ev.altKey ? { x: box.x, y: box.y, gx: [], gy: [] } : snap(box, others, 6 / unit);
        setGuides({ gx: s.gx, gy: s.gy });
        update(el.id, { x: round(s.x), y: round(s.y) }, start.key);
      } else if (kind === 'rotate') {
        const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
        let rot = el.rot + ((a - a0) * 180) / Math.PI;
        rot = ((rot + 540) % 360) - 180;
        const near = Math.round(rot / 45) * 45;
        if (Math.abs(rot - near) < 4) rot = near === 180 ? -180 : near;
        update(el.id, { rot: Math.round(rot * 2) / 2 }, start.key);
      } else {
        // Redimensionner dans le repère de l'élément (il peut être tourné), le côté opposé restant en place.
        const t = (el.rot * Math.PI) / 180;
        const lx = dx * Math.cos(t) + dy * Math.sin(t);
        const ly = -dx * Math.sin(t) + dy * Math.cos(t);
        const sx = kind.includes('e') ? 1 : kind.includes('w') ? -1 : 0;
        const sy = kind.includes('s') ? 1 : kind.includes('n') ? -1 : 0;
        const minH = el.type === 'shape' && el.shape === 'line' ? 0.5 : 2;
        let nw = Math.max(2, el.w + sx * lx);
        let nh = Math.max(minH, start.h + sy * ly);
        const corner = sx !== 0 && sy !== 0;
        const keep = el.type === 'text' ? corner : (corner && (el.type === 'image') !== ev.shiftKey);
        if (keep) {
          const k = Math.max(nw / el.w, el.type === 'text' ? 0 : nh / start.h, 0.05);
          nw = el.w * k; nh = start.h * k;
        }
        if (el.type === 'text' && !corner) nh = start.h;
        const dw = nw - el.w;
        const dh = nh - start.h;
        const ox = (sx * dw) / 2;
        const oy = (sy * dh) / 2;
        const ncx = el.x + el.w / 2 + ox * Math.cos(t) - oy * Math.sin(t);
        const ncy = el.y + start.h / 2 + ox * Math.sin(t) + oy * Math.cos(t);
        const patch: Partial<StudioElement> = { x: round(ncx - nw / 2), y: round(ncy - nh / 2), w: round(nw), h: round(nh) };
        if (el.type === 'text' && corner) (patch as Partial<StudioText>).size = Math.min(30, Math.max(1, Math.round(el.size * (nw / el.w) * 100) / 100));
        update(el.id, patch, start.key);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setGuides(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // ── Texte : mise en forme de la sélection, ou du texte entier ──────────────
  useEffect(() => {
    const onSelection = () => {
      const s = document.getSelection();
      if (!s?.rangeCount) return;
      const node = s.anchorNode instanceof HTMLElement ? s.anchorNode : s.anchorNode?.parentElement;
      if (node?.closest('[data-editing]')) savedRange.current = s.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);
  const editingSel = () => {
    const r = savedRange.current;
    return !!(editing && selected && editing.id === selected.id && r && !r.collapsed
      && document.querySelector(`[data-editing][data-studio-text="${selected.id}"]`)?.contains(r.commonAncestorContainer));
  };
  /** Commande de mise en forme sur la sélection (en saisie) ou sur tout le texte. */
  const runText = (fn: (node: HTMLElement) => void) => {
    if (selected?.type !== 'text') return;
    const node = document.querySelector<HTMLElement>(`[data-studio-text="${selected.id}"]`);
    if (!node) return;
    const typing = editing?.id === selected.id;
    const s = document.getSelection();
    if (typing) {
      node.focus({ preventScroll: true });
      const r = savedRange.current;
      if (r && node.contains(r.commonAncestorContainer)) { s?.removeAllRanges(); s?.addRange(r); }
    } else {
      node.contentEditable = 'true';
      node.focus({ preventScroll: true });
      const r = document.createRange();
      r.selectNodeContents(node);
      s?.removeAllRanges();
      s?.addRange(r);
    }
    fn(node);
    const html = node.innerHTML;
    if (!typing) { node.removeAttribute('contenteditable'); s?.removeAllRanges(); node.blur(); }
    update(selected.id, { html }, `text-${selected.id}`);
  };
  const exec = (cmd: string, value?: string, css = false) => runText(() => {
    document.execCommand('styleWithCSS', false, css ? 'true' : 'false');
    document.execCommand(cmd, false, value);
  });
  /** Plus grand ou plus petit que le reste du texte (sélection) : execCommand ne connaît que 7 tailles. */
  const resizeSelection = (factor: number) => runText((node) => {
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    node.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.style.fontSize = `${factor}em`;
      span.append(...f.childNodes);
      f.replaceWith(span);
    });
  });
  const queryState = (cmd: string) => { try { return editing ? document.queryCommandState(cmd) : false; } catch { return false; } };

  // ── Clavier ────────────────────────────────────────────────────────────────
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (isTyping(e.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'v' && clipboard.current) {
      e.preventDefault();
      const copy = { ...cloneElement(clipboard.current), x: round(clipboard.current.x + 3), y: round(clipboard.current.y + 3) };
      clipboard.current = copy;
      add(copy);
      return;
    }
    if (!selected) return;
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(selected.id); return; }
    if (mod && e.key.toLowerCase() === 'c') { if (selected.type !== 'form') clipboard.current = selected; return; }
    if (e.key === 'Escape') { setSel(null); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !selected.locked) { e.preventDefault(); remove(selected.id); return; }
    if (e.key === 'Enter' && selected.type === 'text') { e.preventDefault(); setEditing({ id: selected.id, caret: null }); return; }
    const step = e.shiftKey ? 5 : 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d && !selected.locked) { e.preventDefault(); update(selected.id, { x: round(selected.x + d[0]), y: round(selected.y + d[1]) }, `nudge-${selected.id}`); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectPage = (i: number) => { setPi(i); setSel(null); setEditing(null); };

  // ── Barre d'outils ─────────────────────────────────────────────────────────
  const toolbar = (
    <div role="toolbar" aria-label="Outils du Studio"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur">
      <ToolBtn label="Annuler (Ctrl+Z)" onPress={undo} disabled={!canUndo}><Undo2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Rétablir (Ctrl+Y)" onPress={redo} disabled={!canRedo}><Redo2 className="h-4 w-4" /></ToolBtn>
      {selected && <Sep />}
      {selected?.type === 'text' && (() => {
        const t = selected;
        const pt = Math.round(t.size * PT);
        return (
          <>
            {editing?.id !== t.id && <ToolBtn label="Modifier le texte" onPress={() => setEditing({ id: t.id, caret: null })}><Pencil className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Écrire</span></ToolBtn>}
            <select aria-label="Police" value={t.font} onMouseDown={() => { /* la sélection est gardée par savedRange */ }}
              onChange={(e) => (editingSel() ? exec('fontName', e.target.value, true) : update(t.id, { font: e.target.value }))}
              className="h-8 max-w-[9.5rem] rounded-md border border-gray-200 bg-white px-1.5 text-sm" style={{ fontFamily: t.font }}>
              {STUDIO_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <div className="flex items-center">
              <ToolBtn label="Plus petit" onPress={() => (editingSel() ? resizeSelection(0.85) : update(t.id, { size: Math.max(1, Math.round((t.size - 1 / PT) * 100) / 100) }))}><Minus className="h-3.5 w-3.5" /></ToolBtn>
              <input aria-label="Taille du texte (points)" inputMode="numeric" value={pt} key={pt}
                onChange={(e) => { const n = Number(e.target.value); if (n >= 6 && n <= 180) update(t.id, { size: Math.round((n / PT) * 100) / 100 }, `size-${t.id}`); }}
                className="h-8 w-10 rounded-md border border-gray-200 text-center text-sm tabular-nums" />
              <ToolBtn label="Plus grand" onPress={() => (editingSel() ? resizeSelection(1.18) : update(t.id, { size: Math.min(30, Math.round((t.size + 1 / PT) * 100) / 100) }))}><Plus className="h-3.5 w-3.5" /></ToolBtn>
            </div>
            <ToolBtn label="Gras (Ctrl+B)" active={queryState('bold')} onPress={() => exec('bold')}><Bold className="h-4 w-4" /></ToolBtn>
            <ToolBtn label="Italique (Ctrl+I)" active={queryState('italic')} onPress={() => exec('italic')}><Italic className="h-4 w-4" /></ToolBtn>
            <ToolBtn label="Souligné (Ctrl+U)" active={queryState('underline')} onPress={() => exec('underline')}><Underline className="h-4 w-4" /></ToolBtn>
            <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-gray-100" title="Couleur du texte">
              <span className="sr-only">Couleur du texte</span>
              <span aria-hidden className="text-sm font-bold" style={{ color: t.color, textDecoration: 'underline', textDecorationThickness: 3 }}>A</span>
              <input type="color" value={t.color} className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => (editingSel() ? exec('foreColor', e.target.value, true) : update(t.id, { color: e.target.value.toLowerCase() }, `color-${t.id}`))} />
            </label>
            <Sep />
            {([['left', AlignLeft, 'Aligner à gauche'], ['center', AlignCenter, 'Centrer'], ['right', AlignRight, 'Aligner à droite'], ['justify', AlignJustify, 'Justifier']] as const).map(([a, Icon, label]) => (
              <ToolBtn key={a} label={label} active={t.align === a} onPress={() => update(t.id, { align: a })}><Icon className="h-4 w-4" /></ToolBtn>
            ))}
            <ToolBtn label="Liste à puces" onPress={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></ToolBtn>
            <ToolBtn label="Liste numérotée" onPress={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolBtn>
            <ToolBtn label="Majuscules" active={t.uppercase} onPress={() => update(t.id, { uppercase: !t.uppercase })}><CaseUpper className="h-4 w-4" /></ToolBtn>
            <select aria-label="Interligne" value={String(t.lineHeight)} onChange={(e) => update(t.id, { lineHeight: Number(e.target.value) })}
              className="h-8 rounded-md border border-gray-200 bg-white px-1 text-sm" title="Interligne">
              {[...new Set([0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.8, 2, t.lineHeight])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>↕ {v}</option>)}
            </select>
            <ToolBtn label="Effacer la mise en forme" onPress={() => exec('removeFormat')}><RemoveFormatting className="h-4 w-4" /></ToolBtn>
          </>
        );
      })()}
      {selected && (
        <>
          <Sep />
          <ToolBtn label="Avancer d'un plan" onPress={() => layer(selected.id, 'up')}><ArrowUpToLine className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Reculer d'un plan" onPress={() => layer(selected.id, 'down')}><ArrowDownToLine className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Premier plan" onPress={() => layer(selected.id, 'front')}><BringToFront className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Arrière-plan" onPress={() => layer(selected.id, 'back')}><SendToBack className="h-4 w-4" /></ToolBtn>
          <ToolBtn label={selected.locked ? 'Déverrouiller' : 'Verrouiller'} active={selected.locked} onPress={() => update(selected.id, { locked: selected.locked ? undefined : true })}>
            {selected.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </ToolBtn>
          {selected.type !== 'form' && <>
            <ToolBtn label="Dupliquer (Ctrl+D)" onPress={() => duplicate(selected.id)}><Copy className="h-4 w-4" /></ToolBtn>
            <ToolBtn label="Supprimer (Suppr)" onPress={() => remove(selected.id)}><Trash2 className="h-4 w-4 text-danger" /></ToolBtn>
          </>}
        </>
      )}
      {!selected && <span className="px-2 text-xs text-gray-500">Cliquez sur un élément de la page pour le modifier, ou ajoutez-en un.</span>}
    </div>
  );

  // ── Réglages ───────────────────────────────────────────────────────────────
  const inspector = (() => {
    if (!selected) {
      return (
        <div className="space-y-3">
          <Group title={`Fond de la page ${pageIndex + 1}`}>
            <ColorField label="Couleur" value={page.bg} onChange={(bg) => setPage((p) => ({ ...p, bg: bg ?? '#fbf7f0' }), 'bg')} />
          </Group>
          <PhotoGroup title="Photo de fond" url={page.bgImage?.url ?? null} frame={page.bgImage?.frame} ratio={141}
            onUrl={(u) => setPage((p) => ({ ...p, bgImage: u ? { url: u, opacity: p.bgImage?.opacity ?? 100 } : null }))}
            onFrame={(f) => setPage((p) => (p.bgImage ? { ...p, bgImage: { ...p.bgImage, frame: f ?? undefined } } : p), 'bgframe')} />
          {page.bgImage && (
            <Slider label="Opacité de la photo" value={page.bgImage.opacity} min={0} max={100} unit=" %"
              onChange={(v) => setPage((p) => (p.bgImage ? { ...p, bgImage: { ...p.bgImage, opacity: v } } : p), 'bgop')} />
          )}
          <button type="button" className="text-sm font-medium text-primary hover:text-primary-dark"
            onClick={() => set((d) => ({ pages: d.pages.map((p) => ({ ...p, bg: page.bg })) }))}>
            Mettre cette couleur de fond sur toutes les pages
          </button>
          {page.form && <p className="text-xs text-gray-500">La dernière page porte le formulaire de demande : déplacez-le, redimensionnez-le, habillez la page autour.</p>}
        </div>
      );
    }
    const el = selected;
    const up = (patch: Partial<StudioElement>, key?: string) => update(el.id, patch, key);
    return (
      <div className="space-y-3">
        <PositionGroup el={el} measuredH={heightOf(el)} onChange={(p) => up(p, `pos-${el.id}`)} />
        {el.type === 'text' && (
          <Group title="Texte">
            <ColorField label="Couleur du texte" value={el.color} onChange={(c) => up({ color: c ?? '#1c2621' })} />
            <ColorField label="Fond du texte" value={el.bg} nullable onChange={(c) => up({ bg: c })} />
            <Slider label="Espacement des lettres" value={el.letterSpacing} min={-0.05} max={0.5} step={0.01} unit=" em" onChange={(v) => up({ letterSpacing: v }, `ls-${el.id}`)} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Marge intérieure" value={el.padding} min={0} max={20} scale={2.1} suffix="mm" onChange={(v) => up({ padding: v }, `pad-${el.id}`)} />
              <NumberField label="Arrondi" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />
            </div>
          </Group>
        )}
        {el.type === 'image' && (
          <>
            <PhotoGroup url={el.url} frame={el.frame} ratio={(el.h / el.w) * 100} onUrl={(u) => up({ url: u, frame: undefined })} onFrame={(f) => up({ frame: f ?? undefined }, `frame-${el.id}`)} />
            <Group title="Bordure">
              <NumberField label="Arrondi des coins" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />
              <ColorField label="Couleur de la bordure" value={el.borderColor} nullable onChange={(c) => up({ borderColor: c, borderWidth: c && !el.borderWidth ? 0.6 : el.borderWidth })} />
              {el.borderColor && <Slider label="Épaisseur" value={el.borderWidth} min={0} max={5} step={0.1} onChange={(v) => up({ borderWidth: v }, `bw-${el.id}`)} />}
            </Group>
          </>
        )}
        {el.type === 'shape' && (
          <Group title="Forme">
            <Segmented label="Forme" value={el.shape} onChange={(shape) => up({ shape })} options={[['rect', 'Rectangle'], ['ellipse', 'Cercle'], ['line', 'Ligne']]} />
            {el.shape !== 'line' && <ColorField label="Remplissage" value={el.fill} nullable onChange={(c) => up({ fill: c })} />}
            <ColorField label={el.shape === 'line' ? 'Couleur' : 'Contour'} value={el.stroke} nullable={el.shape !== 'line'}
              onChange={(c) => up({ stroke: c, strokeWidth: c && !el.strokeWidth ? 0.4 : el.strokeWidth })} />
            {(el.stroke || el.shape === 'line') && <Slider label="Épaisseur" value={el.strokeWidth} min={0} max={10} step={0.1} onChange={(v) => up({ strokeWidth: v }, `sw-${el.id}`)} />}
            {el.shape === 'rect' && <NumberField label="Arrondi des coins" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />}
          </Group>
        )}
        {el.type === 'prestation' && (() => {
          const p = byId.get(el.prestationId);
          return (
            <>
              <Group title="Prestation">
                <select aria-label="Prestation du catalogue" value={p ? el.prestationId : ''} onChange={(e) => up({ prestationId: e.target.value, html: undefined, titled: undefined, photoUrl: undefined })}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm">
                  {!p && <option value="">Supprimée du catalogue</option>}
                  {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(['name', 'text', 'price'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={el.show[k]} onChange={(e) => up({ show: { ...el.show, [k]: e.target.checked } })} />
                      {{ name: 'Nom', text: 'Texte', price: 'Prix' }[k]}
                    </label>
                  ))}
                </div>
                <Segmented label="Texte" value={el.text} onChange={(text) => up({ text })} options={[['short', 'Court'], ['full', 'Complet']]} />
                {p && <button type="button" onClick={() => setRetouch(el.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark"><Pencil className="h-4 w-4" /> Retoucher le texte pour cette brochure</button>}
                {overflow.has(el.id) && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">Le texte dépasse du cadre : agrandissez l’élément, passez en texte court ou réduisez la taille.</p>}
              </Group>
              <Group title="Photo de la prestation">
                <Segmented label="Place" value={el.photo} onChange={(photo) => up({ photo })} options={[['top', 'En haut'], ['left', 'À gauche'], ['right', 'À droite'], ['none', 'Aucune']]} />
                {el.photo !== 'none' && <Slider label="Taille" value={el.photoSize} min={20} max={80} unit=" %" onChange={(v) => up({ photoSize: v }, `ps-${el.id}`)} />}
                {el.photo !== 'none' && (
                  <PhotoGroup title="Photo" url={el.photoUrl ?? p?.photo_url ?? null} frame={el.frame} ratio={el.photo === 'top' ? (el.h * el.photoSize) / el.w : (el.h / (el.w * el.photoSize / 100)) * 100}
                    onUrl={(u) => up({ photoUrl: u ?? undefined, frame: undefined })} onFrame={(f) => up({ frame: f ?? undefined }, `frame-${el.id}`)} />
                )}
              </Group>
              <Group title="Allure">
                <FontSelect value={el.font} onChange={(font) => up({ font })} />
                <NumberField label="Taille du texte" value={el.size} min={1} max={12} scale={PT} suffix="pt" onChange={(v) => up({ size: v }, `size-${el.id}`)} />
                <Segmented label="Alignement" value={el.align} onChange={(align) => up({ align })} options={[['left', <AlignLeft key="l" className="h-4 w-4" />, 'À gauche'], ['center', <AlignCenter key="c" className="h-4 w-4" />, 'Centré'], ['right', <AlignRight key="r" className="h-4 w-4" />, 'À droite']]} />
                <ColorField label="Couleur du texte" value={el.color} onChange={(c) => up({ color: c ?? '#1c2621' })} />
                <ColorField label="Couleur du prix" value={el.accent} onChange={(c) => up({ accent: c ?? '#b4502d' })} />
                <ColorField label="Fond" value={el.bg} nullable onChange={(c) => up({ bg: c, padding: c && !el.padding ? 3 : el.padding })} />
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Marge intérieure" value={el.padding} min={0} max={20} scale={2.1} suffix="mm" onChange={(v) => up({ padding: v }, `pad-${el.id}`)} />
                  <NumberField label="Arrondi" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />
                </div>
              </Group>
            </>
          );
        })()}
        {el.type === 'form' && (
          <Group title="Formulaire de demande">
            <p className="text-xs text-gray-500">Le lecteur remplit ce formulaire sur le lien ; sur téléphone, il s’ouvre en plein écran.</p>
            <ColorField label="Fond" value={el.bg} nullable onChange={(c) => up({ bg: c })} />
            <ColorField label="Couleur du texte" value={el.color} onChange={(c) => up({ color: c ?? '#1c2621' })} />
            <ColorField label="Couleur du bouton" value={el.accent} onChange={(c) => up({ accent: c ?? '#b4502d' })} />
            <NumberField label="Arrondi" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />
          </Group>
        )}
      </div>
    );
  })();

  const addPanel = (
    <AddPanel tab={addTab} onTab={setAddTab} onTemplate={addTemplate} onText={addText} onPhoto={addPhoto} onShape={addShape} onPrestation={addPrestation}
      catalog={catalog} used={used} templateContext={templateContext} resolve={resolvePage} language={settings.language} />
  );

  // ── La page éditée ─────────────────────────────────────────────────────────
  const selBox = selected && (() => {
    const h = heightOf(selected);
    const handles = selected.locked ? [] : selected.type === 'text' ? (['nw', 'ne', 'se', 'sw', 'e', 'w'] as Handle[]) : HANDLES;
    const pos = (hd: Handle) => ({
      left: hd.includes('w') ? '0%' : hd.includes('e') ? '100%' : '50%',
      top: hd.includes('n') ? '0%' : hd.includes('s') ? '100%' : '50%',
    });
    return (
      <div aria-hidden className="pointer-events-none absolute" style={{
        left: selected.x * unit, top: selected.y * unit, width: selected.w * unit, height: h * unit,
        transform: selected.rot ? `rotate(${selected.rot}deg)` : undefined, outline: '2px solid #B4502D', outlineOffset: 1,
      }}>
        {handles.map((hd) => (
          <span key={hd} className="pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ ...pos(hd), cursor: CURSOR[hd], touchAction: 'none' }} onPointerDown={(e) => gesture(e, selected, hd)}>
            <span className={cn('block border-2 border-[#B4502D] bg-white shadow', hd.length === 2 ? 'h-3 w-3 rounded-full' : 'h-3 w-1.5 rounded-sm', (hd === 'n' || hd === 's') && 'h-1.5 w-3')} />
          </span>
        ))}
        {!selected.locked && (
          <span className="pointer-events-auto absolute left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center" style={{ top: '100%', marginTop: 10, cursor: 'grab', touchAction: 'none' }}
            onPointerDown={(e) => gesture(e, selected, 'rotate')} title="Faire pivoter">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#B4502D] bg-white text-[11px] leading-none text-[#B4502D] shadow">↻</span>
          </span>
        )}
        {selected.locked && <Lock className="absolute -right-2 -top-2 h-4 w-4 rounded bg-white p-0.5 text-[#B4502D] shadow" />}
      </div>
    );
  })();

  const canvas = (
    <div ref={wrap} className="flex min-w-0 justify-center rounded-2xl bg-[#E9E4DB] px-1 py-5 md:px-6"
      onPointerDown={() => { stopEditing(); setSel(null); }}>
      {fontsHref && (
        // eslint-disable-next-line @next/next/no-css-tags
        <link rel="stylesheet" href={fontsHref} />
      )}
      <style>{`${STUDIO_CSS}
        .wb-studio-canvas [data-el]:hover { outline: 1px solid rgba(180,80,45,.45); outline-offset: 1px; }
        .wb-studio-canvas [data-el][data-selected] { outline: none; }`}</style>
      <div ref={pageRef} className="wb-studio-canvas relative flex-none shadow-[0_10px_30px_rgba(0,0,0,.18)]"
        style={{ width: W, height: W * RATIO, containerType: 'inline-size' }}
        onPointerDown={(e) => { e.stopPropagation(); stopEditing(); setSel(null); }}>
        <div className="absolute inset-0 overflow-hidden">
          <PageBackground page={rpage} />
          {page.els.map((el) => {
            const r = rById.get(el.id) as ResolvedStudioElement | undefined;
            if (!r) return null;
            const isEditing = editing?.id === el.id && el.type === 'text';
            return (
              <div key={el.id} data-el={el.id} data-el-type={el.type} {...(sel === el.id ? { 'data-selected': '' } : {})}
                style={{ ...elementBox(r), touchAction: isEditing ? 'auto' : 'none', cursor: isEditing ? 'text' : el.locked ? 'default' : 'move' }}
                onPointerDown={(e) => {
                  if (isEditing) { e.stopPropagation(); return; }
                  if (editing) stopEditing();
                  setSel(el.id);
                  gesture(e, el, 'move');
                }}
                onDoubleClick={(e) => { if (el.type === 'text' && !el.locked) { setSel(el.id); setEditing({ id: el.id, caret: { x: e.clientX, y: e.clientY } }); } }}>
                {isEditing
                  ? <TextEditing el={el} caret={editing!.caret} onDone={stopEditing} onInput={(html) => update(el.id, { html }, `text-${el.id}`)} />
                  : <ElementContent el={r} editor language={settings.language} />}
                {overflow.has(el.id) && <span aria-hidden className="absolute bottom-1 right-1 rounded bg-amber-500 px-1 text-[10px] font-semibold text-white">Texte coupé</span>}
              </div>
            );
          })}
        </div>
        {guides && <>
          {guides.gx.map((x) => <span key={`x${x}`} aria-hidden className="pointer-events-none absolute top-0 h-full w-px bg-fuchsia-500" style={{ left: x * unit }} />)}
          {guides.gy.map((y) => <span key={`y${y}`} aria-hidden className="pointer-events-none absolute left-0 h-px w-full bg-fuchsia-500" style={{ top: y * unit }} />)}
        </>}
        {selBox}
      </div>
    </div>
  );

  const strip = (
    <PagesStrip pages={doc.pages} resolved={resolved} current={pageIndex} language={settings.language} onSelect={selectPage}
      onAdd={() => insertPage(blankPage(page.bg))} onDuplicate={() => insertPage(clonePage(page))} onDelete={deletePage} onMove={movePage} />
  );

  const retouched = retouch ? page.els.find((e) => e.id === retouch) : null;
  const retouchedPrestation = retouched?.type === 'prestation' ? byId.get(retouched.prestationId) : undefined;

  return (
    <div className="space-y-3" role="region" aria-label="Studio">
      {toolbar}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        <aside className="hidden max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 lg:sticky lg:top-14 lg:block" aria-label="Ajouter">
          {addPanel}
        </aside>
        <div className="min-w-0 space-y-3">
          {canvas}
          {strip}
          {/* Téléphone et tablette : ajouter et réglages sous la page. */}
          <div className="xl:hidden">
            <div className="mb-2 inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-sm" role="tablist">
              {([['add', 'Ajouter'], ['settings', selected ? 'Réglages de l’élément' : 'Fond de la page']] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={panel === k} onClick={() => setPanel(k)}
                  className={cn('rounded-lg px-3 py-1.5 font-medium', k === 'add' && 'lg:hidden', panel === k ? 'bg-primary text-white' : 'text-gray-600')}>
                  {label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              {panel === 'add' ? <><div className="lg:hidden">{addPanel}</div><div className="hidden lg:block">{inspector}</div></> : inspector}
            </div>
          </div>
        </div>
        <aside className="hidden max-h-[calc(100vh-140px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 xl:sticky xl:top-14 xl:block" aria-label="Réglages">
          {inspector}
        </aside>
      </div>
      {retouched?.type === 'prestation' && retouchedPrestation && (
        <ItemRetouch photo={false} language={settings.language} prestation={retouchedPrestation} onClose={() => setRetouch(null)}
          item={{ prestationId: retouched.prestationId, ...(retouched.html ? { html: retouched.html } : {}), ...(retouched.titled ? { titled: true } : {}), ...(retouched.hidePrice ? { hidePrice: true } : {}) }}
          onSave={(item) => { update(retouched.id, { html: item.html ?? undefined, titled: item.titled, hidePrice: item.hidePrice }); setRetouch(null); }} />
      )}
    </div>
  );
}
