// ═══════════════════════════════════════════════════════════════════════════
// Brochures : Studio (v2) — pages A4 composées librement, comme une affiche
// ═══════════════════════════════════════════════════════════════════════════
// Voir docs/superpowers/specs/2026-11-09-brochures-studio-v2-design.md. Une page du Studio est une feuille A4 sur
// laquelle on pose des éléments où l'on veut (texte riche, photo, forme, prestation du catalogue), qu'on déplace,
// redimensionne, fait pivoter et range en calques. Toutes les mesures sont en centièmes de la largeur de la page
// (la page fait 100 de large et PAGE_H de haut) : la même page s'affiche à l'identique sur téléphone et ordinateur.
// La dernière page porte toujours le formulaire de demande (un élément « form », unique, qui se place et se
// dimensionne comme les autres). Module sans accès à la base : servi au serveur (lien public, enregistrement) comme
// à l'éditeur.

import { sanitizeHtml } from './sanitize';
import {
  resolveItems,
  type BrochureContent, type BrochureCover, type BrochureStyle, type CatalogPrestation, type PriceOptions, type ResolvedItem,
} from './brochure';
import { parsePhotoFrame, type PhotoFrame } from './photoFrame';

/** Hauteur d'une page A4 portrait, en centièmes de sa largeur. */
export const PAGE_H = 141.4;
export const MAX_STUDIO_PAGES = 40;
export const MAX_ELEMENTS = 80;

/** Polices proposées, et ce qu'on en charge chez Google Fonts (null : présente sur l'appareil). */
export const STUDIO_FONT_AXES: Record<string, string | null> = {
  Georgia: null,
  'Playfair Display': 'ital,wght@0,400;0,700;1,400',
  'Cormorant Garamond': 'ital,wght@0,400;0,700;1,400',
  Lora: 'ital,wght@0,400;0,700;1,400',
  'Libre Baskerville': 'ital,wght@0,400;0,700;1,400',
  Montserrat: 'ital,wght@0,400;0,700;1,400',
  Poppins: 'ital,wght@0,400;0,700;1,400',
  Raleway: 'ital,wght@0,400;0,700;1,400',
  Inter: 'wght@400;700',
  Oswald: 'wght@400;700',
  'Dancing Script': 'wght@400;700',
  'Great Vibes': '',
};
export const STUDIO_FONTS = Object.keys(STUDIO_FONT_AXES);

/** Couleurs proposées en premier (direction artistique WeboDevis) ; toute couleur #rrggbb reste permise. */
export const STUDIO_SWATCHES = ['#1c2621', '#2f4a3a', '#b4502d', '#a8844f', '#5b2638', '#5b5b55', '#e6dfd3', '#ede6da', '#fbf7f0', '#ffffff', '#000000'];

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type PrestationPhoto = 'top' | 'left' | 'right' | 'none';
export type PhotoFilter = 'none' | 'bw' | 'sepia' | 'warm' | 'cool' | 'fade';
export type PhotoMask = 'none' | 'circle' | 'arch';
export type LineDash = 'solid' | 'dashed' | 'dotted' | 'double';
/** Rôle d'un texte, relié au style de la brochure (Titre 1, Titre 2, Sur-titre, Paragraphe). */
export type TextRole = 'h1' | 'h2' | 'kicker' | 'body';
export const TEXT_ROLES: TextRole[] = ['h1', 'h2', 'kicker', 'body'];
export const ROLE_LABELS: Record<TextRole, string> = { h1: 'Titre 1', h2: 'Titre 2', kicker: 'Sur-titre', body: 'Paragraphe' };

/** Pictogrammes proposés (noms lucide-react), dessinés au trait dans la couleur choisie. */
export const STUDIO_ICONS = [
  'Utensils', 'UtensilsCrossed', 'ChefHat', 'CookingPot', 'Soup', 'Salad', 'Fish', 'Beef', 'Drumstick', 'Ham', 'Egg', 'Croissant', 'Sandwich',
  'Pizza', 'Cake', 'CakeSlice', 'IceCreamCone', 'Candy', 'Cherry', 'Citrus', 'Apple', 'Grape', 'Carrot', 'Wheat', 'Leaf', 'Sprout', 'Vegan',
  'Flower', 'Flower2', 'TreePine', 'Wine', 'Martini', 'Beer', 'GlassWater', 'Coffee', 'Milk', 'Heart', 'Star', 'Sparkles', 'Diamond', 'Gem',
  'Crown', 'Feather', 'Sun', 'Moon', 'Snowflake', 'Gift', 'PartyPopper', 'Music', 'Camera', 'Award', 'Church', 'Building2', 'Handshake',
  'Briefcase', 'Users', 'Baby', 'Calendar', 'Clock', 'Truck', 'Phone', 'Mail', 'MapPin', 'Globe', 'MessageCircle', 'Instagram', 'Facebook', 'Quote',
] as const;
export type StudioIconName = (typeof STUDIO_ICONS)[number];

interface Base {
  id: string;
  /** Coin haut gauche, largeur et hauteur, en centièmes de la largeur de la page. */
  x: number; y: number; w: number; h: number;
  /** Rotation en degrés, autour du centre. */
  rot: number;
  /** Opacité, en %. */
  opacity: number;
  locked?: boolean;
  /** Éléments groupés : ils se choisissent et se déplacent ensemble. */
  group?: string;
  /** Ombre portée douce. */
  shadow?: boolean;
}

