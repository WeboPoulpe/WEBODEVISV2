// ═══════════════════════════════════════════════════════════════════════════
// Brochures : mise en page à blocs (éditeur avancé)
// ═══════════════════════════════════════════════════════════════════════════
// Voir docs/superpowers/specs/2026-10-22-brochures-editeur-avance-design.md. Une mise en page est une suite de pages ;
// une page « blocks » empile des blocs (prestation, titre, texte, image, colonnes, séparateur, espace). Un bloc
// Prestation référence le catalogue par identifiant : nom, texte, prix et photo sont lus à l'affichage. Module sans
// accès à la base : servi au serveur (lien public, enregistrement) comme à l'éditeur.

import { sanitizeHtml } from './sanitize';
import {
  paginateBrochure, resolveItems, shortText,
  type BrochureContent, type BrochureItem, type BrochurePage, type BrochureSection, type BrochureStyle, type CatalogPrestation,
  type PriceOptions, type ResolvedItem,
} from './brochure';

export const PALETTE = ['#1C2621', '#2F4A3A', '#B4502D', '#5b5b55', '#FBF7F0', '#EDE6DA', '#E6DFD3', '#FFFFFF'];
export const BLOCK_FONTS = ['Georgia', 'Playfair Display', 'Lora', 'Montserrat', 'Inter'];
export const TITLE_SIZES = [14, 18, 22, 28, 36];
export const MAX_PAGES = 40;
export const MAX_BLOCKS_PER_PAGE = 30;
/** Longueur du texte « court » d'une prestation. */
export const SHORT_TEXT = 150;

export type Align = 'left' | 'center' | 'right';
export interface BlockStyle { padding?: number; background?: string | null; font?: string | null; titleSize?: number | null; titleColor?: string | null; align?: Align }

export type Block =
  | { id: string; type: 'prestation'; prestationId: string; photo: 'top' | 'left' | 'right' | 'none'; show: { name: boolean; text: boolean; price: boolean }; text: 'full' | 'short'; html?: string; titled?: boolean; photoUrl?: string; hidePrice?: boolean; style?: BlockStyle }
  | { id: string; type: 'title'; text: string; level: 'l' | 'm' | 's'; style?: BlockStyle }
  | { id: string; type: 'text'; html: string; style?: BlockStyle }
  | { id: string; type: 'image'; url: string | null; height: number; fit: 'cover' | 'contain'; style?: BlockStyle }
  | { id: string; type: 'columns'; count: 2 | 3; gap: number; cols: Block[][]; style?: BlockStyle }
  | { id: string; type: 'separator'; color: string; width: number; style?: BlockStyle }
  | { id: string; type: 'spacer'; height: number };

export type PageKind = 'cover' | 'blocks' | 'contact' | 'form';
export interface LayoutPage { id: string; kind: PageKind; background?: string | null; font?: string | null; blocks: Block[] }
export interface BrochureLayout { pages: LayoutPage[] }

type Prestation = Extract<Block, { type: 'prestation' }>;
export type ResolvedBlock =
  | (Omit<Prestation, 'prestationId' | 'html' | 'titled' | 'photoUrl' | 'hidePrice'> & { item: ResolvedItem })
  | Exclude<Block, Prestation | { type: 'columns' }>
  | (Omit<Extract<Block, { type: 'columns' }>, 'cols'> & { cols: ResolvedBlock[][] });
export interface ResolvedPage { kind: PageKind; background: string | null; font: string | null; blocks: ResolvedBlock[] }

/** Une page du lien public : celles de l'éditeur simple, ou une page à blocs de l'éditeur avancé. */
export type PublicPage = BrochurePage | { kind: 'blocks'; background: string | null; font: string | null; blocks: ResolvedBlock[] };

/** Polices choisies dans une mise en page (pages et blocs), pour les charger. */
export function layoutFonts(l: BrochureLayout | null): string[] {
  if (!l) return [];
  const fonts = l.pages.flatMap((p) => [p.font, ...p.blocks.flatMap((b) => [b.type !== 'spacer' ? b.style?.font : null, ...(b.type === 'columns' ? b.cols.flat().map((c) => (c.type !== 'spacer' ? c.style?.font : null)) : [])])]);
  return [...new Set(fonts.filter((f): f is string => !!f))];
}

