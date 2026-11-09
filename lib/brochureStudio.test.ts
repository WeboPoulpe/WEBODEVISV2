import { describe, expect, it } from 'vitest';
import { parseBrochureContent, type CatalogPrestation } from './brochure';
import {
  PAGE_H, PAGE_TEMPLATES, formPage, parseStudio, resolveStudio, sanitizeStudio, studioError, studioFonts, studioFontsHref, studioFromBrochure,
  studioPhotos, studioPrestationIds, textEl, type StudioDoc,
} from './brochureStudio';

const P = '00000000-0000-4000-8000-000000000001';
const catalog = new Map<string, CatalogPrestation>([[P, {
  id: P, name: 'Menu Tentation', description: '<p>Entrée, plat, dessert</p>', gastro_card_html: null, gastro_card_html_en: null,
  unit_price: 76, child_unit_price: null, category: 'dîner', photo_url: 'https://x.test/menu.jpg',
}]]);
const prices = { show: true, mode: 'ht' as const, vatRate: 10, language: 'fr' as const };
const ctx = { company: { name: 'Traiteur', address: '1 rue', phone: null, email: 'a@b.fr', website: null }, language: 'fr' as const };

describe('Studio : lecture', () => {
  it('refuse ce qui n’est pas un document', () => {
    expect(parseStudio(null)).toBeNull();
    expect(parseStudio({ pages: 'x' })).toBeNull();
  });

  it('ajoute la page du formulaire, la met en dernier, garde un seul formulaire', () => {
    const doc = parseStudio({
      pages: [
        { id: 'f', form: true, bg: '#ffffff', els: [{ type: 'form', x: 1, y: 2, w: 50, h: 50 }, { type: 'form', x: 3, y: 3, w: 10, h: 10 }] },
        { id: 'a', bg: '#000000', els: [{ type: 'form', x: 1, y: 1, w: 10, h: 10 }, { type: 'shape', x: 1, y: 1, w: 10, h: 10 }] },
      ],
    })!;
    expect(doc.pages.map((p) => p.id)).toEqual(['a', 'f']);
    expect(doc.pages[0].els.map((e) => e.type)).toEqual(['shape']);
    expect(doc.pages[0].form).toBeUndefined();
    expect(doc.pages[1].els.filter((e) => e.type === 'form')).toHaveLength(1);
    expect(parseStudio({ pages: [] })!.pages).toHaveLength(1);
  });

  it('borne les valeurs, refuse les couleurs et adresses douteuses', () => {
    const doc = parseStudio({
      pages: [{
        bg: 'red', els: [
          { type: 'text', html: '<p>x</p>', x: 9999, y: -9999, w: 0, size: 900, color: 'javascript:alert(1)', font: 'Comic Sans' },
          { type: 'image', url: 'javascript:alert(1)', x: 1, y: 1, w: 10, h: 10 },
          { type: 'prestation', x: 1, y: 1, w: 10, h: 10 },
          { type: 'inconnu' },
        ],
      }],
    })!;
    const [text, image] = doc.pages[0].els;
    expect(doc.pages[0].bg).toBe('#fbf7f0');
    expect(doc.pages[0].els).toHaveLength(2);
    expect(text).toMatchObject({ type: 'text', x: 99, w: 2, size: 30, color: '#1c2621', font: 'Georgia' });
    expect(text.y).toBeGreaterThanOrEqual(-text.h);
    expect(image).toMatchObject({ type: 'image', url: null });
  });

  it('nettoie le HTML et compte les limites', () => {
    const doc = sanitizeStudio(parseStudio({ pages: [{ els: [{ type: 'text', html: '<p onclick="x()">Bonjour<script>alert(1)</script></p>', x: 1, y: 1, w: 10 }] }] })!);
    const text = doc.pages[0].els[0];
    expect(text.type === 'text' && text.html).toBe('<p>Bonjour</p>');
    expect(studioError(doc)).toBeNull();
    expect(studioError({ pages: Array.from({ length: 41 }, () => formPage()) })).toMatch(/40 pages/);
  });
});

