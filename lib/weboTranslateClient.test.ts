import { describe, expect, it, vi } from 'vitest';

// Traduction au choix côté navigateur : Webo d'abord (une pièce par fiche distincte), le reste en gratuit.

vi.mock('@/server/weboTranslate', () => ({ translateWithWebo: async () => ({ results: [], spent: 0, balance: 0 }) }));
const { countFiches, translateFiches } = await import('./weboTranslateClient');

type Sent = { key: string; requestId: string; name: string; html: string }[];
const fiches = [
  { key: 'a', name: 'Menu', html: '<p>Bonjour</p>' },
  { key: 'b', name: 'Menu', html: '<p>Bonjour</p>' },
  { key: 'c', name: 'Dessert', html: '<p>Gâteau</p>' },
];
const free = {
  html: vi.fn(async (h: string) => ({ html: h.replace('Gâteau', 'Cake').replace('Bonjour', 'Hello'), missed: 0 })),
  text: vi.fn(async (t: string) => `FREE ${t}`),
};

describe('traduction au choix', () => {
  it('deux fiches identiques : une seule traduction, deux clés', async () => {
    const sent: Sent[] = [];
    const webo = async (list: Sent) => {
      sent.push(list);
      return { results: list.map((f) => ({ key: f.key, ok: true as const, name: `EN ${f.name}`, html: '<p>Hello</p>' })), spent: list.length, balance: 10 };
    };
    const r = await translateFiches(fiches, 'webo', { webo, free });
    expect(sent.flat()).toHaveLength(2);
    expect(r.byKey.get('a')).toEqual({ name: 'EN Menu', html: '<p>Hello</p>', by: 'webo' });
    expect(r.byKey.get('b')).toEqual(r.byKey.get('a'));
    expect(r).toMatchObject({ webo: 2, free: 0, fallbackWhy: null });
  });

  it('Webo refuse 1 fiche (balance) : traduite en gratuit, compte 2 webo / 1 free, fallbackWhy balance', async () => {
    const list = [...fiches, { key: 'd', name: 'Vin', html: '<p>Rouge</p>' }];
    const webo = async (l: Sent) => ({
      results: l.map((f, i) => (i < 2 ? { key: f.key, ok: true as const, name: f.name, html: f.html } : { key: f.key, ok: false as const, why: 'balance' as const })),
      spent: 2, balance: 0,
    });
    const r = await translateFiches(list, 'webo', { webo, free });
    expect(r).toMatchObject({ webo: 2, free: 1, fallbackWhy: 'balance' });
    expect(r.byKey.get('d')).toMatchObject({ name: 'FREE Vin', by: 'free' });
  });

  it('mode gratuit : Webo jamais appelé', async () => {
    const webo = vi.fn();
    const r = await translateFiches(fiches, 'free', { webo, free });
    expect(webo).not.toHaveBeenCalled();
    expect(r.byKey.get('c')).toEqual({ name: 'FREE Dessert', html: '<p>Cake</p>', by: 'free' });
    expect(r).toMatchObject({ webo: 0, free: 2 });
  });

  it('par lots de 8 fiches ; clés courtes (pas le texte)', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, name: `P${i}`, html: `<p>${i}</p>` }));
    const sent: Sent[] = [];
    const webo = async (l: Sent) => { sent.push(l); return { results: l.map((f) => ({ key: f.key, ok: true as const, name: f.name, html: f.html })), spent: l.length, balance: 0 }; };
    const r = await translateFiches(many, 'webo', { webo, free });
    expect(sent.map((b) => b.length)).toEqual([8, 8, 4]);
    expect(sent[0][0].key.length).toBeLessThan(10);
    expect(r.webo).toBe(20);
  });

  it('countFiches dédoublonne', () => {
    expect(countFiches(fiches)).toBe(2);
    expect(countFiches([])).toBe(0);
  });
});