/** Identifiants des prestations citées par une mise en page. */
export function layoutPrestationIds(l: BrochureLayout): string[] {
  return [...new Set(blocksInOrder(l).flatMap((b) => (b.type === 'prestation' ? [b.prestationId] : [])))];
}

/** Le HTML d'une mise en page (blocs Texte, retouches) passé par le nettoyage. */
export function sanitizeLayout(l: BrochureLayout): BrochureLayout {
  const clean = (b: Block): Block => (b.type === 'text' ? { ...b, html: sanitizeHtml(b.html) }
    : b.type === 'prestation' && b.html ? { ...b, html: sanitizeHtml(b.html) }
      : b.type === 'columns' ? { ...b, cols: b.cols.map((c) => c.map(clean)) } : b);
  return { pages: l.pages.map((p) => ({ ...p, blocks: p.blocks.map(clean) })) };
}

export const newBlockId = () => `b${Math.random().toString(36).slice(2, 10)}`;
const newPageId = () => `p${Math.random().toString(36).slice(2, 10)}`;

// ── Lecture ──────────────────────────────────────────────────────────────────

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const color = (v: unknown) => (typeof v === 'string' && PALETTE.includes(v) ? v : null);
const font = (v: unknown) => (typeof v === 'string' && BLOCK_FONTS.includes(v) ? v : null);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

function parseStyle(raw: unknown): BlockStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const s: BlockStyle = {};
  if (r.padding !== undefined) s.padding = num(r.padding, 0, 48, 0);
  if (color(r.background)) s.background = color(r.background);
  if (font(r.font)) s.font = font(r.font);
  if (TITLE_SIZES.includes(Number(r.titleSize))) s.titleSize = Number(r.titleSize);
  if (color(r.titleColor)) s.titleColor = color(r.titleColor);
  if (r.align) s.align = pick(r.align, ['left', 'center', 'right'] as const, 'left');
  return Object.keys(s).length ? s : undefined;
}

function parseBlock(raw: unknown, nested: boolean): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 40) || newBlockId();
  const style = parseStyle(r.style);
  const withStyle = <B extends object>(b: B) => (style ? { ...b, style } : b);
  switch (r.type) {
    case 'prestation': {
      const prestationId = str(r.prestationId, 60);
      if (!prestationId) return null;
      const show = (r.show && typeof r.show === 'object' ? r.show : {}) as Record<string, unknown>;
      return withStyle({
        id, type: 'prestation' as const, prestationId,
        photo: pick(r.photo, ['top', 'left', 'right', 'none'] as const, 'top'),
        show: { name: show.name !== false, text: show.text !== false, price: show.price !== false },
        text: pick(r.text, ['full', 'short'] as const, 'full'),
        ...(str(r.html) ? { html: str(r.html, 20000)! } : {}),
        ...(r.titled === true ? { titled: true } : {}),
        ...(typeof r.photoUrl === 'string' && /^https?:\/\//.test(r.photoUrl) ? { photoUrl: r.photoUrl } : {}),
        ...(r.hidePrice === true ? { hidePrice: true } : {}),
      });
    }
    case 'title': return withStyle({ id, type: 'title' as const, text: str(r.text, 200) ?? '', level: pick(r.level, ['l', 'm', 's'] as const, 'm') });
    case 'text': return withStyle({ id, type: 'text' as const, html: str(r.html, 20000) ?? '' });
    case 'image': return withStyle({
      id, type: 'image' as const, url: typeof r.url === 'string' && /^https?:\/\//.test(r.url) ? r.url : null,
      height: num(r.height, 40, 900, 180), fit: pick(r.fit, ['cover', 'contain'] as const, 'cover'),
    });
    case 'columns': {
      // Pas de colonnes dans des colonnes.
      if (nested) return null;
      const count = Number(r.count) === 3 ? 3 : 2;
      const rawCols = Array.isArray(r.cols) ? r.cols : [];
      const cols = Array.from({ length: count }, (_, i) => (Array.isArray(rawCols[i]) ? rawCols[i] as unknown[] : [])
        .map((b) => parseBlock(b, true)).filter((b): b is Block => !!b));
      return withStyle({ id, type: 'columns' as const, count: count as 2 | 3, gap: num(r.gap, 0, 48, 12), cols });
    }
    case 'separator': return withStyle({ id, type: 'separator' as const, color: color(r.color) ?? '#E6DFD3', width: num(r.width, 10, 100, 60) });
    case 'spacer': return { id, type: 'spacer', height: num(r.height, 4, 400, 24) };
    default: return null;
  }
}