export type StudioText = Base & {
  type: 'text'; html: string; font: string; size: number; color: string; align: TextAlign; lineHeight: number;
  letterSpacing: number; uppercase: boolean; bg: string | null; padding: number; radius: number;
  /** Relié au style de la brochure : il suit ses changements tant qu'on ne le met pas en forme à la main. */
  role?: TextRole;
};
export type StudioImage = Base & {
  type: 'image'; url: string | null; frame?: PhotoFrame; radius: number; borderColor: string | null; borderWidth: number;
  filter: PhotoFilter; mask: PhotoMask;
};
export type StudioShape = Base & {
  type: 'shape'; shape: 'rect' | 'ellipse' | 'arch' | 'line'; fill: string | null; stroke: string | null; strokeWidth: number; radius: number; dash: LineDash;
};
export type StudioIcon = Base & { type: 'icon'; name: StudioIconName; color: string; strokeWidth: number };
export type StudioPrestation = Base & {
  type: 'prestation'; prestationId: string;
  show: { name: boolean; text: boolean; price: boolean };
  text: 'full' | 'short'; photo: PrestationPhoto; photoSize: number; frame?: PhotoFrame;
  font: string; size: number; color: string; accent: string; align: 'left' | 'center' | 'right'; bg: string | null; padding: number; radius: number;
  /** Le texte rapetisse pour tenir dans le cadre (jusqu'à 55 % de sa taille). */
  fit: boolean;
  /** Retouches propres à la brochure (le catalogue n'est jamais modifié). */
  html?: string; titled?: boolean; photoUrl?: string; hidePrice?: boolean;
};
export type StudioForm = Base & { type: 'form'; bg: string | null; color: string; accent: string; radius: number };

export type StudioElement = StudioText | StudioImage | StudioShape | StudioIcon | StudioPrestation | StudioForm;
export type StudioElementType = StudioElement['type'];

export interface StudioPage {
  id: string;
  /** La dernière page, celle du formulaire. */
  form?: boolean;
  bg: string;
  bgImage: { url: string; frame?: PhotoFrame; opacity: number } | null;
  /** Du fond vers le premier plan. */
  els: StudioElement[];
}
/** Allure d'un rôle de texte. */
export interface StudioTextStyle { font: string; size: number; color: string; lineHeight: number; letterSpacing: number; uppercase: boolean }
/** Thème de la brochure : fond des pages, couleur d'accent, styles de texte. */
export interface StudioTheme { name: string; bg: string; accent: string; styles: Record<TextRole, StudioTextStyle> }
/** Options du lien public. */
export interface StudioOptions {
  /** Les éléments de la page apparaissent en douceur quand elle s'affiche. */
  animate: boolean;
  /** Boutons « Appeler » et « WhatsApp » (numéro de l'entreprise) sur le lien. */
  call: boolean;
  whatsapp: boolean;
}
export interface StudioDoc { pages: StudioPage[]; theme?: StudioTheme | null; options?: StudioOptions }
export const DEFAULT_OPTIONS: StudioOptions = { animate: true, call: false, whatsapp: false };

/** Un élément Prestation tel que le lecteur le voit : le catalogue lu, sans identifiant. */
export type ResolvedStudioPrestation = Omit<StudioPrestation, 'prestationId' | 'html' | 'titled' | 'photoUrl' | 'hidePrice'> & { item: ResolvedItem };
export type ResolvedStudioElement = Exclude<StudioElement, StudioPrestation> | ResolvedStudioPrestation;
/** Une page prête à afficher ; `id` sert à suivre la lecture de la page, même déplacée. */
export interface ResolvedStudioPage { id: string; bg: string; bgImage: StudioPage['bgImage']; form: boolean; els: ResolvedStudioElement[] }

// ── Thèmes ───────────────────────────────────────────────────────────────────

const style = (font: string, size: number, color: string, extra: Partial<StudioTextStyle> = {}): StudioTextStyle =>
  ({ font, size, color, lineHeight: 1.3, letterSpacing: 0, uppercase: false, ...extra });

/** Thèmes proposés : un clic les applique à toute la brochure. */
export const THEMES: StudioTheme[] = [
  {
    name: 'Sapin et terracotta', bg: '#fbf7f0', accent: '#b4502d', styles: {
      h1: style('Playfair Display', 8, '#1c2621', { lineHeight: 1.1 }), h2: style('Playfair Display', 5, '#1c2621', { lineHeight: 1.15 }),
      kicker: style('Montserrat', 2.8, '#b4502d', { uppercase: true, letterSpacing: 0.18 }), body: style('Georgia', 3.4, '#1c2621', { lineHeight: 1.5 }),
    },
  },
  {
    name: 'Noir et or', bg: '#151515', accent: '#c9a45c', styles: {
      h1: style('Cormorant Garamond', 9, '#f3ece0', { lineHeight: 1.05 }), h2: style('Cormorant Garamond', 5.5, '#f3ece0', { lineHeight: 1.15 }),
      kicker: style('Montserrat', 2.6, '#c9a45c', { uppercase: true, letterSpacing: 0.25 }), body: style('Raleway', 3.2, '#d9d2c5', { lineHeight: 1.55 }),
    },
  },
  {
    name: 'Champêtre', bg: '#f4efe6', accent: '#5f6e52', styles: {
      h1: style('Lora', 8, '#33402c', { lineHeight: 1.1 }), h2: style('Lora', 5, '#33402c', { lineHeight: 1.15 }),
      kicker: style('Dancing Script', 4.2, '#5f6e52'), body: style('Raleway', 3.3, '#3d3d36', { lineHeight: 1.55 }),
    },
  },
  {
    name: 'Poudré', bg: '#fdf4f1', accent: '#c47a86', styles: {
      h1: style('Great Vibes', 11, '#5b2638', { lineHeight: 1.05 }), h2: style('Playfair Display', 5, '#5b2638', { lineHeight: 1.15 }),
      kicker: style('Montserrat', 2.6, '#c47a86', { uppercase: true, letterSpacing: 0.2 }), body: style('Lora', 3.3, '#4a3b3f', { lineHeight: 1.55 }),
    },
  },
  {
    name: 'Épuré', bg: '#ffffff', accent: '#1c2621', styles: {
      h1: style('Oswald', 8.5, '#111111', { lineHeight: 1.05, uppercase: true, letterSpacing: 0.02 }), h2: style('Oswald', 5, '#111111', { lineHeight: 1.1 }),
      kicker: style('Inter', 2.6, '#6b6b6b', { uppercase: true, letterSpacing: 0.22 }), body: style('Inter', 3.1, '#333333', { lineHeight: 1.6 }),
    },
  },
];

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
export const isDark = (hex: string) => luminance(hex) < 0.5;
/** Couleur vive (ni noire, ni grise, ni blanche) : une couleur d'accent. */
const isAccent = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(...c) - Math.min(...c) > 60;
};

