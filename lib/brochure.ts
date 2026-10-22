// ═══════════════════════════════════════════════════════════════════════════
// Brochures : contenu, prix et mise en pages (voir docs/superpowers/specs/2026-10-22-brochures-design.md)
// ═══════════════════════════════════════════════════════════════════════════
// Une brochure référence des prestations du catalogue par identifiant, avec à côté ses retouches propres (texte,
// photo, prix masqué) : le catalogue n'est jamais modifié, et prix et photos restent à jour. Ce module, sans accès
// à la base, sert au serveur (lien public) comme à l'éditeur (aperçu) : les deux voient les mêmes pages.

import { sanitizeHtml } from './sanitize';

export type BrochureStyle = 'editorial' | 'carte' | 'magazine';
export const BROCHURE_STYLES: BrochureStyle[] = ['editorial', 'carte', 'magazine'];
export const STYLE_LABELS: Record<BrochureStyle, string> = { editorial: 'Éditorial', carte: 'Carte', magazine: 'Magazine' };

export interface BrochureItem {
  prestationId: string;
  /** Texte propre à la brochure (sinon celui du catalogue). */
  html?: string | null;
  /** Photo propre à la brochure (sinon celle de la prestation). */
  photoUrl?: string | null;
  hidePrice?: boolean;
}

export interface BrochureSection { id: string; title: string; items: BrochureItem[] }

export interface BrochureContent {
  about: { enabled: boolean; html: string; photoUrl?: string | null };
  contact: { enabled: boolean };
  sections: BrochureSection[];
}

export interface BrochureCover { title: string; subtitle?: string | null; photoUrl?: string | null }

/** Ce qu'une brochure lit d'une prestation du catalogue. */
export interface CatalogPrestation {
  id: string;
  name: string;
  description: string | null;
  gastro_card_html: string | null;
  gastro_card_html_en: string | null;
  unit_price: number | string | null;
  child_unit_price: number | string | null;
  category: string | null;
  photo_url: string | null;
}

export interface PriceOptions { show: boolean; mode: 'ht' | 'ttc'; vatRate: number; language: 'fr' | 'en' }

export interface ResolvedItem {
  /** Rang dans la brochure : jamais l'identifiant de la prestation (rien d'interne sur le lien public). */
  key: string;
  name: string;
  html: string;
  /** Le texte vient d'une fiche ou d'une retouche, qui porte déjà son titre : le nom n'est pas répété. */
  titled: boolean;
  photoUrl: string | null;
  price: string | null;
  childPrice: string | null;
  /** Prestation supprimée du catalogue (éditeur seulement). */
  missing: boolean;
}

export type BrochurePage =
  | { kind: 'cover' }
  | { kind: 'about' }
  | { kind: 'items'; sectionTitle: string | null; items: ResolvedItem[] }
  | { kind: 'contact' }
  | { kind: 'form' };

/** Prestations par page selon le style. */
export const ITEMS_PER_PAGE: Record<BrochureStyle, number> = { editorial: 1, carte: 6, magazine: 3 };

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Contenu lu en base (ou envoyé par l'éditeur), nettoyé ; valeurs par défaut s'il est illisible. */
export function parseBrochureContent(raw: unknown): BrochureContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const about = (r.about && typeof r.about === 'object' ? r.about : {}) as Record<string, unknown>;
  const contact = (r.contact && typeof r.contact === 'object' ? r.contact : {}) as Record<string, unknown>;
  const sections = (Array.isArray(r.sections) ? r.sections : []).flatMap((s): BrochureSection[] => {
    if (!s || typeof s !== 'object') return [];
    const sec = s as Record<string, unknown>;
    const items = (Array.isArray(sec.items) ? sec.items : []).flatMap((i): BrochureItem[] => {
      const it = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
      const id = str(it.prestationId);
      if (!id) return [];
      return [{
        prestationId: id,
        ...(str(it.html) ? { html: str(it.html) } : {}),
        ...(str(it.photoUrl) ? { photoUrl: str(it.photoUrl) } : {}),
        ...(it.hidePrice === true ? { hidePrice: true } : {}),
      }];
    });
    return [{ id: str(sec.id) ?? `s${Math.random().toString(36).slice(2, 8)}`, title: str(sec.title) ?? '', items }];
  });
  return {
    about: { enabled: about.enabled !== false, html: str(about.html) ?? '', ...(str(about.photoUrl) ? { photoUrl: str(about.photoUrl) } : {}) },
    contact: { enabled: contact.enabled !== false },
    sections,
  };
}

