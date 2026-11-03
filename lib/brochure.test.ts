import { describe, expect, it } from 'vitest';
import {
  formatPrice, isPerGuestPrestation, paginateBrochure, parseBrochureContent,
  type BrochureContent, type CatalogPrestation, type PriceOptions,
} from './brochure';

const prestation = (over: Partial<CatalogPrestation> = {}): CatalogPrestation => ({
  id: 'p1', name: 'Menu Tentation', description: '<p>Entrée, plat, dessert</p>', gastro_card_html: null, gastro_card_html_en: null,
  unit_price: 76, child_unit_price: null, category: 'dîner', photo_url: null, ...over,
});
const TTC10: PriceOptions = { show: true, mode: 'ttc', vatRate: 10, language: 'fr' };
// Espaces insécables des formats de nombre : comparés comme des espaces simples.
const plain = (s: string | null) => s && s.replace(/[  ]/g, ' ');

describe('brochure : prix', () => {
  it('TTC, HT, au couvert ou non, prix enfant, masqué, anglais', () => {
    expect(plain(formatPrice(prestation(), TTC10).price)).toBe('83,60 € TTC / pers.');
    expect(plain(formatPrice(prestation(), { ...TTC10, mode: 'ht' }).price)).toBe('76,00 € HT / pers.');
    expect(plain(formatPrice(prestation({ category: 'matériel', unit_price: 300 }), { ...TTC10, mode: 'ht' }).price)).toBe('300,00 € HT');
    expect(plain(formatPrice(prestation({ child_unit_price: 18 }), { ...TTC10, mode: 'ht' }).childPrice)).toBe('enfant : 18,00 € HT');
    expect(formatPrice(prestation({ child_unit_price: 18 }), { ...TTC10, show: false })).toEqual({ price: null, childPrice: null });
    expect(plain(formatPrice(prestation(), { ...TTC10, mode: 'ht', language: 'en' }).price)).toBe('€76.00 excl. VAT per guest');
  });

  it('prestation au couvert : la règle de l’ajout dans un devis', () => {
    expect(isPerGuestPrestation({ category: 'personnel', unit_price: 30 })).toBe(false);
    expect(isPerGuestPrestation({ name: 'Forfait barman', unit_price: 90 })).toBe(false);
    expect(isPerGuestPrestation({ category: 'dîner', unit_price: 76 })).toBe(true);
    expect(isPerGuestPrestation({ unit_price: 300 })).toBe(false);
  });
});