/** Le rôle le plus probable d'un texte sans rôle (pour appliquer un thème). */
export function guessRole(t: Pick<StudioText, 'size' | 'uppercase'>): TextRole {
  if (t.uppercase && t.size < 4) return 'kicker';
  if (t.size >= 6.5) return 'h1';
  if (t.size >= 4.4) return 'h2';
  return 'body';
}

/** Une page « habillée par le thème » : sans photo de fond ni photo pleine page. */
function themedPage(p: StudioPage): boolean {
  return !p.bgImage && !p.els.some((e) => e.type === 'image' && e.url && e.x <= 1 && e.y <= 1 && e.w >= 99 && e.h >= PAGE_H - 1);
}

/** Les textes reliés à un rôle reprennent son style (couleur comprise sur les pages habillées par le thème). */
export function applyRoleStyles(doc: StudioDoc, theme: StudioTheme): StudioDoc {
  return {
    ...doc,
    pages: doc.pages.map((p) => {
      const themed = themedPage(p);
      return {
        ...p,
        els: p.els.map((e) => {
          if (e.type !== 'text' || !e.role) return e;
          const { color, ...st } = theme.styles[e.role];
          return { ...e, ...st, ...(themed ? { color } : {}) };
        }),
      };
    }),
  };
}

/**
 * Applique un thème à toute la brochure : fond des pages habillées, rôle donné à chaque texte (deviné s'il n'en a
 * pas) et son style, police et couleurs des prestations, couleur d'accent des traits, pictogrammes et formulaire.
 */
export function applyTheme(doc: StudioDoc, theme: StudioTheme): StudioDoc {
  const pages = doc.pages.map((p) => {
    const themed = themedPage(p);
    return {
      ...p,
      bg: themed ? theme.bg : p.bg,
      els: p.els.map((e): StudioElement => {
        switch (e.type) {
          case 'text': return { ...e, role: e.role ?? guessRole(e) };
          case 'prestation': return { ...e, font: theme.styles.body.font, accent: theme.accent, ...(themed ? { color: theme.styles.body.color } : {}) };
          case 'shape': return themed && e.stroke && isAccent(e.stroke) ? { ...e, stroke: theme.accent } : e;
          case 'icon': return themed ? { ...e, color: theme.accent } : e;
          case 'form': return { ...e, accent: theme.accent, ...(themed && isDark(theme.bg) ? { bg: '#ffffff', color: '#1c2621' } : {}) };
          default: return e;
        }
      }),
    };
  });
  return applyRoleStyles({ ...doc, pages, theme }, theme);
}

export const newElementId = () => `e${Math.random().toString(36).slice(2, 10)}`;
export const newStudioPageId = () => `q${Math.random().toString(36).slice(2, 10)}`;

