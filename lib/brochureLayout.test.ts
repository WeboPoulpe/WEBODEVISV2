import { describe, expect, it } from 'vitest';
import { parseBrochureContent, type BrochureContent, type CatalogPrestation, type PriceOptions } from './brochure';
import {
  addBlock, addPage, duplicateBlock, layoutError, layoutFromSimple, mergeLayout, moveBlock, newBlock, parseLayout,
  placeBlock, removePage, resolveLayout, sectionsFromLayout,
  type Block, type BrochureLayout,
} from './brochureLayout';

const prestation = (id: string, over: Partial<CatalogPrestation> = {}): CatalogPrestation => ({
  id, name: `Plat ${id}`, description: `<p>Description longue du plat ${id} ${'avec beaucoup de détails '.repeat(10)}</p>`,
  gastro_card_html: null, gastro_card_html_en: null, unit_price: 50, child_unit_price: null, category: 'dîner', photo_url: null, ...over,
});
const catalog = new Map(['p1', 'p2', 'p3'].map((id) => [id, prestation(id)]));
const PRICES: PriceOptions = { show: true, mode: 'ttc', vatRate: 10, language: 'fr' };
const content = (over: Partial<BrochureContent> = {}): BrochureContent => ({
  ...parseBrochureContent(null),
  about: { enabled: false, html: '' },
  sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: 'p1' }, { prestationId: 'p2', html: '<p>Retouché</p>' }, { prestationId: 'p3' }] }],
  ...over,
});
const kinds = (l: BrochureLayout) => l.pages.map((p) => p.kind);
const blocksOf = (l: BrochureLayout): Block[] => l.pages.flatMap((p) => p.blocks.flatMap((b) => (b.type === 'columns' ? [b, ...b.cols.flat()] : [b])));

describe('mise en page : lecture et règles', () => {
  it('nettoie : type inconnu retiré, couleur hors palette annulée, illisible → null', () => {
    const l = parseLayout({ pages: [
      { id: 'c', kind: 'cover', blocks: [] },
      { id: 'b', kind: 'blocks', background: '#123456', blocks: [{ id: 'x', type: 'video' }, { id: 't', type: 'title', text: 'Bonjour', level: 'l' }] },
      { id: 'f', kind: 'form', blocks: [] },
    ] })!;
    expect(l.pages[1].blocks.map((b) => b.type)).toEqual(['title']);
    expect(l.pages[1].background).toBeNull();
    expect(parseLayout('x')).toBeNull();
  });

  it('règles des pages spéciales et des colonnes', () => {
    const page = (id: string, kind: 'cover' | 'blocks' | 'contact' | 'form', blocks: Block[] = []) => ({ id, kind, blocks });
    expect(layoutError({ pages: [page('c', 'cover'), page('b', 'blocks'), page('f', 'form')] })).toBeNull();
    expect(layoutError({ pages: [page('c', 'cover'), page('c2', 'cover'), page('f', 'form')] })).toBeTruthy();
    expect(layoutError({ pages: [page('b', 'blocks'), page('c', 'cover'), page('f', 'form')] })).toBeTruthy();
    expect(layoutError({ pages: [page('f', 'form'), page('b', 'blocks')] })).toBeTruthy();
    expect(layoutError({ pages: [page('k', 'contact'), page('k2', 'contact'), page('f', 'form')] })).toBeTruthy();
    const nested: Block = { id: 'c1', type: 'columns', count: 2, gap: 8, cols: [[{ id: 'c2', type: 'columns', count: 2, gap: 8, cols: [[], []] }], []] };
    expect(layoutError({ pages: [page('b', 'blocks', [nested]), page('f', 'form')] })).toBeTruthy();
    expect(layoutError({ pages: [page('b', 'blocks', Array.from({ length: 31 }, (_, i) => ({ id: `s${i}`, type: 'spacer' as const, height: 8 }))), page('f', 'form')] })).toBeTruthy();
  });
});

describe('mise en page : opérations', () => {
  const base = (): BrochureLayout => ({ pages: [{ id: 'b', kind: 'blocks', blocks: [] }, { id: 'f', kind: 'form', blocks: [] }] });

  it('ajouter, monter, placer dans une colonne, dupliquer', () => {
    let l = addBlock(base(), 'b', { id: 't1', type: 'title', text: 'Un', level: 'l' });
    l = addBlock(l, 'b', { id: 't2', type: 'title', text: 'Deux', level: 'l' });
    l = moveBlock(l, 't2', -1);
    expect(l.pages[0].blocks.map((b) => b.id)).toEqual(['t2', 't1']);
    l = addBlock(l, 'b', { id: 'cols', type: 'columns', count: 2, gap: 8, cols: [[], []] });
    l = placeBlock(l, 't1', { parentId: 'cols', col: 1, index: 0 });
    const cols = l.pages[0].blocks.find((b) => b.id === 'cols') as Extract<Block, { type: 'columns' }>;
    expect(cols.cols[1].map((b) => b.id)).toEqual(['t1']);
    expect(l.pages[0].blocks.map((b) => b.id)).toEqual(['t2', 'cols']);
    l = duplicateBlock(l, 't2');
    expect(l.pages[0].blocks).toHaveLength(3);
    expect(new Set(l.pages[0].blocks.map((b) => b.id)).size).toBe(3);
  });

  it('pages : ajout avant le formulaire ; la page formulaire ne se supprime pas', () => {
    const l = addPage(base(), 'blocks');
    expect(kinds(l)).toEqual(['blocks', 'blocks', 'form']);
    expect(removePage(l, 'f')).toBe(l);
    expect(newBlock('prestation', 'p1')).toMatchObject({ type: 'prestation', prestationId: 'p1', photo: 'top', text: 'full' });
  });
});

