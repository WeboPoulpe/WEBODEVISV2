import { describe, expect, it } from 'vitest';
import { applyBrochureUpdate, toHtml, type BrochureOp, type BrochureSettings, type BrochureState } from './brochureUpdate';

// Modifier une brochure par Webo : opérations sur les identifiants, refus lisibles, rien hors des règles des pages.

const MENU = '00000000-0000-4000-8000-000000000001';
const DESSERT = '00000000-0000-4000-8000-000000000002';
const names = new Map([[MENU, 'Menu Tentation'], [DESSERT, 'Pièce montée']]);
const none: BrochureSettings = { name: null, language: null, showPrices: null, coverTitle: null, coverSubtitle: null };
const op = (o: Partial<BrochureOp> & Pick<BrochureOp, 'op'>): BrochureOp => ({
  target: null, where: null, position: null, block_type: null, level: null, text: null, html: null, prestation_id: null, ref: null, ...o,
});

const advanced = (): BrochureState => ({
  name: 'Carte 2027', editorMode: 'advanced', language: 'fr', showPrices: true, cover: { title: 'Carte 2027' },
  content: { about: { enabled: false, html: '' }, contact: { enabled: true }, sections: [] },
  layout: { pages: [
    { id: 'pc', kind: 'cover', blocks: [] },
    { id: 'p1', kind: 'blocks', blocks: [
      { id: 'b1', type: 'title', text: 'Nos menus', level: 'm' },
      { id: 'b2', type: 'text', html: '<p>Bonjour</p>' },
      { id: 'b3', type: 'prestation', prestationId: MENU, photo: 'top', show: { name: true, text: true, price: true }, text: 'full' },
    ] },
    { id: 'pf', kind: 'form', blocks: [] },
  ] },
});

const simple = (): BrochureState => ({
  ...advanced(), editorMode: 'simple', layout: null,
  content: { about: { enabled: false, html: '' }, contact: { enabled: true }, sections: [{ id: 's1', title: 'Dîners', items: [{ prestationId: MENU }] }] },
});

describe('modifier une brochure en éditeur avancé', () => {
  it('change un titre, un texte et le texte propre d’une prestation', () => {
    const { patch, lines } = applyBrochureUpdate(advanced(), none, [
      op({ op: 'set_text', target: 'b1', text: 'Our menus' }),
      op({ op: 'set_text', target: 'b2', html: 'Hello\n\nWelcome' }),
      op({ op: 'set_text', target: 'b3', html: '<p>Three courses</p>' }),
    ], names);
    const blocks = patch.layout!.pages[1].blocks;
    expect(blocks[0]).toMatchObject({ text: 'Our menus' });
    expect(blocks[1]).toMatchObject({ html: '<p>Hello</p><p>Welcome</p>' });
    expect(blocks[2]).toMatchObject({ html: '<p>Three courses</p>', prestationId: MENU });
    expect(lines.map((l) => l.label)).toEqual(['Titre, page 2', 'Texte, page 2', 'Texte de « Menu Tentation », page 2']);
  });

  it('ajoute une page avant le formulaire et y met des blocs par son nom provisoire', () => {
    const { patch } = applyBrochureUpdate(advanced(), none, [
      op({ op: 'add_page', ref: 'desserts' }),
      op({ op: 'add_block', where: 'desserts', block_type: 'title', text: 'Desserts', level: 'l' }),
      op({ op: 'add_block', where: 'desserts', block_type: 'prestation', prestation_id: DESSERT }),
    ], names);
    const pages = patch.layout!.pages;
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'blocks', 'blocks', 'form']);
    expect(pages[2].blocks).toMatchObject([{ type: 'title', text: 'Desserts', level: 'l' }, { type: 'prestation', prestationId: DESSERT }]);
  });

  it('retire et déplace des blocs', () => {
    const { patch } = applyBrochureUpdate(advanced(), none, [
      op({ op: 'remove_block', target: 'b2' }),
      op({ op: 'move_block', target: 'b3', where: 'p1', position: 0 }),
    ], names);
    expect(patch.layout!.pages[1].blocks.map((b) => b.id)).toEqual(['b3', 'b1']);
  });

  it('refuse ce qui ne tient pas, avec un message lisible', () => {
    const run = (ops: BrochureOp[]) => () => applyBrochureUpdate(advanced(), none, ops, names);
    expect(run([op({ op: 'set_text', target: 'bX', text: 'x' })])).toThrow(/Bloc introuvable/);
    expect(run([op({ op: 'remove_page', target: 'pf' })])).toThrow(/formulaire/);
    expect(run([op({ op: 'add_block', where: 'pc', block_type: 'text', html: 'x' })])).toThrow(/couverture/);
    expect(run([op({ op: 'add_block', where: 'p1', block_type: 'prestation', prestation_id: '00000000-0000-4000-8000-000000000099' })])).toThrow(/catalogue/);
    expect(run([op({ op: 'set_about', html: 'x' })])).toThrow(/éditeur simple/);
    expect(run([])).toThrow(/Rien à changer/);
  });

  it('nettoie le HTML proposé', () => {
    const { patch } = applyBrochureUpdate(advanced(), none, [op({ op: 'set_text', target: 'b2', html: '<p>Ok<script>alert(1)</script></p>' })], names);
    expect(JSON.stringify(patch.layout)).not.toContain('script');
  });
});

describe('modifier une brochure en éditeur simple', () => {
  it('présentation, section, prestations et leur texte', () => {
    const { patch } = applyBrochureUpdate(simple(), none, [
      op({ op: 'set_about', html: 'Traiteur depuis 1998' }),
      op({ op: 'set_section_title', target: 's1', text: 'Dinners' }),
      op({ op: 'add_section', text: 'Desserts', ref: 'd' }),
      op({ op: 'add_prestation', where: 'd', prestation_id: DESSERT }),
      op({ op: 'set_prestation_text', target: 's1', prestation_id: MENU, html: 'Three courses' }),
    ], names);
    expect(patch.content!.about).toMatchObject({ enabled: true, html: '<p>Traiteur depuis 1998</p>' });
    expect(patch.content!.sections).toMatchObject([
      { id: 's1', title: 'Dinners', items: [{ prestationId: MENU, html: '<p>Three courses</p>' }] },
      { title: 'Desserts', items: [{ prestationId: DESSERT }] },
    ]);
    expect(patch.layout).toBeUndefined();
  });

  it('pas deux fois la même prestation ; pas d’opération de l’éditeur avancé', () => {
    expect(() => applyBrochureUpdate(simple(), none, [op({ op: 'add_prestation', where: 's1', prestation_id: MENU })], names)).toThrow(/déjà/);
    expect(() => applyBrochureUpdate(simple(), none, [op({ op: 'set_text', target: 'b1', text: 'x' })], names)).toThrow(/éditeur avancé/);
  });
});

describe('réglages', () => {
  it('nom, langue, prix et couverture ; inchangés si null ou identiques', () => {
    const { patch, lines } = applyBrochureUpdate(advanced(), { name: 'Menu 2027', language: 'en', showPrices: true, coverTitle: 'Menu 2027', coverSubtitle: 'Weddings' }, [], names);
    expect(patch).toMatchObject({ name: 'Menu 2027', language: 'en', cover: { title: 'Menu 2027', subtitle: 'Weddings' } });
    expect(patch.show_prices).toBeUndefined();
    expect(lines).toHaveLength(4);
  });
});

it('du texte simple devient des paragraphes échappés', () => {
  expect(toHtml('a < b\nc\n\nd')).toBe('<p>a &lt; b<br>c</p><p>d</p>');
});