/**
 * Prestation tarifée au couvert : la règle de l'ajout d'une prestation dans un devis (catégorie hors matériel,
 * personnel et logistique, nom sans « forfait », prix sous 150 €).
 */
export function isPerGuestPrestation(p: { category?: string | null; name?: string | null; unit_price?: number | string | null }): boolean {
  const category = String(p.category ?? '').toLowerCase();
  return !['matériel', 'materiel', 'personnel', 'logistique'].includes(category)
    && !/forfait/i.test(p.name ?? '') && Number(p.unit_price ?? 0) < 150;
}

/** Prix affichés d'une prestation (HT ou TTC, au couvert, prix enfant), ou null quand les prix sont masqués. */
export function formatPrice(p: CatalogPrestation, o: PriceOptions): { price: string | null; childPrice: string | null } {
  if (!o.show) return { price: null, childPrice: null };
  const en = o.language === 'en';
  const money = new Intl.NumberFormat(en ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR' });
  const tax = o.mode === 'ttc' ? (en ? 'incl. VAT' : 'TTC') : (en ? 'excl. VAT' : 'HT');
  const amount = (v: number | string | null) => {
    const n = Number(v);
    if (v == null || v === '' || !Number.isFinite(n)) return null;
    return o.mode === 'ttc' ? Math.round(n * (1 + o.vatRate / 100) * 100) / 100 : n;
  };
  const base = amount(p.unit_price);
  const child = amount(p.child_unit_price);
  const per = isPerGuestPrestation(p) ? (en ? ' per guest' : ' / pers.') : '';
  return {
    price: base == null ? null : `${money.format(base)} ${tax}${per}`,
    childPrice: child == null ? null : `${en ? 'child: ' : 'enfant : '}${money.format(child)} ${tax}`,
  };
}

/** Prestations d'une section, prêtes à afficher (texte, photo, prix), dans l'ordre. */
export function resolveItems(
  section: BrochureSection,
  catalog: ReadonlyMap<string, CatalogPrestation>,
  o: PriceOptions & { forEditor: boolean },
  offset = 0,
): ResolvedItem[] {
  return section.items.flatMap((item, i): ResolvedItem[] => {
    const p = catalog.get(item.prestationId);
    const key = String(offset + i);
    if (!p) {
      return o.forEditor
        ? [{ key, name: '', html: '', titled: false, photoUrl: null, price: null, childPrice: null, missing: true }]
        : [];
    }
    const card = (o.language === 'en' && p.gastro_card_html_en) || p.gastro_card_html;
    const html = item.html || card || p.description || '';
    const prices = item.hidePrice ? { price: null, childPrice: null } : formatPrice(p, o);
    return [{
      key, name: p.name, html: sanitizeHtml(html), titled: !!(item.html || card),
      photoUrl: item.photoUrl ?? p.photo_url ?? null, ...prices, missing: false,
    }];
  });
}

/**
 * Les pages de la brochure : couverture, « qui sommes-nous » (si activé), les sections paginées selon le style
 * (titre de section sur leur première page), contact (si activé), et toujours le formulaire en dernier.
 */
export function paginateBrochure(
  content: BrochureContent,
  catalog: ReadonlyMap<string, CatalogPrestation>,
  style: BrochureStyle,
  o: PriceOptions & { forEditor: boolean },
): BrochurePage[] {
  const pages: BrochurePage[] = [{ kind: 'cover' }];
  if (content.about.enabled) pages.push({ kind: 'about' });
  const per = ITEMS_PER_PAGE[style];
  let offset = 0;
  for (const section of content.sections) {
    const items = resolveItems(section, catalog, o, offset);
    offset += section.items.length;
    for (let i = 0; i < items.length; i += per) {
      pages.push({ kind: 'items', sectionTitle: i === 0 ? section.title || null : null, items: items.slice(i, i + per) });
    }
  }
  if (content.contact.enabled) pages.push({ kind: 'contact' });
  pages.push({ kind: 'form' });
  return pages;
}
