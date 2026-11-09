'use client';

// Le Studio : composer chaque page de la brochure librement, comme une affiche (à la Canva), avec la mise en forme
// du texte d'un traitement de texte (à la WeboWord).
// - Panneau « Ajouter » : brochures complètes et modèles de pages, textes (reliés aux styles de la brochure),
//   photos et logo, formes, décorations et pictogrammes, prestations du catalogue. Un clic pose au centre ; sur
//   ordinateur, on peut aussi glisser sur la page (une photo lâchée sur une photo la remplace).
// - La page : glisser pour déplacer (repères magnétiques ; grille et règles au besoin), poignées pour redimensionner
//   et faire pivoter, Maj+clic ou cadre de sélection pour en prendre plusieurs, groupes, zoom. Double-clic (ou
//   « Écrire ») pour écrire dans un texte, directement sur la page.
// - Barre du haut : style du texte (Titre 1, Paragraphe…), police, taille, gras, couleur, alignement, listes, lien,
//   Webo (corriger, reformuler…) ; aligner, répartir, grouper, calques, verrou, dupliquer, supprimer ; annuler.
// - Panneau « Réglages » : l'élément choisi, ou la page (fond), le thème et les styles, les options du lien.
// Raccourcis : Suppr, flèches (Maj : plus loin), Ctrl+Z / Ctrl+Y, Ctrl+D, Ctrl+C / Ctrl+V, Ctrl+A, Ctrl+G
// (Maj : dégrouper), Échap.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceAround, AlignJustify, AlignLeft,
  AlignRight, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceAround, ArrowDownToLine, ArrowUpToLine, Bold, BringToFront, CaseUpper, Copy,
  BoxSelect, Grid3x3, Group as GroupIcon, Italic, Link2, Link2Off, List, ListOrdered, Loader2, Lock, LockOpen, Minus, Pencil, Plus, Redo2, RemoveFormatting,
  SendToBack, Sparkles, Trash2, Underline, Undo2, Ungroup, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedback } from '@/components/ui/Feedback';
import { sanitizeHtml } from '@/lib/sanitize';
import type { BrochureCover, CatalogPrestation } from '@/lib/brochure';
import {
  DEFAULT_OPTIONS, PAGE_H, PAGE_TEMPLATES, ROLE_LABELS, STUDIO_FONTS, STUDIO_ICONS, TEXT_ROLES, THEMES, applyRoleStyles, applyTheme, blankPage,
  brochureFromKind, cloneElement, clonePage, parseStudio, iconEl, imageEl, logoEl, prestationEl, qrEl, resolveStudio, shapeEl, studioFontsHref, textEl, videoEl,
  type BrochureKind, type ResolvedStudioElement, type StudioDoc, type StudioElement, type StudioPage, type StudioText, type StudioTheme,
  type TemplateContext, type TextRole,
} from '@/lib/brochureStudio';
import { designCoverWithWebo, rewriteWithWebo } from '@/server/weboRewrite';
import ItemRetouch from '../ItemRetouch';
import type { BrochureCompany } from '../BrochurePages';
import { ElementContent, PageBackground, STUDIO_CSS, elementBox, textStyle } from './StudioPage';
import {
  AddPanel, ColorField, DRAG_TYPE, FontSelect, Group, NumberField, OptionsPanel, PagesStrip, PhotoGroup, PositionGroup, Segmented, Slider,
  TEXT_PRESETS, ThemeColors, ThemePanel,
  type AddItem, type AddTab,
} from './StudioPanels';
import { ICONS } from './icons';
import { stableJson, useHistory } from './useHistory';

const RATIO = PAGE_H / 100;
/** Une taille de texte (centièmes de page) en points, comme dans un traitement de texte (A4 : 595 pt de large). */
const PT = 5.95;
/** Pas de la grille : 5 mm. */
const GRID = 5 / 2.1;
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const round = (n: number) => Math.round(n * 10) / 10;
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
const newGroupId = () => `g${Math.random().toString(36).slice(2, 10)}`;
type Box = { x: number; y: number; w: number; h: number };
const bounds = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
};

/** Libellés des réécritures par Webo (la liste complète vit côté serveur). */
const REWRITES: [string, string][] = [
  ['fix', 'Corriger l’orthographe'], ['rephrase', 'Reformuler'], ['shorten', 'Raccourcir'], ['warmer', 'Plus chaleureux'],
  ['elegant', 'Plus élégant'], ['english', 'Traduire en anglais'],
];

/** Repères d'alignement : bords et milieux de la page et des autres éléments. */
function snap(box: Box, others: Box[], thr: number) {
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

/** Une adresse saisie : site, email ou téléphone. */
function linkHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^\+?[\d\s.()-]{6,}$/.test(v)) return `tel:${v.replace(/[^\d+]/g, '')}`;
  return `https://${v}`;
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
      aria-multiline="true" aria-label="Texte" spellCheck lang="fr" dangerouslySetInnerHTML={initial}
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