// ── Lecture ──────────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;
const color = (v: unknown, fallback: string): string => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);
const colorOrNull = (v: unknown): string | null => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : null);
const num = (v: unknown, min: number, max: number, fallback: number, step = 0.1) => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)) / step) * step;
};
const round = (n: number) => Math.round(n * 10) / 10;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const font = (v: unknown) => (typeof v === 'string' && STUDIO_FONTS.includes(v) ? v : 'Georgia');
const url = (v: unknown) => (typeof v === 'string' && /^https?:\/\//.test(v) && v.length < 2000 ? v : null);

function parseBase(r: Record<string, unknown>): Base {
  const w = num(r.w, 2, 300, 40);
  const h = num(r.h, 0.5, 400, 20);
  return {
    id: str(r.id, 40) || newElementId(),
    x: num(r.x, -w + 1, 99, 10), y: num(r.y, -h + 1, PAGE_H - 1, 10), w, h,
    rot: num(r.rot, -180, 180, 0, 0.5), opacity: num(r.opacity, 0, 100, 100, 1),
    ...(r.locked === true ? { locked: true } : {}),
    ...(str(r.group, 40) ? { group: str(r.group, 40)! } : {}),
    ...(r.shadow === true ? { shadow: true } : {}),
  };
}

function parseElement(raw: unknown): StudioElement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = parseBase(r);
  switch (r.type) {
    case 'text':
      return {
        ...base, type: 'text', html: str(r.html, 20000) ?? '', font: font(r.font), size: num(r.size, 1, 30, 4),
        color: color(r.color, '#1c2621'), align: pick(r.align, ['left', 'center', 'right', 'justify'] as const, 'left'),
        lineHeight: num(r.lineHeight, 0.8, 3, 1.3, 0.05), letterSpacing: num(r.letterSpacing, -0.1, 1, 0, 0.01),
        uppercase: r.uppercase === true, bg: colorOrNull(r.bg), padding: num(r.padding, 0, 20, 0), radius: num(r.radius, 0, 50, 0),
        ...(TEXT_ROLES.includes(r.role as TextRole) ? { role: r.role as TextRole } : {}),
      };
    case 'image': {
      const frame = parsePhotoFrame(r.frame);
      return {
        ...base, type: 'image', url: url(r.url), ...(frame ? { frame } : {}), radius: num(r.radius, 0, 50, 0),
        borderColor: colorOrNull(r.borderColor), borderWidth: num(r.borderWidth, 0, 5, 0),
        filter: pick(r.filter, ['none', 'bw', 'sepia', 'warm', 'cool', 'fade'] as const, 'none'),
        mask: pick(r.mask, ['none', 'circle', 'arch'] as const, 'none'),
      };
    }
    case 'shape':
      return {
        ...base, type: 'shape', shape: pick(r.shape, ['rect', 'ellipse', 'arch', 'line'] as const, 'rect'),
        fill: colorOrNull(r.fill), stroke: colorOrNull(r.stroke), strokeWidth: num(r.strokeWidth, 0, 10, 0), radius: num(r.radius, 0, 50, 0),
        dash: pick(r.dash, ['solid', 'dashed', 'dotted', 'double'] as const, 'solid'),
      };
    case 'icon':
      return {
        ...base, type: 'icon', name: pick(r.name, STUDIO_ICONS, 'Heart'), color: color(r.color, '#b4502d'),
        strokeWidth: num(r.strokeWidth, 0.5, 3, 1.5, 0.25),
      };
    case 'prestation': {
      const prestationId = str(r.prestationId, 60);
      if (!prestationId) return null;
      const show = (r.show && typeof r.show === 'object' ? r.show : {}) as Record<string, unknown>;
      const frame = parsePhotoFrame(r.frame);
      const photoUrl = url(r.photoUrl);
      return {
        ...base, type: 'prestation', prestationId,
        show: { name: show.name !== false, text: show.text !== false, price: show.price !== false },
        text: pick(r.text, ['full', 'short'] as const, 'short'), photo: pick(r.photo, ['top', 'left', 'right', 'none'] as const, 'top'),
        photoSize: num(r.photoSize, 20, 80, 45, 1), ...(frame ? { frame } : {}),
        font: font(r.font), size: num(r.size, 1, 12, 3.2), color: color(r.color, '#1c2621'), accent: color(r.accent, '#b4502d'),
        align: pick(r.align, ['left', 'center', 'right'] as const, 'left'), bg: colorOrNull(r.bg), padding: num(r.padding, 0, 20, 0),
        radius: num(r.radius, 0, 50, 0), fit: r.fit !== false,
        ...(str(r.html, 20000) ? { html: str(r.html, 20000)! } : {}),
        ...(r.titled === true ? { titled: true } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        ...(r.hidePrice === true ? { hidePrice: true } : {}),
      };
    }
    case 'form':
      return {
        ...base, type: 'form', bg: colorOrNull(r.bg), color: color(r.color, '#1c2621'), accent: color(r.accent, '#b4502d'),
        radius: num(r.radius, 0, 50, 0),
      };
    default: return null;
  }
}

function parsePage(raw: unknown): StudioPage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bgImage = r.bgImage && typeof r.bgImage === 'object' ? r.bgImage as Record<string, unknown> : null;
  const bgUrl = bgImage ? url(bgImage.url) : null;
  const frame = bgImage ? parsePhotoFrame(bgImage.frame) : null;
  return {
    id: str(r.id, 40) || newStudioPageId(),
    ...(r.form === true ? { form: true } : {}),
    bg: color(r.bg, '#fbf7f0'),
    bgImage: bgUrl ? { url: bgUrl, ...(frame ? { frame } : {}), opacity: num(bgImage!.opacity, 0, 100, 100, 1) } : null,
    els: (Array.isArray(r.els) ? r.els : []).map(parseElement).filter((e): e is StudioElement => !!e),
  };
}

/** Une page de formulaire neuve : le titre et le formulaire, centrés. */
export function formPage(o: { language?: 'fr' | 'en'; bg?: string } = {}): StudioPage {
  return {
    id: newStudioPageId(), form: true, bg: o.bg ?? '#fbf7f0', bgImage: null,
    els: [
      textEl({ x: 10, y: 10, w: 80, h: 10, html: `<p>${o.language === 'en' ? 'Your request' : 'Votre demande'}</p>`, size: 7, font: 'Playfair Display', align: 'center' }),
      { ...baseEl(10, 26, 80, 104), type: 'form', bg: '#ffffff', color: '#1c2621', accent: '#b4502d', radius: 2 },
    ],
  };
}

/**
 * Document lu en base ou envoyé par l'éditeur, nettoyé et remis dans les règles : la page du formulaire en dernier,
 * avec un seul formulaire, et aucun formulaire ailleurs. Null s'il est illisible.
 */
export function parseStudio(raw: unknown): StudioDoc | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).pages)) return null;
  const pages = ((raw as { pages: unknown[] }).pages).map(parsePage).filter((p): p is StudioPage => !!p);
  let formAt = pages.findIndex((p) => p.form);
  if (formAt < 0) { pages.push(formPage()); formAt = pages.length - 1; }
  const [form] = pages.splice(formAt, 1);
  const rest = pages.map(({ form: _f, ...p }) => ({ ...p, els: p.els.filter((e) => e.type !== 'form') }));
  let seen = false;
  const formEls = form.els.filter((e) => e.type !== 'form' || (!seen && (seen = true)));
  if (!seen) formEls.push({ ...baseEl(10, 26, 80, 104), type: 'form', bg: '#ffffff', color: '#1c2621', accent: '#b4502d', radius: 2 });
  const r = raw as Record<string, unknown>;
  const theme = parseTheme(r.theme);
  const o = (r.options && typeof r.options === 'object' ? r.options : {}) as Record<string, unknown>;
  return {
    pages: [...rest, { ...form, form: true, els: formEls }],
    theme,
    options: { animate: o.animate !== false, call: o.call === true, whatsapp: o.whatsapp === true },
  };
}

function parseTheme(raw: unknown): StudioTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const st = (r.styles && typeof r.styles === 'object' ? r.styles : {}) as Record<string, unknown>;
  const base = THEMES[0];
  const styles = Object.fromEntries(TEXT_ROLES.map((role) => {
    const x = (st[role] && typeof st[role] === 'object' ? st[role] : {}) as Record<string, unknown>;
    const d = base.styles[role];
    return [role, {
      font: typeof x.font === 'string' && STUDIO_FONTS.includes(x.font) ? x.font : d.font, size: num(x.size, 1, 30, d.size),
      color: color(x.color, d.color), lineHeight: num(x.lineHeight, 0.8, 3, d.lineHeight, 0.05),
      letterSpacing: num(x.letterSpacing, -0.1, 1, d.letterSpacing, 0.01), uppercase: x.uppercase === true,
    }];
  })) as Record<TextRole, StudioTextStyle>;
  return { name: str(r.name, 60) ?? 'Personnalisé', bg: color(r.bg, base.bg), accent: color(r.accent, base.accent), styles };
}