/** Mise en page lue en base ou envoyée par l'éditeur, nettoyée ; null si illisible. */
export function parseLayout(raw: unknown): BrochureLayout | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { pages?: unknown }).pages)) return null;
  const pages = ((raw as { pages: unknown[] }).pages).flatMap((p): LayoutPage[] => {
    if (!p || typeof p !== 'object') return [];
    const r = p as Record<string, unknown>;
    const kind = pick(r.kind, ['cover', 'blocks', 'contact', 'form'] as const, 'blocks');
    const blocks = kind === 'blocks' && Array.isArray(r.blocks) ? r.blocks.map((b) => parseBlock(b, false)).filter((b): b is Block => !!b) : [];
    return [{ id: str(r.id, 40) || newPageId(), kind, background: color(r.background), font: font(r.font), blocks }];
  });
  return { pages };
}

const countBlocks = (blocks: Block[]) => blocks.reduce((n, b) => n + 1 + (b.type === 'columns' ? b.cols.flat().length : 0), 0);

/** Règles des pages : message à montrer, ou null si la mise en page est acceptable. */
export function layoutError(l: BrochureLayout): string | null {
  const kinds = l.pages.map((p) => p.kind);
  if (l.pages.length > MAX_PAGES) return `Une brochure compte ${MAX_PAGES} pages au plus.`;
  if (kinds.filter((k) => k === 'cover').length > 1) return 'Une brochure n’a qu’une couverture.';
  if (kinds.includes('cover') && kinds[0] !== 'cover') return 'La couverture est toujours la première page.';
  if (kinds.filter((k) => k === 'contact').length > 1) return 'Une brochure n’a qu’une page contact.';
  if (kinds.filter((k) => k === 'form').length !== 1 || kinds[kinds.length - 1] !== 'form') return 'Le formulaire de demande est toujours la dernière page.';
  for (const p of l.pages) {
    if (countBlocks(p.blocks) > MAX_BLOCKS_PER_PAGE) return `Une page compte ${MAX_BLOCKS_PER_PAGE} blocs au plus.`;
    if (p.blocks.some((b) => b.type === 'columns' && b.cols.flat().some((c) => c.type === 'columns'))) return 'Des colonnes ne se mettent pas dans des colonnes.';
  }
  return null;
}

// ── Opérations ───────────────────────────────────────────────────────────────

export interface BlockTarget { pageId?: string; parentId?: string; col?: number; index: number }

const mapPages = (l: BrochureLayout, fn: (blocks: Block[]) => Block[]): BrochureLayout =>
  ({ pages: l.pages.map((p) => ({ ...p, blocks: fn(p.blocks) })) });

/** Applique `fn` à chaque liste de blocs (page et colonnes). */
function mapLists(blocks: Block[], fn: (list: Block[]) => Block[]): Block[] {
  return fn(blocks).map((b) => (b.type === 'columns' ? { ...b, cols: b.cols.map((c) => fn(c)) } : b));
}

function findBlock(l: BrochureLayout, id: string): Block | null {
  for (const p of l.pages) for (const b of p.blocks) {
    if (b.id === id) return b;
    if (b.type === 'columns') for (const c of b.cols) for (const x of c) if (x.id === id) return x;
  }
  return null;
}