/** Règle graduée en millimètres (tous les 10 mm, chiffres tous les 50 mm). */
function Ruler({ length, unit, vertical }: { length: number; unit: number; vertical?: boolean }) {
  const step = (10 / 2.1) * unit;
  const marks = Array.from({ length: Math.floor((length / unit) * 2.1 / 50) + 1 }, (_, i) => i * 50);
  return (
    <div aria-hidden className="pointer-events-none absolute bg-white/80 text-[9px] text-gray-500" style={vertical
      ? { left: -18, top: 0, width: 16, height: length, backgroundImage: `repeating-linear-gradient(to bottom, #9ca3af 0 1px, transparent 1px ${step}px)`, backgroundSize: '5px 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'right' }
      : { top: -18, left: 0, height: 16, width: length, backgroundImage: `repeating-linear-gradient(to right, #9ca3af 0 1px, transparent 1px ${step}px)`, backgroundSize: '100% 5px', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom' }}>
      {marks.map((mm) => (
        <span key={mm} className="absolute" style={vertical ? { top: (mm / 2.1) * unit + 1, left: 1 } : { left: (mm / 2.1) * unit + 2, top: 0 }}>{mm}</span>
      ))}
    </div>
  );
}

export interface StudioSettings {
  language: 'fr' | 'en';
  /** Adresse du lien principal de la brochure (QR codes). */
  shareUrl?: string | null;
  cover: BrochureCover;
  prices: { show: boolean; mode: 'ht' | 'ttc'; vatRate: number };
}

/** Forme comparable d'un document (relu comme le serveur le relit). */
const canonStudio = (d: StudioDoc) => stableJson(parseStudio(JSON.parse(JSON.stringify(d))));

export default function StudioEditor({ initial, onChange, catalog, company, settings, historyKey, onPageChange }: {
  /** La page affichée change (commentaires sur la page en cours). */
  onPageChange?: (pageId: string) => void;
  /** Clé de l'historique gardé dans le navigateur (une par brochure). */
  historyKey?: string;
  initial: StudioDoc;
  onChange: (doc: StudioDoc) => void;
  catalog: CatalogPrestation[];
  company: BrochureCompany;
  settings: StudioSettings;
}) {
  const { confirm, notify } = useFeedback();
  // Historique gardé dans ce navigateur, par brochure : il survit au rechargement de la page.
  const { doc, set, undo, redo, canUndo, canRedo } = useHistory(initial, historyKey, canonStudio);
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; caret: { x: number; y: number } | 'all' | null } | null>(null);
  const [addTab, setAddTab] = useState<AddTab>('templates');
  const [panel, setPanel] = useState<'add' | 'settings'>('add');
  const [docTab, setDocTab] = useState<'page' | 'theme' | 'link'>('page');
  const [guides, setGuides] = useState<{ gx: number[]; gy: number[] } | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [overflow, setOverflow] = useState<Set<string>>(new Set());
  const [retouch, setRetouch] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [weboOpen, setWeboOpen] = useState(false);
  const [weboBusy, setWeboBusy] = useState(false);
  /** « Choisir plusieurs » : chaque toucher ajoute ou retire un élément (comme Maj+clic, utile au doigt). */
  const [multi, setMulti] = useState(false);
  const [templatesVersion, setTemplatesVersion] = useState(0);
  /** Le menu Webo a été ouvert avec un passage sélectionné : seul ce passage sera réécrit. */
  const [weboPart, setWeboPart] = useState(false);
  const clipboard = useRef<StudioElement[]>([]);
  const savedRange = useRef<Range | null>(null);

  // Le document part vers l'enregistrement automatique à chaque changement.
  const first = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => { if (first.current) { first.current = false; return; } onChangeRef.current(doc); }, [doc]);

  const pageIndex = Math.min(pi, doc.pages.length - 1);
  const page = doc.pages[pageIndex];
  useEffect(() => { onPageChange?.(page.id); }, [page.id, onPageChange]);
  const theme: StudioTheme = doc.theme ?? THEMES[0];
  const options = doc.options ?? DEFAULT_OPTIONS;
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const priceOpts = useMemo(() => ({ ...settings.prices, language: settings.language, forEditor: true, brochureUrl: settings.shareUrl ?? null }), [settings.prices, settings.language, settings.shareUrl]);
  const resolved = useMemo(() => resolveStudio(doc, byId, priceOpts), [doc, byId, priceOpts]);
  const resolvePage = useCallback((p: StudioPage) => resolveStudio({ pages: [p] }, byId, priceOpts)[0], [byId, priceOpts]);
  const rpage = resolved[pageIndex];
  const rById = useMemo(() => new Map(rpage.els.map((e) => [e.id, e])), [rpage]);
  const selEls = page.els.filter((e) => sel.includes(e.id));
  const selected = selEls.length === 1 ? selEls[0] : null;
  const used = useMemo(() => new Set(doc.pages.flatMap((p) => p.els.flatMap((e) => (e.type === 'prestation' ? [e.prestationId] : [])))), [doc]);
  const themeColors = useMemo(() => [...new Set([theme.bg, theme.accent, theme.styles.h1.color, theme.styles.body.color])], [theme]);

  // Toutes les polices du Studio chargées une fois (listes et aperçus), comme sur le lien public pour celles utilisées.
  const fontsHref = useMemo(() => studioFontsHref(STUDIO_FONTS), []);

  // ── Changements ────────────────────────────────────────────────────────────
  const setPage = useCallback((fn: (p: StudioPage) => StudioPage, merge?: string) => {
    set((d) => ({ ...d, pages: d.pages.map((p, i) => (i === pageIndex ? fn(p) : p)) }), merge);
  }, [set, pageIndex]);
  const update = useCallback((id: string, patch: Partial<StudioElement>, merge?: string) => {
    setPage((p) => ({ ...p, els: p.els.map((e) => (e.id === id ? { ...e, ...patch } as StudioElement : e)) }), merge);
  }, [setPage]);
  const updateMany = (fn: (e: StudioElement) => Partial<StudioElement> | null, merge?: string) =>
    setPage((p) => ({ ...p, els: p.els.map((e) => { const patch = fn(e); return patch ? { ...e, ...patch } as StudioElement : e; }) }), merge);
  /** Mise en forme d'un texte à la main : il se détache du style de la brochure. */
  const upText = (id: string, patch: Partial<StudioText>, merge?: string) => update(id, { ...patch, role: undefined } as Partial<StudioElement>, merge);
  const add = (els: StudioElement[], edit = false) => {
    setPage((p) => ({ ...p, els: [...p.els, ...els] }));
    setSel(els.map((e) => e.id));
    setEditing(edit && els.length === 1 ? { id: els[0].id, caret: 'all' } : null);
  };
  const removeSel = () => {
    const ids = new Set(selEls.filter((e) => e.type !== 'form' && !e.locked).map((e) => e.id));
    if (!ids.size) return;
    setPage((p) => ({ ...p, els: p.els.filter((e) => !ids.has(e.id)) }));
    setSel([]); setEditing(null);
  };
  /** Copies des éléments, décalées, groupes refaits entre les copies. */
  const copies = (els: StudioElement[], dx = 3) => {
    const groups = new Map<string, string>();
    return els.filter((e) => e.type !== 'form').map((e) => {
      const g = e.group ? (groups.get(e.group) ?? groups.set(e.group, newGroupId()).get(e.group)) : undefined;
      return { ...cloneElement(e), x: round(e.x + dx), y: round(e.y + dx), locked: undefined, group: g };
    });
  };
  const duplicateSel = () => { const c = copies(selEls); if (c.length) add(c); };
  const layerSel = (to: 'up' | 'down' | 'front' | 'back') => setPage((p) => {
    const ids = new Set(sel);
    if (to === 'front' || to === 'back') {
      const moving = p.els.filter((e) => ids.has(e.id));
      const rest = p.els.filter((e) => !ids.has(e.id));
      return { ...p, els: to === 'front' ? [...rest, ...moving] : [...moving, ...rest] };
    }
    const els = [...p.els];
    const order = to === 'up' ? [...els.keys()].reverse() : [...els.keys()];
    for (const i of order) {
      if (!ids.has(els[i].id)) continue;
      const j = i + (to === 'up' ? 1 : -1);
      if (j < 0 || j >= els.length || ids.has(els[j].id)) continue;
      [els[i], els[j]] = [els[j], els[i]];
    }
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
  const groupIds = (el: StudioElement) => (el.group ? page.els.filter((e) => e.group === el.group).map((e) => e.id) : [el.id]);

  // ── Aligner, répartir, grouper ─────────────────────────────────────────────
  const boxOf = (e: StudioElement): Box => ({ x: e.x, y: e.y, w: e.w, h: e.type === 'text' ? heights[e.id] ?? e.h : e.h });
  const heightOf = (e: StudioElement) => boxOf(e).h;
  const alignSel = (how: 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom') => {
    const movable = selEls.filter((e) => !e.locked);
    if (movable.length < 2) return;
    const b = bounds(movable.map(boxOf));
    const ids = new Set(movable.map((e) => e.id));
    updateMany((e) => {
      if (!ids.has(e.id)) return null;
      const h = heightOf(e);
      switch (how) {
        case 'left': return { x: round(b.x) };
        case 'hcenter': return { x: round(b.x + (b.w - e.w) / 2) };
        case 'right': return { x: round(b.x + b.w - e.w) };
        case 'top': return { y: round(b.y) };
        case 'vmiddle': return { y: round(b.y + (b.h - h) / 2) };
        default: return { y: round(b.y + b.h - h) };
      }
    });
  };
  const distributeSel = (axis: 'x' | 'y') => {
    const movable = selEls.filter((e) => !e.locked);
    if (movable.length < 3) return;
    const size = (e: StudioElement) => (axis === 'x' ? e.w : heightOf(e));
    const sorted = [...movable].sort((a, b) => a[axis] - b[axis]);
    const start = sorted[0][axis];
    const end = sorted[sorted.length - 1][axis] + size(sorted[sorted.length - 1]);
    const gap = (end - start - sorted.reduce((t, e) => t + size(e), 0)) / (sorted.length - 1);
    const at = new Map<string, number>();
    let cur = start;
    for (const e of sorted) { at.set(e.id, round(cur)); cur += size(e) + gap; }
    updateMany((e) => (at.has(e.id) ? { [axis]: at.get(e.id)! } : null));
  };
  const groupSel = () => {
    if (selEls.length < 2) return;
    const g = newGroupId();
    const ids = new Set(sel);
    updateMany((e) => (ids.has(e.id) ? { group: g } : null));
  };
  const ungroupSel = () => {
    const ids = new Set(sel);
    updateMany((e) => (ids.has(e.id) && e.group ? { group: undefined } : null));
  };
  const selGrouped = selEls.length > 1 && selEls.every((e) => e.group && e.group === selEls[0].group);

  // ── Pages ──────────────────────────────────────────────────────────────────
  const insertPage = (p: StudioPage) => {
    const at = Math.min(pageIndex + 1, doc.pages.length - 1);
    set((d) => ({ ...d, pages: [...d.pages.slice(0, at), p, ...d.pages.slice(at)] }));
    setPi(at); setSel([]); setEditing(null);
  };
  const templateContext: TemplateContext = useMemo(() => ({
    title: settings.cover.title, subtitle: settings.cover.subtitle ?? null, photoUrl: settings.cover.photoUrl ?? null, photoFrame: settings.cover.photoFrame ?? null,
    company: { name: company.name, address: company.address, phone: company.phone, email: company.email, website: company.website, logoUrl: company.logoUrl },
    language: settings.language,
  }), [settings.cover, settings.language, company]);
  const orderedIds = () => [...catalog.filter((p) => !used.has(p.id)), ...catalog.filter((p) => used.has(p.id))].map((p) => p.id);
  const addTemplate = (id: string) => {
    const t = PAGE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    // La nouvelle page prend le thème de la brochure, s'il y en a un.
    const made = t.make(templateContext, orderedIds());
    insertPage(doc.theme ? applyTheme({ pages: [made] }, doc.theme).pages[0] : made);
  };
  const addKind = async (kind: BrochureKind) => {
    if (!(await confirm({
      title: 'Remplacer toutes les pages ?',
      message: 'La brochure est recomposée avec ce modèle, ses textes types et vos prestations. « Annuler » (Ctrl+Z) revient à vos pages.',
      confirmLabel: 'Remplacer',
    }))) return;
    const ids = used.size ? [...used] : catalog.map((p) => p.id);
    set((d) => ({ ...brochureFromKind(kind, templateContext, ids), options: d.options }));
    setPi(0); setSel([]); setEditing(null);
  };
  /** Webo propose une couverture : elle s'ajoute en première page, avec son thème. */
  const weboCover = async (description: string): Promise<string | null> => {
    const res = await designCoverWithWebo({ description, language: settings.language, requestId: crypto.randomUUID() })
      .catch(() => ({ error: 'Webo n’a pas répondu. Vérifiez votre connexion.' }));
    if ('error' in res) return res.error;
    const t = PAGE_TEMPLATES.find((x) => x.id === res.templateId) ?? PAGE_TEMPLATES[0];
    const theme = THEMES.find((x) => x.name === res.themeName);
    const made = t.make({ ...templateContext, title: res.title, subtitle: res.subtitle || null, photoUrl: res.photoUrl ?? templateContext.photoUrl, photoFrame: null }, []);
    const cover = theme ? applyTheme({ pages: [made] }, theme).pages[0] : made;
    set((d) => ({ ...d, pages: [cover, ...d.pages] }));
    setPi(0); setSel([]); setEditing(null);
    notify('Couverture proposée par Webo (1 WeboCoin), ajoutée en première page.', { tone: 'success' });
    return null;
  };
  const deletePage = async () => {
    if (page.form) return;
    if (page.els.length && !(await confirm({ title: `Supprimer la page ${pageIndex + 1} ?`, message: 'Ses éléments seront retirés. « Annuler » (Ctrl+Z) la fait revenir.', confirmLabel: 'Supprimer', danger: true }))) return;
    set((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pageIndex) }));
    setPi(Math.max(0, pageIndex - 1)); setSel([]); setEditing(null);
  };
  const movePage = (dir: -1 | 1) => {
    const j = pageIndex + dir;
    if (page.form || j < 0 || j >= doc.pages.length - 1) return;
    set((d) => {
      const pages = [...d.pages];
      [pages[pageIndex], pages[j]] = [pages[j], pages[pageIndex]];
      return { ...d, pages };
    });
    setPi(j);
  };

  // ── Ajouts (panneau : clic au centre, ou glissé sur la page) ───────────────
  const roleStyle = (role: TextRole): Partial<StudioText> => ({ ...theme.styles[role], role });
  /** Place un ensemble d'éléments centré sur `at` (ou au centre de la page). */
  const placed = (els: StudioElement[], at?: { x: number; y: number }) => {
    if (!at) return els;
    const b = bounds(els.map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })));
    const dx = at.x - (b.x + b.w / 2);
    const dy = at.y - (b.y + b.h / 2);
    return els.map((e) => ({ ...e, x: round(e.x + dx), y: round(e.y + dy) }));
  };
  const addItem = (item: AddItem, at?: { x: number; y: number }, onto?: StudioElement | null) => {
    const accent = theme.accent;
    switch (item.kind) {
      case 'text': {
        const p = TEXT_PRESETS.find((x) => x.id === item.preset)!;
        const w = item.preset === 'body' ? 70 : 80;
        const extra = 'role' in p ? roleStyle(p.role as TextRole) : p.style;
        add(placed([textEl({ x: (100 - w) / 2, y: PAGE_H / 2 - 8, w, h: 8, html: `<p>${p.sample}</p>`, ...p.style, ...extra })], at), true);
        return;
      }
      case 'combo': {
        const g = newGroupId();
        const els: StudioElement[] = item.combo === 'kicker-title' ? [
          textEl({ x: 15, y: 50, w: 70, h: 4, html: '<p>Sur-titre</p>', align: 'center', ...roleStyle('kicker'), group: g }),
          textEl({ x: 10, y: 56, w: 80, h: 12, html: '<p>Votre titre</p>', align: 'center', ...roleStyle('h1'), group: g }),
          shapeEl({ x: 45, y: 72, w: 10, h: 1, shape: 'line', stroke: accent, strokeWidth: 0.3, fill: null, group: g }),
        ] : item.combo === 'title-sub' ? [
          textEl({ x: 10, y: 52, w: 80, h: 12, html: '<p>Votre titre</p>', ...roleStyle('h1'), group: g }),
          textEl({ x: 10, y: 66, w: 80, h: 7, html: '<p>Un sous-titre qui donne envie</p>', ...roleStyle('h2'), group: g }),
        ] : [
          shapeEl({ x: 35, y: 64, w: 30, h: 10, fill: accent, radius: 5, group: g }),
          textEl({ x: 35, y: 66.6, w: 30, h: 5, html: '<p>76 € / pers.</p>', font: 'Montserrat', size: 3.4, color: '#ffffff', align: 'center', group: g }),
        ];
        add(placed(els, at));
        return;
      }
      case 'photo': {
        const target = onto?.type === 'image' ? onto : !at && selected?.type === 'image' ? selected : null;
        if (target) { update(target.id, { url: item.url, frame: undefined }); setSel([target.id]); return; }
        const img = new Image();
        const put = (ratio: number) => {
          let w = 60;
          let h = w * ratio;
          if (h > PAGE_H * 0.7) { h = PAGE_H * 0.7; w = h / ratio; }
          add(placed([imageEl({ x: round((100 - w) / 2), y: round((PAGE_H - h) / 2), w: round(w), h: round(h), url: item.url })], at));
        };
        img.onload = () => put(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.75);
        img.onerror = () => put(0.75);
        img.src = item.url;
        return;
      }
      case 'logo':
        if (company.logoUrl) add(placed([logoEl(company.logoUrl, 10, 30, 16)], at));
        return;
      case 'shape': {
        const s = item.shape;
        const el = s === 'line' ? shapeEl({ x: 30, y: PAGE_H / 2, w: 40, h: 2, shape: 'line', fill: null, stroke: accent, strokeWidth: 0.3 })
          : s === 'frame' ? shapeEl({ x: 10, y: 20, w: 80, h: 100, fill: null, stroke: accent, strokeWidth: 0.4 })
            : s === 'arch' ? shapeEl({ x: 30, y: PAGE_H / 2 - 28, w: 40, h: 56, shape: 'arch' })
              : shapeEl({ x: 30, y: PAGE_H / 2 - 20, w: 40, h: 40, shape: s === 'ellipse' ? 'ellipse' : 'rect', radius: s === 'rounded' ? 4 : 0 });
        add(placed([el], at));
        return;
      }
      case 'ornament': {
        const g = newGroupId();
        const y = PAGE_H / 2;
        const line = (x: number, w: number, yy = y, dash: 'solid' | 'dotted' | 'double' = 'solid') => shapeEl({ x, y: yy - 1, w, h: 2, shape: 'line', stroke: accent, strokeWidth: dash === 'double' ? 0.15 : 0.3, fill: null, dash, group: g });
        const els: StudioElement[] = item.ornament === 'line-icon' ? [line(28, 17), iconEl({ x: 47, y: y - 3, w: 6, name: 'Leaf', color: accent, strokeWidth: 1.25, group: g }), line(55, 17)]
          : item.ornament === 'double' ? [line(30, 40, y, 'double')]
            : item.ornament === 'dots' ? [line(30, 40, y, 'dotted')]
              : [
                ...[[6, 6, 0], [84, 6, 90], [84, PAGE_H - 16, 180], [6, PAGE_H - 16, -90]].map(([x, yy, rot]) => iconEl({ x, y: yy, w: 10, name: 'Flower2', color: accent, strokeWidth: 1, rot, group: g, opacity: 70 })),
              ];
        add(item.ornament === 'corners' ? els : placed(els, at));
        return;
      }
      case 'icon':
        add(placed([iconEl({ x: 44, y: PAGE_H / 2 - 6, w: 12, name: item.name, color: accent })], at));
        return;
      case 'video': {
        const target = onto?.type === 'video' ? onto : !at && selected?.type === 'video' ? selected : null;
        if (target) { update(target.id, { url: item.url }); setSel([target.id]); return; }
        add(placed([videoEl({ x: 15, y: PAGE_H / 2 - 20, w: 70, h: 39.4, url: item.url })], at));
        return;
      }
      case 'qr':
        add(placed([qrEl({ x: 38, y: PAGE_H / 2 - 12, w: 24 })], at));
        return;
      case 'prestation':
        add(placed([prestationEl({ x: 8, y: round(PAGE_H / 2 - 22), w: 84, h: 44, prestationId: item.id, photo: 'left', font: theme.styles.body.font, accent })], at));
    }
  };

  // ── La page à l'écran ──────────────────────────────────────────────────────
  const wrap = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [baseW, setBaseW] = useState(420);
  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const measure = () => {
      const cw = node.clientWidth;
      const phone = window.innerWidth < 768;
      setBaseW(Math.floor(Math.max(220, phone ? cw - 8 : Math.min(cw - 64, (window.innerHeight - 200) / RATIO, 700))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const W = Math.round(baseW * zoom);
  const unit = W / 100;

  // Hauteur réelle des textes (elle suit leur contenu) et prestations dont le texte dépasse encore.
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

  /** Agrandit le cadre d'une prestation pour que tout son texte tienne à sa taille normale. */
  const growToFit = (id: string) => {
    const el = page.els.find((e) => e.id === id);
    const inner = pageRef.current?.querySelector<HTMLElement>(`[data-el="${id}"] [data-studio-overflow]`);
    if (!el || el.type !== 'prestation' || !inner) return;
    const before = { height: inner.style.height, fontSize: inner.style.fontSize };
    inner.style.height = 'auto';
    inner.style.fontSize = `${el.size}cqw`;
    const need = inner.offsetHeight / unit;
    inner.style.height = before.height;
    inner.style.fontSize = before.fontSize;
    update(id, { h: round(Math.min(PAGE_H, need + 1)) });
  };

  const pointIn = (clientX: number, clientY: number) => {
    const r = pageRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / unit, y: (clientY - r.top) / unit };
  };

  // ── Gestes : déplacer (un ou plusieurs), redimensionner, faire pivoter ────
  const gesture = (e: React.PointerEvent, el: StudioElement, kind: 'move' | 'rotate' | Handle, ids: string[] = [el.id]) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (kind === 'move' && el.locked && ids.length === 1) return;
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, h: heightOf(el), key: `${kind}-${el.id}-${Date.now()}` };
    const rect = pageRef.current!.getBoundingClientRect();
    const cx = rect.left + (el.x + el.w / 2) * unit;
    const cy = rect.top + (el.y + start.h / 2) * unit;
    const a0 = Math.atan2(e.clientY - cy, e.clientX - cx);
    const moving = page.els.filter((o) => ids.includes(o.id) && !o.locked);
    const origin = new Map(moving.map((o) => [o.id, { x: o.x, y: o.y }]));
    const box0 = moving.length ? bounds(moving.map(boxOf)) : boxOf(el);
    const others = page.els.filter((o) => !ids.includes(o.id) && !o.rot).map(boxOf);
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / unit;
      const dy = (ev.clientY - start.py) / unit;
      if (!moved && Math.hypot(ev.clientX - start.px, ev.clientY - start.py) < 3) return;
      moved = true;
      if (kind === 'move') {
        let nx = box0.x + dx;
        let ny = box0.y + dy;
        if (ev.altKey) setGuides(null);
        else if (showGrid) { nx = Math.round(nx / GRID) * GRID; ny = Math.round(ny / GRID) * GRID; setGuides(null); }
        else { const s = snap({ ...box0, x: nx, y: ny }, others, 6 / unit); nx = s.x; ny = s.y; setGuides({ gx: s.gx, gy: s.gy }); }
        const ddx = nx - box0.x;
        const ddy = ny - box0.y;
        updateMany((o) => { const p = origin.get(o.id); return p ? { x: round(p.x + ddx), y: round(p.y + ddy) } : null; }, start.key);
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
        const keep = el.type === 'text' ? corner : (corner && (el.type === 'image' || el.type === 'icon' || el.type === 'qr') !== ev.shiftKey);
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
        if (el.type === 'text' && corner) Object.assign(patch, { size: Math.min(30, Math.max(1, Math.round(el.size * (nw / el.w) * 100) / 100)), role: undefined });
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

  /**
   * Agrandir ou réduire plusieurs éléments d'un bloc (groupe ou sélection) par un coin : proportions gardées, le
   * coin opposé reste en place ; tailles de texte, traits et marges suivent.
   */
  const scaleGesture = (e: React.PointerEvent, corner: 'nw' | 'ne' | 'se' | 'sw') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const items = selEls.filter((x) => !x.locked);
    if (!items.length) return;
    const b0 = bounds(items.map(boxOf));
    const ax = corner.includes('w') ? b0.x + b0.w : b0.x;
    const ay = corner.includes('n') ? b0.y + b0.h : b0.y;
    const sx = corner.includes('e') ? 1 : -1;
    const sy = corner.includes('s') ? 1 : -1;
    const origin = new Map(items.map((x) => [x.id, x]));
    const start = { px: e.clientX, py: e.clientY, key: `scale-${Date.now()}` };
    const onMove = (ev: PointerEvent) => {
      const dx = ((ev.clientX - start.px) / unit) * sx;
      const dy = ((ev.clientY - start.py) / unit) * sy;
      const k = Math.max(0.1, Math.max((b0.w + dx) / b0.w, (b0.h + dy) / b0.h));
      const sc = (n: number) => Math.round(n * k * 100) / 100;
      updateMany((x) => {
        const o = origin.get(x.id);
        if (!o) return null;
        const patch: Record<string, unknown> = { x: round(ax + (o.x - ax) * k), y: round(ay + (o.y - ay) * k), w: round(o.w * k), h: round(o.h * k) };
        if (o.type === 'text') Object.assign(patch, { size: Math.min(30, Math.max(1, sc(o.size))), padding: sc(o.padding), role: undefined });
        if (o.type === 'prestation') Object.assign(patch, { size: Math.min(12, Math.max(1, sc(o.size))), padding: sc(o.padding) });
        if (o.type === 'shape') patch.strokeWidth = Math.min(10, sc(o.strokeWidth));
        return patch as Partial<StudioElement>;
      }, start.key);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Cadre de sélection, tiré sur le fond de la page. Sans mouvement : tout est désélectionné. */
  const startMarquee = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Pas de sélection de texte de la page pendant qu'on tire le cadre.
    e.preventDefault();
    stopEditing();
    const p0 = pointIn(e.clientX, e.clientY);
    const additive = e.shiftKey;
    const before = additive ? sel : [];
    let box: Box | null = null;
    const onMove = (ev: PointerEvent) => {
      const p = pointIn(ev.clientX, ev.clientY);
      box = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
      setMarquee(box.w * unit > 4 || box.h * unit > 4 ? box : null);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setMarquee(null);
      const b = box;
      if (!b || (b.w * unit <= 4 && b.h * unit <= 4)) { setSel(before); return; }
      const hit = page.els.filter((el) => { const o = boxOf(el); return o.x < b.x + b.w && o.x + o.w > b.x && o.y < b.y + b.h && o.y + o.h > b.y; });
      const ids = new Set([...before, ...hit.flatMap(groupIds)]);
      setSel([...ids]);
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
  const applyLink = () => {
    const href = linkHref(linkValue);
    setLinkOpen(false);
    if (!href) return;
    runText((node) => {
      document.execCommand('createLink', false, href);
      node.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    });
  };
  /** Webo réécrit le passage sélectionné (pendant la saisie) ou, sans sélection, tout le texte. */
  const rewrite = async (mode: string) => {
    setWeboOpen(false);
    if (selected?.type !== 'text' || weboBusy) return;
    const id = selected.id;
    const range = weboPart && savedRange.current ? savedRange.current.cloneRange() : null;
    let html = selected.html;
    if (range) {
      const holder = document.createElement('div');
      holder.append(range.cloneContents());
      html = holder.innerHTML;
    }
    setWeboBusy(true);
    const res = await rewriteWithWebo({ html, mode: mode as never, requestId: crypto.randomUUID() })
      .catch(() => ({ error: 'Webo n’a pas répondu. Vérifiez votre connexion.' }));
    setWeboBusy(false);
    if ('error' in res) { notify(res.error, { tone: 'error' }); return; }
    const node = document.querySelector<HTMLElement>(`[data-editing][data-studio-text="${id}"]`);
    if (range && node && node.contains(range.commonAncestorContainer)) {
      // Le passage est remplacé à sa place ; le reste du texte ne bouge pas.
      node.focus({ preventScroll: true });
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      // Un seul paragraphe renvoyé pour un passage pris dans un paragraphe : sans ses balises <p>.
      const inline = /^<p>((?:(?!<\/?p[ >])[\s\S])*)<\/p>$/.exec(res.html.trim());
      document.execCommand('insertHTML', false, inline && !/<p[ >]/.test(html) ? inline[1] : res.html);
      update(id, { html: node.innerHTML });
    } else {
      setEditing(null);
      update(id, { html: res.html });
    }
    notify(`${range ? 'Passage' : 'Texte'} réécrit par Webo (1 WeboCoin). « Annuler » revient en arrière.`, { tone: 'success' });
  };
  const queryState = (cmd: string) => { try { return editing ? document.queryCommandState(cmd) : false; } catch { return false; } };

  // ── Clavier ────────────────────────────────────────────────────────────────
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (isTyping(e.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'a') { e.preventDefault(); setSel(page.els.map((x) => x.id)); return; }
    if (mod && k === 'v' && clipboard.current.length) {
      e.preventDefault();
      const c = copies(clipboard.current);
      clipboard.current = c;
      add(c);
      return;
    }
    if (!selEls.length) return;
    if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod && k === 'c') { clipboard.current = selEls.filter((x) => x.type !== 'form'); return; }
    if (mod && k === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); return; }
    if (e.key === 'Escape') { setSel([]); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
    if (e.key === 'Enter' && selected?.type === 'text') { e.preventDefault(); setEditing({ id: selected.id, caret: null }); return; }
    const step = e.shiftKey ? 5 : 0.5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) {
      e.preventDefault();
      const ids = new Set(selEls.filter((x) => !x.locked).map((x) => x.id));
      updateMany((x) => (ids.has(x.id) ? { x: round(x.x + d[0]), y: round(x.y + d[1]) } : null), `nudge-${sel.join()}`);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectPage = (i: number) => { setPi(i); setSel([]); setEditing(null); };

  // ── Barre d'outils ─────────────────────────────────────────────────────────
  const textTools = selected?.type === 'text' && (() => {
    const t = selected;
    const pt = Math.round(t.size * PT);
    return (
      <>
        {editing?.id !== t.id && <ToolBtn label="Modifier le texte" onPress={() => setEditing({ id: t.id, caret: null })}><Pencil className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Écrire</span></ToolBtn>}
        <select aria-label="Style du texte" title="Style du texte (suit le thème de la brochure)" value={t.role ?? ''}
          onChange={(e) => (e.target.value ? update(t.id, roleStyle(e.target.value as TextRole) as Partial<StudioElement>) : update(t.id, { role: undefined } as Partial<StudioElement>))}
          className="h-8 max-w-[7.5rem] rounded-md border border-gray-200 bg-white px-1.5 text-sm">
          <option value="">Libre</option>
          {TEXT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select aria-label="Police" value={t.font}
          onChange={(e) => (editingSel() ? exec('fontName', e.target.value, true) : upText(t.id, { font: e.target.value }))}
          className="h-8 max-w-[9.5rem] rounded-md border border-gray-200 bg-white px-1.5 text-sm" style={{ fontFamily: t.font }}>
          {STUDIO_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        <div className="flex items-center">
          <ToolBtn label="Plus petit" onPress={() => (editingSel() ? resizeSelection(0.85) : upText(t.id, { size: Math.max(1, Math.round((t.size - 1 / PT) * 100) / 100) }))}><Minus className="h-3.5 w-3.5" /></ToolBtn>
          <input aria-label="Taille du texte (points)" inputMode="numeric" defaultValue={pt} key={pt}
            onBlur={(e) => { const n = Number(e.target.value); if (n >= 6 && n <= 180 && n !== pt) upText(t.id, { size: Math.round((n / PT) * 100) / 100 }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="h-8 w-10 rounded-md border border-gray-200 text-center text-sm tabular-nums" />
          <ToolBtn label="Plus grand" onPress={() => (editingSel() ? resizeSelection(1.18) : upText(t.id, { size: Math.min(30, Math.round((t.size + 1 / PT) * 100) / 100) }))}><Plus className="h-3.5 w-3.5" /></ToolBtn>
        </div>
        <ToolBtn label="Gras (Ctrl+B)" active={queryState('bold')} onPress={() => exec('bold')}><Bold className="h-4 w-4" /></ToolBtn>
        <ToolBtn label="Italique (Ctrl+I)" active={queryState('italic')} onPress={() => exec('italic')}><Italic className="h-4 w-4" /></ToolBtn>
        <ToolBtn label="Souligné (Ctrl+U)" active={queryState('underline')} onPress={() => exec('underline')}><Underline className="h-4 w-4" /></ToolBtn>
        <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-gray-100" title="Couleur du texte">
          <span className="sr-only">Couleur du texte</span>
          <span aria-hidden className="text-sm font-bold" style={{ color: t.color, textDecoration: 'underline', textDecorationThickness: 3 }}>A</span>
          <input type="color" value={t.color} className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => (editingSel() ? exec('foreColor', e.target.value, true) : upText(t.id, { color: e.target.value.toLowerCase() }, `color-${t.id}`))} />
        </label>
        <Sep />
        {([['left', AlignLeft, 'Aligner à gauche'], ['center', AlignCenter, 'Centrer'], ['right', AlignRight, 'Aligner à droite'], ['justify', AlignJustify, 'Justifier']] as const).map(([a, Icon, label]) => (
          <ToolBtn key={a} label={label} active={t.align === a} onPress={() => update(t.id, { align: a })}><Icon className="h-4 w-4" /></ToolBtn>
        ))}
        <ToolBtn label="Liste à puces" onPress={() => exec('insertUnorderedList')}><List className="h-4 w-4" /></ToolBtn>
        <ToolBtn label="Liste numérotée" onPress={() => exec('insertOrderedList')}><ListOrdered className="h-4 w-4" /></ToolBtn>
        <ToolBtn label="Majuscules" active={t.uppercase} onPress={() => upText(t.id, { uppercase: !t.uppercase })}><CaseUpper className="h-4 w-4" /></ToolBtn>
        <select aria-label="Interligne" value={String(t.lineHeight)} onChange={(e) => upText(t.id, { lineHeight: Number(e.target.value) })}
          className="h-8 rounded-md border border-gray-200 bg-white px-1 text-sm" title="Interligne">
          {[...new Set([0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.8, 2, t.lineHeight])].sort((a, b) => a - b).map((v) => <option key={v} value={String(v)}>↕ {v}</option>)}
        </select>
        <div className="relative">
          <ToolBtn label="Lien (site, email, téléphone)" active={linkOpen} onPress={() => { setLinkValue(''); setLinkOpen((v) => !v); setWeboOpen(false); }}><Link2 className="h-4 w-4" /></ToolBtn>
        </div>
        <ToolBtn label="Effacer la mise en forme" onPress={() => exec('removeFormat')}><RemoveFormatting className="h-4 w-4" /></ToolBtn>
        <div className="relative">
          <ToolBtn label="Webo : corriger, reformuler…" active={weboOpen} disabled={weboBusy} onPress={() => { setWeboPart(editingSel()); setWeboOpen((v) => !v); setLinkOpen(false); }}>
            {weboBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}<span className="ml-1 hidden sm:inline">Webo</span>
          </ToolBtn>
        </div>
      </>
    );
  })();

  // Téléphone : une seule ligne qui défile ; les menus (lien, Webo) s'ouvrent sous la barre, hors de la ligne.
  const toolbar = (
    <div className="sticky top-0 z-20">
    <div role="toolbar" aria-label="Outils du Studio"
      className="flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur max-md:overflow-x-auto max-md:[scrollbar-width:none] md:flex-wrap [&>*]:shrink-0">
      <ToolBtn label="Annuler (Ctrl+Z)" onPress={undo} disabled={!canUndo}><Undo2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Rétablir (Ctrl+Y)" onPress={redo} disabled={!canRedo}><Redo2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Choisir plusieurs éléments" active={multi} onPress={() => setMulti((v) => !v)}><BoxSelect className="h-4 w-4" /><span className="ml-1 md:hidden">Plusieurs</span></ToolBtn>
      {selEls.length > 0 && <Sep />}
      {textTools}
      {selEls.length > 1 && (
        <>
          <span className="px-1 text-xs font-medium text-gray-500">{selEls.length} éléments</span>
          <ToolBtn label="Aligner à gauche" onPress={() => alignSel('left')}><AlignStartVertical className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Centrer horizontalement" onPress={() => alignSel('hcenter')}><AlignCenterVertical className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Aligner à droite" onPress={() => alignSel('right')}><AlignEndVertical className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Aligner en haut" onPress={() => alignSel('top')}><AlignStartHorizontal className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Centrer verticalement" onPress={() => alignSel('vmiddle')}><AlignCenterHorizontal className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Aligner en bas" onPress={() => alignSel('bottom')}><AlignEndHorizontal className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Répartir horizontalement" disabled={selEls.length < 3} onPress={() => distributeSel('x')}><AlignHorizontalSpaceAround className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Répartir verticalement" disabled={selEls.length < 3} onPress={() => distributeSel('y')}><AlignVerticalSpaceAround className="h-4 w-4" /></ToolBtn>
          {selGrouped
            ? <ToolBtn label="Dégrouper (Ctrl+Maj+G)" onPress={ungroupSel}><Ungroup className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Dégrouper</span></ToolBtn>
            : <ToolBtn label="Grouper (Ctrl+G)" onPress={groupSel}><GroupIcon className="h-4 w-4" /><span className="ml-1 hidden sm:inline">Grouper</span></ToolBtn>}
        </>
      )}
      {selEls.length > 0 && (
        <>
          <Sep />
          <ToolBtn label="Avancer d'un plan" onPress={() => layerSel('up')}><ArrowUpToLine className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Reculer d'un plan" onPress={() => layerSel('down')}><ArrowDownToLine className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Premier plan" onPress={() => layerSel('front')}><BringToFront className="h-4 w-4" /></ToolBtn>
          <ToolBtn label="Arrière-plan" onPress={() => layerSel('back')}><SendToBack className="h-4 w-4" /></ToolBtn>
          {selected && (
            <ToolBtn label={selected.locked ? 'Déverrouiller' : 'Verrouiller'} active={selected.locked} onPress={() => update(selected.id, { locked: selected.locked ? undefined : true })}>
              {selected.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </ToolBtn>
          )}
          {selEls.some((e) => e.type !== 'form') && <>
            <ToolBtn label="Dupliquer (Ctrl+D)" onPress={duplicateSel}><Copy className="h-4 w-4" /></ToolBtn>
            <ToolBtn label="Supprimer (Suppr)" onPress={removeSel}><Trash2 className="h-4 w-4 text-danger" /></ToolBtn>
          </>}
        </>
      )}
      {!selEls.length && <span className="px-2 text-xs text-gray-500 max-md:hidden">Cliquez sur un élément (Maj+clic ou cadre pour plusieurs), ou ajoutez-en un.</span>}
      <span className="ml-auto flex items-center max-md:ml-2 max-md:border-l max-md:border-gray-200 max-md:pl-1">
        <ToolBtn label="Grille et règles" active={showGrid} onPress={() => setShowGrid((v) => !v)}><Grid3x3 className="h-4 w-4" /></ToolBtn>
        <ToolBtn label="Zoom arrière" disabled={zoom <= 0.5} onPress={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}><ZoomOut className="h-4 w-4" /></ToolBtn>
        <button type="button" onClick={() => setZoom(1)} title="Taille ajustée" className="h-8 w-12 rounded-md text-xs tabular-nums text-gray-600 hover:bg-gray-100">{Math.round(zoom * 100)} %</button>
        <ToolBtn label="Zoom avant" disabled={zoom >= 2.5} onPress={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100))}><ZoomIn className="h-4 w-4" /></ToolBtn>
      </span>
    </div>
    {selected?.type === 'text' && <>
          {linkOpen && (
            <div className="absolute left-1 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
              <input autoFocus value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="monsite.fr, email ou téléphone"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinkOpen(false); }}
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm" aria-label="Adresse du lien" />
              <div className="mt-2 flex justify-between gap-2">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setLinkOpen(false); exec('unlink'); }} className="inline-flex items-center gap-1 text-xs text-gray-600"><Link2Off className="h-3.5 w-3.5" /> Retirer le lien</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={applyLink} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white">Appliquer</button>
              </div>
            </div>
          )}
          {weboOpen && (
            <div className="absolute left-1 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-1 shadow-lg" role="menu">
              {REWRITES.map(([m, label]) => (
                <button key={m} type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => rewrite(m)}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100">{label}</button>
              ))}
              <p className="px-2.5 py-1 text-[11px] text-gray-400">1 WeboCoin · {weboPart ? 'le passage sélectionné' : 'tout le texte (sélectionnez un passage en écrivant pour ne changer que lui)'}</p>
            </div>
          )}
    </>}
    </div>
  );

  // ── Réglages ───────────────────────────────────────────────────────────────
  const pageSettings = (
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
        onClick={() => set((d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, bg: page.bg })) }))}>
        Mettre cette couleur de fond sur toutes les pages
      </button>
      {page.form && <p className="text-xs text-gray-500">La dernière page porte le formulaire de demande : déplacez-le, redimensionnez-le, habillez la page autour.</p>}
    </div>
  );
  const docSettings = (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="tablist" aria-label="Réglages">
        {([['page', 'Page'], ['theme', 'Thème et styles'], ['link', 'Lien']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={docTab === k} onClick={() => setDocTab(k)}
            className={cn('rounded-md px-2.5 py-1 text-xs font-semibold', docTab === k ? 'bg-white text-primary shadow-sm' : 'text-gray-600')}>{label}</button>
        ))}
      </div>
      {docTab === 'page' && pageSettings}
      {docTab === 'theme' && (
        <ThemePanel theme={theme}
          onPreset={(t) => set((d) => applyTheme(d, t))}
          onTheme={(t) => set((d) => applyRoleStyles({ ...d, theme: t }, t), 'theme')}
          onApply={() => set((d) => applyTheme(d, theme))} />
      )}
      {docTab === 'link' && <OptionsPanel options={options} phone={company.phone} onChange={(o) => set((d) => ({ ...d, options: o }))} />}
    </div>
  );

  const effects = (el: StudioElement) => el.type !== 'form' && (
    <Group title="Effets">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={!!el.shadow} onChange={(e) => update(el.id, { shadow: e.target.checked || undefined })} /> Ombre portée
      </label>
    </Group>
  );

  const inspector = (() => {
    if (selEls.length > 1) {
      return (
        <div className="space-y-3">
          <Group title={`${selEls.length} éléments choisis`}>
            <p className="text-xs text-gray-500">Déplacez-les ensemble, alignez-les ou groupez-les avec la barre du haut. Maj+clic retire un élément de la sélection.</p>
            <Slider label="Transparence" value={100 - Math.min(...selEls.map((e) => e.opacity))} min={0} max={100} unit=" %"
              onChange={(v) => { const ids = new Set(sel); updateMany((e) => (ids.has(e.id) ? { opacity: 100 - v } : null), `op-${sel.join()}`); }} />
          </Group>
        </div>
      );
    }
    if (!selected) return docSettings;
    const el = selected;
    const up = (patch: Partial<StudioElement>, key?: string) => update(el.id, patch, key);
    return (
      <div className="space-y-3">
        <PositionGroup el={el} measuredH={heightOf(el)} onChange={(p) => up(p, `pos-${el.id}`)} />
        {el.type === 'text' && (
          <Group title="Texte">
            <ColorField label="Couleur du texte" value={el.color} onChange={(c) => upText(el.id, { color: c ?? '#1c2621' })} />
            <ColorField label="Fond du texte" value={el.bg} nullable onChange={(c) => up({ bg: c })} />
            <Slider label="Espacement des lettres" value={el.letterSpacing} min={-0.05} max={0.5} step={0.01} unit=" em" onChange={(v) => upText(el.id, { letterSpacing: v }, `ls-${el.id}`)} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Marge intérieure" value={el.padding} min={0} max={20} scale={2.1} suffix="mm" onChange={(v) => up({ padding: v }, `pad-${el.id}`)} />
              <NumberField label="Arrondi" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />
            </div>
            <p className="text-xs text-gray-500">L’orthographe est soulignée pendant la saisie ; « Webo » dans la barre corrige ou reformule tout le texte.</p>
          </Group>
        )}
        {el.type === 'image' && (
          <>
            <PhotoGroup url={el.url} frame={el.frame} ratio={(el.h / el.w) * 100} onUrl={(u) => up({ url: u, frame: undefined })} onFrame={(f) => up({ frame: f ?? undefined }, `frame-${el.id}`)} />
            <Group title="Effets photo">
              <Segmented label="Filtre" value={el.filter} onChange={(filter) => up({ filter })}
                options={[['none', 'Aucun'], ['bw', 'N&B'], ['sepia', 'Sépia'], ['warm', 'Chaud'], ['cool', 'Froid'], ['fade', 'Doux']]} />
              <Segmented label="Forme" value={el.mask} onChange={(mask) => up({ mask })} options={[['none', 'Normale'], ['circle', 'Ronde'], ['arch', 'Arche']]} />
              {el.mask === 'none' && <NumberField label="Arrondi des coins" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />}
              <ColorField label="Bordure" value={el.borderColor} nullable onChange={(c) => up({ borderColor: c, borderWidth: c && !el.borderWidth ? 0.6 : el.borderWidth })} />
              {el.borderColor && <Slider label="Épaisseur" value={el.borderWidth} min={0} max={5} step={0.1} onChange={(v) => up({ borderWidth: v }, `bw-${el.id}`)} />}
            </Group>
          </>
        )}
        {el.type === 'shape' && (
          <Group title="Forme">
            <Segmented label="Forme" value={el.shape} onChange={(shape) => up({ shape })} options={[['rect', 'Rectangle'], ['ellipse', 'Cercle'], ['arch', 'Arche'], ['line', 'Ligne']]} />
            {el.shape !== 'line' && <ColorField label="Remplissage" value={el.fill} nullable onChange={(c) => up({ fill: c })} />}
            <ColorField label={el.shape === 'line' ? 'Couleur' : 'Contour'} value={el.stroke} nullable={el.shape !== 'line'}
              onChange={(c) => up({ stroke: c, strokeWidth: c && !el.strokeWidth ? 0.4 : el.strokeWidth })} />
            {(el.stroke || el.shape === 'line') && <>
              <Slider label="Épaisseur" value={el.strokeWidth} min={0} max={10} step={0.1} onChange={(v) => up({ strokeWidth: v }, `sw-${el.id}`)} />
              <Segmented label="Trait" value={el.dash} onChange={(dash) => up({ dash })} options={[['solid', 'Plein'], ['dashed', 'Tirets'], ['dotted', 'Points'], ['double', 'Double']]} />
            </>}
            {el.shape === 'rect' && <NumberField label="Arrondi des coins" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />}
          </Group>
        )}
        {el.type === 'icon' && (
          <Group title="Pictogramme">
            <ColorField label="Couleur" value={el.color} onChange={(c) => up({ color: c ?? '#b4502d' })} />
            <Slider label="Épaisseur du trait" value={el.strokeWidth} min={0.5} max={3} step={0.25} onChange={(v) => up({ strokeWidth: v }, `isw-${el.id}`)} />
            <ul className="grid max-h-40 grid-cols-7 gap-0.5 overflow-y-auto" aria-label="Changer de pictogramme">
              {STUDIO_ICONS.map((name) => {
                const Icon = ICONS[name];
                return (
                  <li key={name}>
                    <button type="button" title={name} aria-label={name} aria-pressed={el.name === name} onClick={() => up({ name })}
                      className={cn('flex aspect-square w-full items-center justify-center rounded', el.name === name ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100')}>
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Group>
        )}
        {el.type === 'video' && (
          <Group title="Vidéo">
            <p className="text-xs text-gray-500">Jouée en boucle et sans le son sur le lien. Dans le PDF, sa première image.</p>
            <Segmented label="Cadrage" value={el.fit} onChange={(fit) => up({ fit })} options={[['cover', 'Remplir le cadre'], ['contain', 'Vidéo entière']]} />
            <NumberField label="Arrondi des coins" value={el.radius} min={0} max={50} scale={2.1} suffix="mm" onChange={(v) => up({ radius: v }, `rad-${el.id}`)} />
            <p className="text-xs text-gray-500">Pour la remplacer : « Photos » → « Vidéo courte ou GIF », la vidéo choisie.</p>
          </Group>
        )}
        {el.type === 'qr' && (
          <Group title="QR code">
            <Segmented label="Il mène vers" value={el.target} onChange={(target) => up({ target })} options={[['brochure', 'Cette brochure'], ['url', 'Une autre adresse']]} />
            {el.target === 'url' && (
              <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Adresse</span>
                <input defaultValue={el.url ?? ''} placeholder="https://monsite.fr" onBlur={(e) => { const v = e.target.value.trim(); up({ url: v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null }); }}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm" /></label>
            )}
            {el.target === 'brochure' && <p className="text-xs text-gray-500">Sur un lien par source ou par client, il mène à ce lien-là.</p>}
            <ColorField label="Couleur" value={el.color} onChange={(c) => up({ color: c ?? '#1c2621' })} />
            <ColorField label="Fond" value={el.bg} nullable onChange={(c) => up({ bg: c })} />
            <p className="text-xs text-gray-500">Gardez un fond clair et un code foncé : les téléphones le lisent mieux.</p>
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
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={el.fit} onChange={(e) => up({ fit: e.target.checked })} />
                  Réduire le texte pour qu’il tienne dans le cadre
                </label>
                {p && <button type="button" onClick={() => setRetouch(el.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark"><Pencil className="h-4 w-4" /> Retoucher le texte pour cette brochure</button>}
                <button type="button" onClick={() => growToFit(el.id)} className="block text-sm font-medium text-primary hover:text-primary-dark">Agrandir le cadre pour tout afficher</button>
                {overflow.has(el.id) && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">Le texte dépasse encore du cadre : agrandissez-le, passez en texte court ou réduisez la taille.</p>}
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
        {effects(el)}
        {el.group && <button type="button" onClick={() => setSel(groupIds(el))} className="text-sm font-medium text-primary hover:text-primary-dark">Choisir tout le groupe</button>}
      </div>
    );
  })();

  const addPanel = (
    <AddPanel tab={addTab} onTab={setAddTab} onAdd={(item) => addItem(item)} onTemplate={addTemplate} onKind={addKind}
      onCompanyPage={(p) => insertPage(clonePage(p))} templatesVersion={templatesVersion} onWeboCover={weboCover}
      catalog={catalog} used={used} templateContext={templateContext} resolve={resolvePage} language={settings.language} logoUrl={company.logoUrl} />
  );

  // ── La page éditée ─────────────────────────────────────────────────────────
  const selBox = (() => {
    if (!selEls.length) return null;
    if (!selected) {
      const b = bounds(selEls.map(boxOf));
      return (
        <>
          {selEls.map((e) => (
            <div key={e.id} aria-hidden className="pointer-events-none absolute" style={{ left: e.x * unit, top: e.y * unit, width: e.w * unit, height: heightOf(e) * unit, transform: e.rot ? `rotate(${e.rot}deg)` : undefined, outline: '1px solid #B4502D' }} />
          ))}
          <div aria-hidden className="pointer-events-none absolute" style={{ left: b.x * unit - 3, top: b.y * unit - 3, width: b.w * unit + 6, height: b.h * unit + 6, border: '1.5px dashed #B4502D' }}>
            {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
              <span key={c} className="pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: c.includes('w') ? '0%' : '100%', top: c.includes('n') ? '0%' : '100%', cursor: CURSOR[c], touchAction: 'none' }}
                onPointerDown={(e) => scaleGesture(e, c)} title="Agrandir ou réduire l’ensemble">
                <span className="block h-3 w-3 rounded-full border-2 border-[#B4502D] bg-white shadow" />
              </span>
            ))}
          </div>
        </>
      );
    }
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
    <div ref={wrap} className="min-w-0 overflow-auto rounded-2xl bg-[#E9E4DB] px-1 py-6 md:px-8"
      onPointerDown={() => { stopEditing(); setSel([]); }}>
      {fontsHref && (
        // eslint-disable-next-line @next/next/no-css-tags
        <link rel="stylesheet" href={fontsHref} />
      )}
      <style>{`${STUDIO_CSS}
        .wb-studio-canvas [data-el]:hover { outline: 1px solid rgba(180,80,45,.45); outline-offset: 1px; }
        .wb-studio-canvas [data-el][data-selected] { outline: none; }`}</style>
      <div className="relative mx-auto" style={{ width: W }}>
        {showGrid && <><Ruler length={W} unit={unit} /><Ruler length={W * RATIO} unit={unit} vertical /></>}
        <div ref={pageRef} className="wb-studio-canvas relative shadow-[0_10px_30px_rgba(0,0,0,.18)]"
          style={{ width: W, height: W * RATIO, containerType: 'inline-size' }}
          onPointerDown={startMarquee}
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData(DRAG_TYPE);
            if (!raw) return;
            e.preventDefault();
            let item: AddItem;
            try { item = JSON.parse(raw); } catch { return; }
            const target = (e.target as HTMLElement).closest<HTMLElement>('[data-el]');
            const onto = target ? page.els.find((x) => x.id === target.dataset.el) ?? null : null;
            addItem(item, pointIn(e.clientX, e.clientY), onto);
          }}>
          <div className="absolute inset-0 overflow-hidden">
            <PageBackground page={rpage} />
            {page.els.map((el) => {
              const r = rById.get(el.id) as ResolvedStudioElement | undefined;
              if (!r) return null;
              const isEditing = editing?.id === el.id && el.type === 'text';
              return (
                <div key={el.id} data-el={el.id} data-el-type={el.type} {...(sel.includes(el.id) ? { 'data-selected': '' } : {})}
                  style={{ ...elementBox(r), touchAction: isEditing ? 'auto' : 'none', cursor: isEditing ? 'text' : el.locked ? 'default' : 'move' }}
                  onPointerDown={(e) => {
                    if (isEditing) { e.stopPropagation(); return; }
                    if (editing) stopEditing();
                    if (e.shiftKey || multi) {
                      e.stopPropagation();
                      const ids = groupIds(el);
                      setSel((s) => (ids.every((i) => s.includes(i)) ? s.filter((i) => !ids.includes(i)) : [...s, ...ids.filter((i) => !s.includes(i))]));
                      return;
                    }
                    const ids = sel.includes(el.id) ? sel : groupIds(el);
                    setSel(ids);
                    gesture(e, el, 'move', ids);
                  }}
                  onDoubleClick={(e) => {
                    if (el.type === 'text' && !el.locked) { setSel([el.id]); setEditing({ id: el.id, caret: { x: e.clientX, y: e.clientY } }); }
                    else if (el.group) setSel([el.id]);
                  }}>
                  {isEditing
                    ? <TextEditing el={el} caret={editing!.caret} onDone={stopEditing} onInput={(html) => update(el.id, { html }, `text-${el.id}`)} />
                    : <ElementContent el={r} editor language={settings.language} />}
                  {overflow.has(el.id) && <span aria-hidden className="absolute bottom-1 right-1 rounded bg-amber-500 px-1 text-[10px] font-semibold text-white">Texte coupé</span>}
                </div>
              );
            })}
          </div>
          {showGrid && <div aria-hidden className="pointer-events-none absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(180,80,45,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(180,80,45,.13) 1px, transparent 1px)',
            backgroundSize: `${GRID * unit}px ${GRID * unit}px`,
          }} />}
          {guides && <>
            {guides.gx.map((x) => <span key={`x${x}`} aria-hidden className="pointer-events-none absolute top-0 h-full w-px bg-fuchsia-500" style={{ left: x * unit }} />)}
            {guides.gy.map((y) => <span key={`y${y}`} aria-hidden className="pointer-events-none absolute left-0 h-px w-full bg-fuchsia-500" style={{ top: y * unit }} />)}
          </>}
          {marquee && <div aria-hidden className="pointer-events-none absolute border border-[#B4502D] bg-[#B4502D]/10" style={{ left: marquee.x * unit, top: marquee.y * unit, width: marquee.w * unit, height: marquee.h * unit }} />}
          {selBox}
        </div>
      </div>
    </div>
  );

  const strip = (
    <PagesStrip pages={doc.pages} resolved={resolved} current={pageIndex} language={settings.language} onSelect={selectPage}
      onAdd={() => insertPage(blankPage(doc.theme?.bg ?? page.bg))} onDuplicate={() => insertPage(clonePage(page))} onDelete={deletePage} onMove={movePage}
      onTemplateSaved={() => setTemplatesVersion((v) => v + 1)} />
  );

  const retouched = retouch ? page.els.find((e) => e.id === retouch) : null;
  const retouchedPrestation = retouched?.type === 'prestation' ? byId.get(retouched.prestationId) : undefined;

  return (
    <ThemeColors.Provider value={themeColors}>
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
                {([['add', 'Ajouter'], ['settings', selEls.length ? 'Réglages de l’élément' : 'Page, thème et lien']] as const).map(([k, label]) => (
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
    </ThemeColors.Provider>
  );
}