describe('brochure : pages', () => {
  const catalog = new Map(['p1', 'p2', 'p3'].map((id) => [id, prestation({ id, name: `Plat ${id}` })]));
  const content = (over: Partial<BrochureContent> = {}): BrochureContent => ({
    ...parseBrochureContent(null),
    sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: 'p1' }, { prestationId: 'p2' }, { prestationId: 'p3' }] }],
    ...over,
  });
  const kinds = (c: BrochureContent, style: 'editorial' | 'carte' | 'magazine') =>
    paginateBrochure(c, catalog, style, { ...TTC10, forEditor: false }).map((p) => p.kind);

  it('une prestation par page en éditorial, une page pour la carte, formulaire toujours en dernier', () => {
    expect(kinds(content(), 'editorial')).toEqual(['cover', 'about', 'items', 'items', 'items', 'contact', 'form']);
    expect(kinds(content(), 'carte')).toEqual(['cover', 'about', 'items', 'contact', 'form']);
    expect(kinds(content({ about: { enabled: false, html: '' } }), 'carte')).toEqual(['cover', 'items', 'contact', 'form']);
  });

  it('prestation supprimée du catalogue : sautée sur le lien, signalée dans l’éditeur', () => {
    const c = content({ sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: 'p1' }, { prestationId: 'disparue' }] }] });
    const pub = paginateBrochure(c, catalog, 'carte', { ...TTC10, forEditor: false });
    const ed = paginateBrochure(c, catalog, 'carte', { ...TTC10, forEditor: true });
    const items = (pages: typeof pub) => pages.flatMap((p) => (p.kind === 'items' ? p.items : []));
    expect(items(pub).map((i) => i.name)).toEqual(['Plat p1']);
    expect(items(ed).map((i) => i.missing)).toEqual([false, true]);
  });

  it('prestation sans fiche retouchée : son nom reste affiché ; fiche retouchée : le titre est dans le texte', () => {
    const noCard = new Map([['p1', prestation()]]);
    const withCard = new Map([['p1', prestation({ gastro_card_html: '<h3>Menu</h3><p>…</p>' })]]);
    const one = (items: BrochureContent['sections'][number]['items'], cat: Map<string, CatalogPrestation>) =>
      paginateBrochure({ ...parseBrochureContent(null), sections: [{ id: 's', title: '', items }] }, cat, 'editorial', { ...TTC10, forEditor: false })
        .flatMap((p) => (p.kind === 'items' ? p.items : []))[0];
    expect(one([{ prestationId: 'p1', html: '<p>Retouché</p>' }], noCard).titled).toBe(false);
    expect(one([{ prestationId: 'p1', html: '<h3>Menu</h3><p>Retouché</p>', titled: true }], withCard).titled).toBe(true);
    expect(one([{ prestationId: 'p1' }], withCard).titled).toBe(true);
    expect(parseBrochureContent({ sections: [{ id: 's', title: '', items: [{ prestationId: 'p1', titled: true }] }] }).sections[0].items[0].titled).toBe(true);
  });

  it('contenu illisible : valeurs par défaut, éléments invalides ignorés', () => {
    expect(parseBrochureContent(null)).toEqual({ about: { enabled: true, html: '' }, contact: { enabled: true }, sections: [] });
    const c = parseBrochureContent({ sections: [{ id: 's', title: 'T', items: [{ prestationId: 'p1' }, { html: 'sans id' }] }] });
    expect(c.sections[0].items).toEqual([{ prestationId: 'p1' }]);
  });
});

describe('brochure : réglages de photo', () => {
  it('place, taille et cadrage d’une prestation gardés (bornés) ; cadrage de « qui sommes-nous »', () => {
    const c = parseBrochureContent({
      about: { html: '', photoUrl: 'https://x/a.webp', photoFrame: { x: 10, y: 200, zoom: 120 } },
      sections: [{ id: 's', title: 'T', items: [
        { prestationId: 'p1', placement: { pos: 'left', size: 99 }, frame: { x: 30, y: 70, zoom: 150, fit: 'cover' } },
        { prestationId: 'p2', placement: { pos: 'nulle-part' }, frame: 'n’importe quoi' },
      ] }],
    });
    expect(c.about.photoFrame).toEqual({ x: 10, y: 100, zoom: 120, fit: 'cover' });
    expect(c.sections[0].items[0]).toEqual({ prestationId: 'p1', placement: { pos: 'left', size: 60 }, frame: { x: 30, y: 70, zoom: 150, fit: 'cover' } });
    expect(c.sections[0].items[1]).toEqual({ prestationId: 'p2' });
  });

  it('prestation prête à afficher : place et cadrage (null quand rien n’est réglé)', () => {
    const catalog = new Map([['p1', prestation({ photo_url: 'https://x/p.webp' })]]);
    const content: BrochureContent = { ...parseBrochureContent(null), sections: [{ id: 's', title: '', items: [
      { prestationId: 'p1', placement: { pos: 'none', size: 0 } },
    ] }] };
    const pages = paginateBrochure(content, catalog, 'editorial', { ...TTC10, forEditor: false });
    const item = pages.flatMap((p) => (p.kind === 'items' ? p.items : []))[0];
    expect(item.placement).toEqual({ pos: 'none', size: 0 });
    expect(item.frame).toBeNull();
  });
});