const insertAt = <T,>(list: T[], index: number, item: T) => { const next = [...list]; next.splice(Math.max(0, Math.min(index, list.length)), 0, item); return next; };

export function addBlock(l: BrochureLayout, pageId: string, block: Block, at?: BlockTarget): BrochureLayout {
  return { pages: l.pages.map((p) => {
    if (p.id !== pageId || p.kind !== 'blocks') return p;
    if (at?.parentId) {
      return { ...p, blocks: p.blocks.map((b) => (b.id === at.parentId && b.type === 'columns' && block.type !== 'columns'
        ? { ...b, cols: b.cols.map((c, i) => (i === (at.col ?? 0) ? insertAt(c, at.index, block) : c)) } : b)) };
    }
    return { ...p, blocks: insertAt(p.blocks, at?.index ?? p.blocks.length, block) };
  }) };
}

export function removeBlock(l: BrochureLayout, id: string): BrochureLayout {
  return mapPages(l, (blocks) => mapLists(blocks, (list) => list.filter((b) => b.id !== id)));
}

export function moveBlock(l: BrochureLayout, id: string, dir: -1 | 1): BrochureLayout {
  return mapPages(l, (blocks) => mapLists(blocks, (list) => {
    const i = list.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }));
}

/** Déplace un bloc à un endroit précis (page, ou colonne d'un bloc colonnes). */
export function placeBlock(l: BrochureLayout, id: string, at: BlockTarget): BrochureLayout {
  const block = findBlock(l, id);
  if (!block || (at.parentId && block.type === 'columns') || at.parentId === id) return l;
  const without = removeBlock(l, id);
  const pageId = at.pageId ?? without.pages.find((p) => p.blocks.some((b) => b.id === at.parentId))?.id
    ?? l.pages.find((p) => p.blocks.some((b) => b.id === id || (b.type === 'columns' && b.cols.flat().some((x) => x.id === id))))?.id;
  return pageId ? addBlock(without, pageId, block, at) : l;
}

function cloneWithIds(b: Block): Block {
  return b.type === 'columns' ? { ...b, id: newBlockId(), cols: b.cols.map((c) => c.map(cloneWithIds)) } : { ...b, id: newBlockId() };
}

export function duplicateBlock(l: BrochureLayout, id: string): BrochureLayout {
  return mapPages(l, (blocks) => mapLists(blocks, (list) => list.flatMap((b) => (b.id === id ? [b, cloneWithIds(b)] : [b]))));
}

export function updateBlock(l: BrochureLayout, id: string, patch: Partial<Block>): BrochureLayout {
  return mapPages(l, (blocks) => mapLists(blocks, (list) => list.map((b) => (b.id === id ? ({ ...b, ...patch, id, type: b.type } as Block) : b))));
}

/** Nouvelle page : après `afterPageId`, sinon avant le formulaire ; une couverture va toujours en premier. */
export function addPage(l: BrochureLayout, kind: PageKind, afterPageId?: string): BrochureLayout {
  if (kind === 'form') return l;
  const page: LayoutPage = { id: newPageId(), kind, blocks: [] };
  if (kind === 'cover') return { pages: [page, ...l.pages] };
  const formIndex = l.pages.findIndex((p) => p.kind === 'form');
  const after = afterPageId ? l.pages.findIndex((p) => p.id === afterPageId) : -1;
  const index = after >= 0 && after < formIndex ? after + 1 : formIndex < 0 ? l.pages.length : formIndex;
  return { pages: insertAt(l.pages, index, page) };
}

export function removePage(l: BrochureLayout, pageId: string): BrochureLayout {
  const page = l.pages.find((p) => p.id === pageId);
  if (!page || page.kind === 'form') return l;
  return { pages: l.pages.filter((p) => p.id !== pageId) };
}

/** Monte ou descend une page ; couverture et formulaire ne bougent pas, et rien ne passe devant ou derrière eux. */
export function movePage(l: BrochureLayout, pageId: string, dir: -1 | 1): BrochureLayout {
  const i = l.pages.findIndex((p) => p.id === pageId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= l.pages.length) return l;
  if ([l.pages[i].kind, l.pages[j].kind].some((k) => k === 'cover' || k === 'form')) return l;
  const pages = [...l.pages];
  [pages[i], pages[j]] = [pages[j], pages[i]];
  return { pages };
}