describe('Studio : affichage', () => {
  const doc: StudioDoc = {
    pages: [
      { id: 'a', bg: '#ffffff', bgImage: { url: 'https://x.test/fond.jpg', opacity: 50 }, els: [
        textEl({ x: 1, y: 1, w: 50, html: '<p>Titre <span style="font-family: Lora">x</span></p>', font: 'Playfair Display' }),
        { id: 'p', type: 'prestation', prestationId: P, x: 1, y: 1, w: 50, h: 50, rot: 0, opacity: 100, show: { name: true, text: true, price: true }, text: 'short', photo: 'top', photoSize: 40, font: 'Georgia', size: 3, color: '#000000', accent: '#b4502d', align: 'left', bg: null, padding: 0, radius: 0 },
        { id: 'gone', type: 'prestation', prestationId: '00000000-0000-4000-8000-000000000099', x: 1, y: 1, w: 50, h: 50, rot: 0, opacity: 100, show: { name: true, text: true, price: true }, text: 'short', photo: 'top', photoSize: 40, font: 'Georgia', size: 3, color: '#000000', accent: '#b4502d', align: 'left', bg: null, padding: 0, radius: 0 },
      ] },
      formPage(),
    ],
  };

  it('lit les prestations dans le catalogue, sans exposer leur identifiant', () => {
    const [page] = resolveStudio(doc, catalog, { ...prices, forEditor: false });
    expect(page.els).toHaveLength(2);
    const p = page.els[1];
    expect(p.type === 'prestation' && p.item).toMatchObject({ name: 'Menu Tentation', price: expect.stringMatching(/^76,00\s€ HT \/ pers\.$/), photoUrl: 'https://x.test/menu.jpg' });
    expect(JSON.stringify(page)).not.toContain(P);
    // Dans l'éditeur, la prestation disparue du catalogue est signalée.
    expect(resolveStudio(doc, catalog, { ...prices, forEditor: true })[0].els).toHaveLength(3);
  });

  it('liste polices, photos et prestations', () => {
    expect(studioFonts(doc)).toEqual(expect.arrayContaining(['Playfair Display', 'Lora', 'Georgia']));
    expect(studioPrestationIds(doc)).toContain(P);
    expect(studioPhotos(doc)).toEqual(['https://x.test/fond.jpg']);
    const href = studioFontsHref(['Georgia', 'Great Vibes', 'Playfair Display'])!;
    expect(href).toContain('family=Great+Vibes&');
    expect(href).toContain('family=Playfair+Display:ital,wght@0,400;0,700;1,400');
    expect(href).not.toContain('Georgia');
    expect(studioFontsHref(['Georgia'])).toBeNull();
  });
});

describe('Studio : création', () => {
  it('compose les pages depuis la brochure : couverture, qui sommes-nous, prestations deux par deux, contact, formulaire', () => {
    const content = parseBrochureContent({
      about: { enabled: true, html: '<p>Notre histoire</p>' },
      contact: { enabled: true },
      sections: [{ id: 's', title: 'Dîners', items: [{ prestationId: P }, { prestationId: P, html: '<p>Retouché</p>' }, { prestationId: P }] }],
    });
    const doc = studioFromBrochure(content, { title: 'Mariages 2027', subtitle: 'Saison', photoUrl: 'https://x.test/c.jpg' }, 'editorial', ctx);
    expect(doc.pages).toHaveLength(6);
    expect(doc.pages.at(-1)!.form).toBe(true);
    expect(JSON.stringify(doc.pages[0])).toContain('Mariages 2027');
    expect(JSON.stringify(doc.pages[1])).toContain('Notre histoire');
    const prestations = doc.pages.slice(2, 4).flatMap((p) => p.els.filter((e) => e.type === 'prestation'));
    expect(prestations).toHaveLength(3);
    expect(prestations[1]).toMatchObject({ html: '<p>Retouché</p>', text: 'full' });
    expect(JSON.stringify(doc.pages[4])).toContain('a@b.fr');
    // Un document fait ici repasse la lecture sans rien perdre.
    expect(parseStudio(JSON.parse(JSON.stringify(doc)))!.pages.map((p) => p.els.length)).toEqual(doc.pages.map((p) => p.els.length));
    // Rien ne dépasse de la page à la création.
    for (const p of doc.pages) for (const e of p.els) expect(e.y + e.h).toBeLessThanOrEqual(PAGE_H + 0.1);
  });

  it('chaque modèle de page est valide', () => {
    for (const t of PAGE_TEMPLATES) {
      const page = t.make({ ...ctx, title: 'T', subtitle: 'S', photoUrl: null }, [P, P]);
      const doc = parseStudio({ pages: [page] })!;
      expect(doc.pages[0].els.length, t.id).toBe(page.els.length);
    }
  });
});