describe('mise en page : conversions', () => {
  it('Carte : une page de blocs, titre puis prestations sans photo, texte court', () => {
    const l = layoutFromSimple(content(), 'carte', catalog);
    expect(kinds(l)).toEqual(['cover', 'blocks', 'contact', 'form']);
    const page = l.pages[1].blocks;
    expect(page[0]).toMatchObject({ type: 'title', text: 'Menus' });
    expect(page.slice(1).map((b) => b.type === 'prestation' && [b.prestationId, b.photo, b.text])).toEqual([['p1', 'none', 'short'], ['p2', 'none', 'short'], ['p3', 'none', 'short']]);
  });

  it('Éditorial : une page par prestation ; retour au simple : mêmes prestations, même retouche', () => {
    const l = layoutFromSimple(content(), 'editorial', catalog);
    expect(kinds(l)).toEqual(['cover', 'blocks', 'blocks', 'blocks', 'contact', 'form']);
    const sections = sectionsFromLayout(layoutFromSimple(content(), 'carte', catalog));
    expect(sections.flatMap((s) => s.items.map((i) => i.prestationId))).toEqual(['p1', 'p2', 'p3']);
    expect(sections[0].title).toBe('Menus');
    expect(sections[0].items[1].html).toBe('<p>Retouché</p>');
  });

  it('reprendre une mise en page : prestation retirée disparaît, prestation ajoutée sur une page avant le formulaire', () => {
    const l = layoutFromSimple(content(), 'carte', catalog);
    const after = content({ sections: [{ id: 's1', title: 'Menus', items: [{ prestationId: 'p1' }, { prestationId: 'p3' }, { prestationId: 'p4' }] }] });
    const merged = mergeLayout(l, after);
    const ids = blocksOf(merged).flatMap((b) => (b.type === 'prestation' ? [b.prestationId] : []));
    expect(ids).toEqual(['p1', 'p3', 'p4']);
    expect(kinds(merged)).toEqual(['cover', 'blocks', 'contact', 'blocks', 'form']);
  });

  it('beaucoup de prestations : la conversion et la reprise respectent les limites (pages, blocs par page) sans en perdre', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `q${i}`);
    const big = new Map(ids.map((id) => [id, prestation(id)]));
    const many = content({ about: { enabled: true, html: '<p>Nous</p>' }, sections: [{ id: 's1', title: 'Menus', items: ids.map((prestationId) => ({ prestationId })) }] });
    const prestIds = (l: BrochureLayout) => blocksOf(l).flatMap((b) => (b.type === 'prestation' ? [b.prestationId] : []));
    for (const style of ['editorial', 'carte', 'magazine'] as const) {
      const l = layoutFromSimple(many, style, big);
      expect(layoutError(l)).toBeNull();
      expect(prestIds(l)).toEqual(ids);
    }
    const small = layoutFromSimple(content(), 'carte', catalog);
    const merged = mergeLayout(small, many);
    expect(layoutError(merged)).toBeNull();
    expect(prestIds(merged)).toEqual(ids);
  });
});

describe('mise en page : affichage', () => {
  const layout: BrochureLayout = { pages: [
    { id: 'b', kind: 'blocks', blocks: [
      { id: 'a', type: 'prestation', prestationId: 'p1', photo: 'left', show: { name: true, text: true, price: true }, text: 'short' },
      { id: 'z', type: 'prestation', prestationId: 'disparue', photo: 'top', show: { name: true, text: true, price: true }, text: 'full' },
      { id: 'n', type: 'prestation', prestationId: 'p2', photo: 'top', show: { name: true, text: true, price: false }, text: 'full' },
    ] },
    { id: 'f', kind: 'form', blocks: [] },
  ] };

  it('prestation absente : sautée sur le lien, signalée dans l’éditeur ; texte court ; prix masqué ; pas d’identifiant', () => {
    const pub = resolveLayout(layout, catalog, { ...PRICES, forEditor: false });
    const items = pub[0].blocks.flatMap((b) => (b.type === 'prestation' ? [b.item] : []));
    expect(items.map((i) => i.name)).toEqual(['Plat p1', 'Plat p2']);
    expect(items[0].html.length).toBeLessThanOrEqual(151);
    expect(items[0].html).not.toContain('<');
    expect(items[1].price).toBeNull();
    expect(JSON.stringify(pub)).not.toContain('prestationId');
    const ed = resolveLayout(layout, catalog, { ...PRICES, forEditor: true });
    expect(ed[0].blocks.flatMap((b) => (b.type === 'prestation' ? [b.item.missing] : []))).toEqual([false, true, false]);
  });
});