export function duplicatePage(l: BrochureLayout, pageId: string): BrochureLayout {
  const i = l.pages.findIndex((p) => p.id === pageId);
  if (i < 0 || l.pages[i].kind !== 'blocks') return l;
  const copy = { ...l.pages[i], id: newPageId(), blocks: l.pages[i].blocks.map(cloneWithIds) };
  return { pages: insertAt(l.pages, i + 1, copy) };
}

export function updatePage(l: BrochureLayout, pageId: string, patch: Partial<Pick<LayoutPage, 'background' | 'font'>>): BrochureLayout {
  return { pages: l.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) };
}

/** Un bloc neuf, avec ses réglages par défaut. */
export function newBlock(type: Block['type'], prestationId?: string): Block {
  const id = newBlockId();
  switch (type) {
    case 'prestation': return { id, type, prestationId: prestationId ?? '', photo: 'top', show: { name: true, text: true, price: true }, text: 'full' };
    case 'title': return { id, type, text: 'Titre', level: 'm' };
    case 'text': return { id, type, html: '<p>Votre texte</p>' };
    case 'image': return { id, type, url: null, height: 180, fit: 'cover' };
    case 'columns': return { id, type, count: 2, gap: 12, cols: [[], []] };
    case 'separator': return { id, type, color: '#E6DFD3', width: 60 };
    case 'spacer': return { id, type, height: 24 };
  }
}

// ── Conversions entre les éditeurs ───────────────────────────────────────────

const prestationBlock = (item: BrochureItem, photo: Prestation['photo'], text: Prestation['text']): Block => ({
  ...(newBlock('prestation', item.prestationId) as Prestation), photo, text,
  ...(item.html ? { html: item.html } : {}), ...(item.titled ? { titled: true } : {}),
  ...(item.photoUrl ? { photoUrl: item.photoUrl } : {}), ...(item.hidePrice ? { hidePrice: true } : {}),
});

/** Les pages de l'éditeur simple, converties en blocs : la même brochure, désormais modifiable page par page. */
export function layoutFromSimple(content: BrochureContent, style: BrochureStyle, catalog: ReadonlyMap<string, CatalogPrestation>): BrochureLayout {
  const flat = content.sections.flatMap((s) => s.items);
  const pages = paginateBrochure(content, catalog, style, { show: true, mode: 'ttc', vatRate: 0, language: 'fr', forEditor: true });
  let alternate = 0;
  return { pages: pages.map((p): LayoutPage => {
    if (p.kind === 'about') {
      const blocks: Block[] = [{ ...(newBlock('title') as Block), text: 'Qui sommes-nous', level: 'm' } as Block, { id: newBlockId(), type: 'text', html: content.about.html }];
      if (content.about.photoUrl) blocks.push({ id: newBlockId(), type: 'image', url: content.about.photoUrl, height: 220, fit: 'cover' });
      return { id: newPageId(), kind: 'blocks', blocks };
    }
    if (p.kind !== 'items') return { id: newPageId(), kind: p.kind, blocks: [] };
    const blocks: Block[] = [];
    if (p.sectionTitle) blocks.push({ id: newBlockId(), type: 'title', text: p.sectionTitle, level: 'm' });
    for (const it of p.items) {
      const item = flat[Number(it.key)];
      if (!item) continue;
      const photo = style === 'editorial' ? 'top' : style === 'carte' ? 'none' : (alternate++ % 2 === 0 ? 'left' : 'right');
      blocks.push(prestationBlock(item, photo, style === 'editorial' ? 'full' : 'short'));
    }
    return { id: newPageId(), kind: 'blocks', blocks };
  }) };
}

const blocksInOrder = (l: BrochureLayout): Block[] => l.pages.flatMap((p) => p.blocks.flatMap((b) => (b.type === 'columns' ? b.cols.flat() : [b])));