/** Ce que le serveur refuse d'enregistrer, ou null. */
export function studioError(doc: StudioDoc): string | null {
  if (doc.pages.length > MAX_STUDIO_PAGES) return `Une brochure a ${MAX_STUDIO_PAGES} pages au plus.`;
  if (doc.pages.some((p) => p.els.length > MAX_ELEMENTS)) return `Une page porte ${MAX_ELEMENTS} éléments au plus.`;
  return null;
}

/** Textes riches (textes, retouches de prestation) passés au nettoyage. */
export function sanitizeStudio(doc: StudioDoc): StudioDoc {
  return {
    pages: doc.pages.map((p) => ({
      ...p,
      els: p.els.map((e) => (e.type === 'text' ? { ...e, html: sanitizeHtml(e.html) }
        : e.type === 'prestation' && e.html ? { ...e, html: sanitizeHtml(e.html) } : e)),
    })),
  };
}

/** Polices de la liste citées dans le HTML d'un texte (police choisie sur une partie du texte). */
function htmlFonts(html: string | undefined): string[] {
  const decls = (html ?? '').replace(/&quot;|&#39;/g, "'").match(/font-family\s*:[^;"<>]*|face="[^"]*"/gi) ?? [];
  return STUDIO_FONTS.filter((f) => decls.some((d) => d.includes(f)));
}

/** Polices utilisées par un document, pour les charger. */
export function studioFonts(doc: StudioDoc | null): string[] {
  if (!doc) return [];
  const fonts = doc.pages.flatMap((p) => p.els.flatMap((e) => (
    e.type === 'text' ? [e.font, ...htmlFonts(e.html)] : e.type === 'prestation' ? [e.font, ...htmlFonts(e.html)] : [])));
  return [...new Set(fonts)];
}

/** Feuille Google Fonts des polices données, ou null si toutes sont sur l'appareil. */
export function studioFontsHref(fonts: string[]): string | null {
  const families = [...new Set(fonts)].filter((f) => STUDIO_FONT_AXES[f] != null)
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}${STUDIO_FONT_AXES[f] ? `:${STUDIO_FONT_AXES[f]}` : ''}`);
  return families.length ? `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap` : null;
}

/** Prestations citées. */
export function studioPrestationIds(doc: StudioDoc): string[] {
  return [...new Set(doc.pages.flatMap((p) => p.els.flatMap((e) => (e.type === 'prestation' ? [e.prestationId] : []))))];
}

/** Photos citées (galerie des photos déjà utilisées). */
export function studioPhotos(doc: StudioDoc): string[] {
  return doc.pages.flatMap((p) => [
    ...(p.bgImage ? [p.bgImage.url] : []),
    ...p.els.flatMap((e) => (e.type === 'image' && e.url ? [e.url] : e.type === 'prestation' && e.photoUrl ? [e.photoUrl] : [])),
  ]);
}

/**
 * Pages prêtes à afficher : chaque prestation lue dans le catalogue (texte, photo, prix). Pour le lien public, une
 * prestation supprimée du catalogue disparaît ; dans l'éditeur, elle est signalée.
 */
export function resolveStudio(doc: StudioDoc, catalog: ReadonlyMap<string, CatalogPrestation>, o: PriceOptions & { forEditor: boolean }): ResolvedStudioPage[] {
  let n = 0;
  return doc.pages.map((p) => ({
    id: p.id, bg: p.bg, bgImage: p.bgImage, form: !!p.form,
    els: p.els.flatMap((e): ResolvedStudioElement[] => {
      if (e.type !== 'prestation') return [e];
      const { prestationId, html, titled, photoUrl, hidePrice, ...rest } = e;
      const [item] = resolveItems({ id: '', title: '', items: [{ prestationId, html, titled, photoUrl, hidePrice }] }, catalog, o, n++);
      return item ? [{ ...rest, item }] : [];
    }),
  }));
}

// ── Création ─────────────────────────────────────────────────────────────────

const baseEl = (x: number, y: number, w: number, h: number): Base => ({ id: newElementId(), x, y, w, h, rot: 0, opacity: 100 });

export function textEl(o: Partial<Omit<StudioText, 'type'>> & { x: number; y: number; w: number; html: string }): StudioText {
  return {
    ...baseEl(o.x, o.y, o.w, o.h ?? 8), font: 'Georgia', size: 4, color: '#1c2621', align: 'left', lineHeight: 1.3, letterSpacing: 0,
    uppercase: false, bg: null, padding: 0, radius: 0, ...o, type: 'text',
  };
}
export function imageEl(o: Partial<Omit<StudioImage, 'type'>> & { x: number; y: number; w: number; h: number }): StudioImage {
  return { ...baseEl(o.x, o.y, o.w, o.h), url: null, radius: 0, borderColor: null, borderWidth: 0, filter: 'none', mask: 'none', ...o, type: 'image' };
}
export function shapeEl(o: Partial<Omit<StudioShape, 'type'>> & { x: number; y: number; w: number; h: number }): StudioShape {
  return { ...baseEl(o.x, o.y, o.w, o.h), shape: 'rect', fill: '#e6dfd3', stroke: null, strokeWidth: 0, radius: 0, dash: 'solid', ...o, type: 'shape' };
}
export function iconEl(o: Partial<Omit<StudioIcon, 'type'>> & { x: number; y: number; w: number; name: StudioIconName }): StudioIcon {
  return { ...baseEl(o.x, o.y, o.w, o.h ?? o.w), color: '#b4502d', strokeWidth: 1.5, ...o, type: 'icon' };
}
export function prestationEl(o: Partial<Omit<StudioPrestation, 'type'>> & { x: number; y: number; w: number; h: number; prestationId: string }): StudioPrestation {
  return {
    ...baseEl(o.x, o.y, o.w, o.h), show: { name: true, text: true, price: true }, text: 'short', photo: 'top', photoSize: 45,
    font: 'Georgia', size: 3.2, color: '#1c2621', accent: '#b4502d', align: 'left', bg: null, padding: 0, radius: 0, fit: true, ...o, type: 'prestation',
  };
}

export const blankPage = (bg = '#fbf7f0'): StudioPage => ({ id: newStudioPageId(), bg, bgImage: null, els: [] });

/** Copie d'une page (ou d'un élément) avec de nouveaux identifiants. */
export function clonePage(p: StudioPage): StudioPage {
  return { ...structuredClone(p), id: newStudioPageId(), form: undefined, els: p.els.filter((e) => e.type !== 'form').map(cloneElement) };
}
export const cloneElement = <E extends StudioElement>(e: E): E => ({ ...structuredClone(e), id: newElementId() });

export interface TemplateContext {
  title: string;
  subtitle: string | null;
  photoUrl: string | null;
  photoFrame?: PhotoFrame | null;
  company: { name: string; address: string | null; phone: string | null; email: string | null; website: string | null; logoUrl?: string | null };
  language: 'fr' | 'en';
}

/** Le logo de l'entreprise, entier (sans recadrage), centré à `y`. */
export const logoEl = (url: string, y: number, w = 24, h = 14) => imageEl({ x: (100 - w) / 2, y, w, h, url, frame: { x: 50, y: 50, zoom: 100, fit: 'contain' } });

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface PageTemplate { id: string; label: string; make: (c: TemplateContext, prestationIds: string[]) => StudioPage }

/** Modèles de pages proposés dans le panneau « Modèles ». */
export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'cover-photo', label: 'Couverture photo',
    make: (c) => ({
      ...blankPage('#2f4a3a'),
      els: [
        imageEl({ x: 0, y: 0, w: 100, h: PAGE_H, url: c.photoUrl, ...(c.photoFrame ? { frame: c.photoFrame } : {}) }),
        shapeEl({ x: 0, y: 86, w: 100, h: PAGE_H - 86, fill: '#1c2621', opacity: 72 }),
        ...(c.subtitle ? [textEl({ x: 8, y: 94, w: 84, html: `<p>${esc(c.subtitle)}</p>`, size: 2.8, color: '#f1d3c2', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' })] : []),
        textEl({ x: 8, y: 101, w: 84, h: 22, html: `<p>${esc(c.title)}</p>`, size: 9, color: '#ffffff', font: 'Playfair Display', lineHeight: 1.1 }),
        textEl({ x: 8, y: 126, w: 84, html: `<p>${esc(c.company.name)}</p>`, size: 3.4, color: '#ffffff', opacity: 85 }),
      ],
    }),
  },
  {
    id: 'cover-elegant', label: 'Couverture élégante',
    make: (c) => ({
      ...blankPage('#fbf7f0'),
      els: [
        shapeEl({ x: 6, y: 6, w: 88, h: PAGE_H - 12, fill: null, stroke: '#a8844f', strokeWidth: 0.4 }),
        ...(url(c.company.logoUrl) ? [logoEl(c.company.logoUrl!, 24)] : []),
        ...(c.subtitle ? [textEl({ x: 15, y: 46, w: 70, html: `<p>${esc(c.subtitle)}</p>`, size: 2.8, color: '#b4502d', align: 'center', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' })] : []),
        textEl({ x: 12, y: 54, w: 76, h: 24, html: `<p>${esc(c.title)}</p>`, size: 9, align: 'center', font: 'Playfair Display', lineHeight: 1.1 }),
        shapeEl({ x: 45, y: 84, w: 10, h: 0.6, shape: 'line', stroke: '#b4502d', strokeWidth: 0.3, fill: null }),
        textEl({ x: 15, y: 90, w: 70, html: `<p>${esc(c.company.name)}</p>`, size: 3.4, align: 'center', color: '#5b5b55' }),
      ],
    }),
  },
  {
    id: 'cover-split', label: 'Couverture moitié photo',
    make: (c) => ({
      ...blankPage('#fbf7f0'),
      els: [
        imageEl({ x: 0, y: 0, w: 100, h: 86, url: c.photoUrl, ...(c.photoFrame ? { frame: c.photoFrame } : {}) }),
        ...(c.subtitle ? [textEl({ x: 8, y: 95, w: 84, html: `<p>${esc(c.subtitle)}</p>`, size: 2.8, color: '#b4502d', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' })] : []),
        textEl({ x: 8, y: 102, w: 84, h: 20, html: `<p>${esc(c.title)}</p>`, size: 8, font: 'Playfair Display', lineHeight: 1.1 }),
        textEl({ x: 8, y: 126, w: 84, html: `<p>${esc(c.company.name)}</p>`, size: 3.4, color: '#5b5b55' }),
      ],
    }),
  },
  {
    id: 'one-prestation', label: 'Une prestation en grand',
    make: (_c, ids) => ({
      ...blankPage('#fbf7f0'),
      els: ids[0]
        ? [prestationEl({ x: 8, y: 8, w: 84, h: 125, prestationId: ids[0], text: 'full', photoSize: 60, align: 'center', size: 3.6 })]
        : [imageEl({ x: 8, y: 8, w: 84, h: 70 }), textEl({ x: 8, y: 84, w: 84, html: '<p>Titre</p>', size: 6, align: 'center', font: 'Playfair Display' })],
    }),
  },
  {
    id: 'two-prestations', label: 'Deux prestations',
    make: (_c, ids) => ({
      ...blankPage('#fbf7f0'),
      els: [0, 1].map((i) => (ids[i]
        ? prestationEl({ x: 7, y: 7 + i * 66, w: 86, h: 60, prestationId: ids[i], photo: i ? 'right' : 'left', photoSize: 45 })
        : imageEl({ x: 7, y: 7 + i * 66, w: 86, h: 60 }))),
    }),
  },
  {
    id: 'menu-list', label: 'Carte (liste)',
    make: (c, ids) => ({
      ...blankPage('#fbf7f0'),
      els: [
        textEl({ x: 8, y: 8, w: 84, html: `<p>${c.language === 'en' ? 'Our menu' : 'Notre carte'}</p>`, size: 7, font: 'Playfair Display', align: 'center' }),
        shapeEl({ x: 45, y: 20, w: 10, h: 0.6, shape: 'line', stroke: '#b4502d', strokeWidth: 0.3, fill: null }),
        ...ids.slice(0, 5).map((id, i) => prestationEl({ x: 8, y: 26 + i * 22, w: 84, h: 20, prestationId: id, photo: 'none', size: 3 })),
      ],
    }),
  },
  {
    id: 'text-photo', label: 'Texte et photo',
    make: (c) => ({
      ...blankPage('#fbf7f0'),
      els: [
        textEl({ x: 8, y: 10, w: 84, html: `<p>${c.language === 'en' ? 'About us' : 'Qui sommes-nous'}</p>`, size: 2.8, color: '#b4502d', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' }),
        textEl({ x: 8, y: 17, w: 84, h: 14, html: '<p>Une cuisine de saison, faite maison</p>', size: 6.5, font: 'Playfair Display', lineHeight: 1.15 }),
        imageEl({ x: 8, y: 36, w: 84, h: 52, url: c.photoUrl }),
        textEl({ x: 8, y: 94, w: 84, h: 38, html: '<p>Racontez votre histoire, votre équipe, ce qui rend votre cuisine unique.</p>', size: 3.4, color: '#5b5b55', lineHeight: 1.5 }),
      ],
    }),
  },
  {
    id: 'gallery', label: 'Galerie de 4 photos',
    make: () => ({
      ...blankPage('#fbf7f0'),
      els: [0, 1, 2, 3].map((i) => imageEl({ x: 6 + (i % 2) * 45, y: 8 + Math.floor(i / 2) * 64, w: 43, h: 61, radius: 1 })),
    }),
  },
  {
    id: 'quote', label: 'Citation',
    make: () => ({
      ...blankPage('#2f4a3a'),
      els: [
        textEl({ x: 12, y: 44, w: 76, h: 30, html: '<p>« Une cuisine généreuse, pensée pour vos plus beaux moments. »</p>', size: 6, color: '#ffffff', align: 'center', font: 'Cormorant Garamond', lineHeight: 1.25 }),
        shapeEl({ x: 45, y: 82, w: 10, h: 0.6, shape: 'line', stroke: '#f1d3c2', strokeWidth: 0.3, fill: null }),
      ],
    }),
  },
  {
    id: 'contact', label: 'Contact',
    make: (c) => ({
      ...blankPage('#fbf7f0'),
      els: [
        ...(url(c.company.logoUrl) ? [logoEl(c.company.logoUrl!, 20, 30, 16)] : []),
        textEl({ x: 10, y: 40, w: 80, html: `<p>${c.language === 'en' ? 'Contact us' : 'Nous contacter'}</p>`, size: 2.8, color: '#b4502d', align: 'center', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' }),
        textEl({ x: 10, y: 48, w: 80, h: 10, html: `<p>${esc(c.company.name)}</p>`, size: 6, align: 'center', font: 'Playfair Display' }),
        textEl({
          x: 10, y: 62, w: 80, h: 30, align: 'center', size: 3.4, color: '#5b5b55', lineHeight: 1.6,
          html: [c.company.address, c.company.phone, c.company.email, c.company.website].filter(Boolean).map((l) => `<p>${esc(l!)}</p>`).join('') || '<p>Vos coordonnées</p>',
        }),
      ],
    }),
  },
  { id: 'blank', label: 'Page vierge', make: () => blankPage() },
];

const template = (id: string) => PAGE_TEMPLATES.find((t) => t.id === id)!;

/**
 * Premier document du Studio, à partir de ce que la brochure contient déjà : la couverture, « qui sommes-nous »,
 * les prestations deux par deux (photo à gauche puis à droite), le contact et le formulaire. Tout reste déplaçable.
 */
export function studioFromBrochure(
  content: BrochureContent, cover: BrochureCover, style: BrochureStyle,
  ctx: Omit<TemplateContext, 'title' | 'subtitle' | 'photoUrl' | 'photoFrame'>,
): StudioDoc {
  const c: TemplateContext = { ...ctx, title: cover.title, subtitle: cover.subtitle ?? null, photoUrl: cover.photoUrl ?? null, photoFrame: cover.photoFrame ?? null };
  const pages: StudioPage[] = [template(style === 'carte' || !c.photoUrl ? 'cover-elegant' : style === 'magazine' ? 'cover-split' : 'cover-photo').make(c, [])];
  if (content.about.enabled) {
    const photo = content.about.photoUrl ?? null;
    pages.push({
      ...blankPage(),
      els: [
        textEl({ x: 8, y: 9, w: 84, html: `<p>${c.language === 'en' ? 'About us' : 'Qui sommes-nous'}</p>`, size: 2.8, color: '#b4502d', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' }),
        ...(photo ? [imageEl({ x: 8, y: 17, w: 84, h: 58, url: photo, ...(content.about.photoFrame ? { frame: content.about.photoFrame } : {}) })] : []),
        textEl({ x: 8, y: photo ? 81 : 18, w: 84, h: 50, html: content.about.html || '<p>Racontez votre histoire.</p>', size: 3.4, lineHeight: 1.5 }),
      ],
    });
  }
  for (const section of content.sections) {
    for (let i = 0; i < section.items.length; i += 2) {
      const page = blankPage();
      const top = i === 0 && section.title ? 12 : 0;
      if (top) page.els.push(textEl({ x: 7, y: 6, w: 86, html: `<p>${esc(section.title)}</p>`, size: 2.8, color: '#b4502d', uppercase: true, letterSpacing: 0.18, font: 'Montserrat' }));
      section.items.slice(i, i + 2).forEach((item, k) => {
        page.els.push(prestationEl({
          x: 7, y: 7 + top + k * ((PAGE_H - 14 - top) / 2), w: 86, h: (PAGE_H - 14 - top) / 2 - 6, prestationId: item.prestationId,
          photo: k ? 'right' : 'left', photoSize: 45, text: style === 'editorial' ? 'full' : 'short',
          ...(item.html ? { html: item.html } : {}), ...(item.titled ? { titled: true } : {}),
          ...(item.photoUrl ? { photoUrl: item.photoUrl } : {}), ...(item.hidePrice ? { hidePrice: true } : {}),
          ...(item.frame ? { frame: item.frame } : {}),
        }));
      });
      pages.push(page);
    }
  }
  if (content.contact.enabled) pages.push(template('contact').make(c, []));
  pages.push(formPage({ language: ctx.language }));
  return { pages: pages.map((p) => ({ ...p, els: p.els.map((e) => ({ ...e, x: round(e.x), y: round(e.y), w: round(e.w), h: round(e.h) })) })) };
}

// ── Brochures complètes ──────────────────────────────────────────────────────

export type BrochureKind = 'mariage' | 'entreprise' | 'cocktail';
export const BROCHURE_KINDS: { id: BrochureKind; label: string; hint: string; theme: string }[] = [
  { id: 'mariage', label: 'Mariage', hint: 'Couverture photo, promesse, menus deux par page, citation, galerie, contact.', theme: 'Poudré' },
  { id: 'entreprise', label: 'Entreprise', hint: 'Sobre : présentation, carte en liste, contact.', theme: 'Épuré' },
  { id: 'cocktail', label: 'Cocktail et réception', hint: 'Chic : une prestation en grand par page, citation, contact.', theme: 'Noir et or' },
];

const INTRO: Record<BrochureKind, { kicker: string; title: string; body: string; quote: string }> = {
  mariage: {
    kicker: 'Notre promesse', title: 'Un jour unique, une cuisine à votre image',
    body: 'Nous imaginons avec vous un repas qui vous ressemble, du cocktail au dessert, avec des produits de saison et un service attentif.',
    quote: '« Le plus beau jour mérite la plus belle table. »',
  },
  entreprise: {
    kicker: 'Événements professionnels', title: 'Séminaires, cocktails, repas d’équipe',
    body: 'Des formules claires, livrées à l’heure et servies avec soin, pour recevoir vos clients et vos équipes en toute sérénité.',
    quote: '« Recevoir, c’est déjà convaincre. »',
  },
  cocktail: {
    kicker: 'Cocktails et réceptions', title: 'L’art de recevoir',
    body: 'Pièces cocktail, ateliers et douceurs : une réception élégante et généreuse, pensée pour vos invités.',
    quote: '« Une bouchée, un sourire, un souvenir. »',
  },
};

/** Une brochure entière, prête à personnaliser, avec le thème du genre choisi. */
export function brochureFromKind(kind: BrochureKind, c: TemplateContext, prestationIds: string[]): StudioDoc {
  const t = (id: string) => PAGE_TEMPLATES.find((x) => x.id === id)!;
  const intro = INTRO[kind];
  const pages: StudioPage[] = [t(kind === 'entreprise' ? 'cover-split' : c.photoUrl ? 'cover-photo' : 'cover-elegant').make(c, [])];
  pages.push({
    ...blankPage(),
    els: [
      textEl({ x: 10, y: 34, w: 80, html: `<p>${esc(intro.kicker)}</p>`, size: 2.8, uppercase: true, letterSpacing: 0.18, align: 'center', color: '#b4502d' }),
      textEl({ x: 10, y: 42, w: 80, h: 22, html: `<p>${esc(intro.title)}</p>`, size: 7, align: 'center', lineHeight: 1.1 }),
      shapeEl({ x: 45, y: 70, w: 10, h: 0.6, shape: 'line', stroke: '#b4502d', strokeWidth: 0.3, fill: null }),
      textEl({ x: 14, y: 76, w: 72, h: 30, html: `<p>${esc(intro.body)}</p>`, size: 3.4, align: 'center', lineHeight: 1.55 }),
    ],
  });
  const ids = prestationIds.slice(0, 18);
  if (kind === 'entreprise') {
    for (let i = 0; i < ids.length; i += 5) pages.push(t('menu-list').make(c, ids.slice(i, i + 5)));
  } else if (kind === 'cocktail') {
    ids.forEach((id) => pages.push(t('one-prestation').make(c, [id])));
  } else {
    for (let i = 0; i < ids.length; i += 2) {
      const page = t('two-prestations').make(c, ids.slice(i, i + 2));
      if (ids.length - i === 1) page.els = page.els.slice(0, 1);
      pages.push(page);
    }
  }
  const quote = t('quote').make(c, []);
  quote.els = quote.els.map((e) => (e.type === 'text' ? { ...e, html: `<p>${esc(intro.quote)}</p>` } : e));
  pages.push(quote);
  if (kind === 'mariage') pages.push(t('gallery').make(c, []));
  pages.push(t('contact').make(c, []));
  pages.push(formPage({ language: c.language }));
  const theme = THEMES.find((x) => x.name === BROCHURE_KINDS.find((k) => k.id === kind)!.theme) ?? THEMES[0];
  return applyTheme({ pages, options: DEFAULT_OPTIONS }, theme);
}

/** Numéro pour WhatsApp (format international sans « + ») ; un numéro français 0X… devient 33X…. */
export function whatsappNumber(phone: string): string | null {
  let d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0\d{9}$/.test(d)) d = `33${d.slice(1)}`;
  return /^\d{8,15}$/.test(d) ? d : null;
}