/** Retour à l'éditeur simple : une section par bloc Titre, les prestations dans l'ordre des pages, retouches comprises. */
export function sectionsFromLayout(l: BrochureLayout): BrochureSection[] {
  const sections: BrochureSection[] = [];
  let current: BrochureSection | null = null;
  for (const b of blocksInOrder(l)) {
    if (b.type === 'title') { current = { id: newPageId(), title: b.text, items: [] }; sections.push(current); continue; }
    if (b.type !== 'prestation' || !b.prestationId) continue;
    if (!current) { current = { id: newPageId(), title: 'Nos prestations', items: [] }; sections.push(current); }
    current.items.push({
      prestationId: b.prestationId, ...(b.html ? { html: b.html } : {}), ...(b.titled ? { titled: true } : {}),
      ...(b.photoUrl ? { photoUrl: b.photoUrl } : {}), ...(b.hidePrice ? { hidePrice: true } : {}),
    });
  }
  return sections.filter((s) => s.items.length > 0);
}

/**
 * Reprendre une mise en page avancée après des changements en mode simple : les prestations retirées quittent leurs
 * blocs, celles ajoutées arrivent sur une page nouvelle, juste avant le formulaire.
 */
export function mergeLayout(l: BrochureLayout, content: BrochureContent): BrochureLayout {
  const wanted = content.sections.flatMap((s) => s.items);
  const ids = new Set(wanted.map((i) => i.prestationId));
  const kept = mapPages(l, (blocks) => mapLists(blocks, (list) => list.filter((b) => b.type !== 'prestation' || ids.has(b.prestationId))));
  const present = new Set(blocksInOrder(kept).flatMap((b) => (b.type === 'prestation' ? [b.prestationId] : [])));
  const added = wanted.filter((i) => !present.has(i.prestationId));
  if (added.length === 0) return kept;
  const page: LayoutPage = { id: newPageId(), kind: 'blocks', blocks: added.map((i) => prestationBlock(i, 'top', 'short')) };
  const formIndex = kept.pages.findIndex((p) => p.kind === 'form');
  return { pages: insertAt(kept.pages, formIndex < 0 ? kept.pages.length : formIndex, page) };
}

// ── Affichage ────────────────────────────────────────────────────────────────

/**
 * Les pages prêtes à afficher : prestations lues dans le catalogue (sautées si elles n'y sont plus, sauf dans
 * l'éditeur), texte court raccourci, prix masqués selon le bloc, HTML nettoyé. Rien d'interne au catalogue.
 */
export function resolveLayout(l: BrochureLayout, catalog: ReadonlyMap<string, CatalogPrestation>, o: PriceOptions & { forEditor: boolean }): ResolvedPage[] {
  let n = 0;
  const resolve = (b: Block): ResolvedBlock | null => {
    if (b.type === 'columns') return { ...b, cols: b.cols.map((c) => c.map(resolve).filter((x): x is ResolvedBlock => !!x)) };
    if (b.type === 'text') return { ...b, html: sanitizeHtml(b.html) };
    if (b.type !== 'prestation') return b;
    const section: BrochureSection = { id: 's', title: '', items: [{ prestationId: b.prestationId, html: b.html, titled: b.titled, photoUrl: b.photoUrl, hidePrice: b.hidePrice || !b.show.price }] };
    const [item] = resolveItems(section, catalog, o, n++);
    if (!item) return null;
    const shown = b.text === 'short' ? { ...item, html: shortText(item.html, SHORT_TEXT) } : item;
    const rest = { ...b } as Partial<Prestation>;
    delete rest.prestationId; delete rest.html; delete rest.titled; delete rest.photoUrl; delete rest.hidePrice;
    return { ...(rest as Omit<Prestation, 'prestationId'>), item: shown };
  };
  return l.pages.map((p) => ({
    kind: p.kind, background: p.background ?? null, font: p.font ?? null,
    blocks: p.blocks.map(resolve).filter((x): x is ResolvedBlock => !!x),
  }));
}
