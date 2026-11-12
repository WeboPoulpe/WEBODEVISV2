import { describe, expect, it, vi } from 'vitest';

// Favoris de l'annuaire : seules les fiches visibles (rendues par la lecture publique) reviennent.

const card = (slug: string) => ({ slug, name: slug, tagline: '', city: '', departments: [], eventTypes: [], coverUrl: null, logoUrl: null, priceFrom: null });
const search = vi.fn(async () => [card('a-troyes'), card('b-paris')]);
vi.mock('./directoryPublic', () => ({ searchListings: search }));

const { favoriteListings } = await import('./directoryFavorites');

describe('favoriteListings', () => {
  it('rend les fiches visibles dans l’ordre des favoris', async () => {
    const r = await favoriteListings(['b-paris', 'retiree', 'a-troyes', 'b-paris']);
    expect(r).toEqual({ error: null, listings: [card('b-paris'), card('a-troyes')] });
  });

  it('ignore ce qui n’est pas une liste de slugs, sans lire la base', async () => {
    search.mockClear();
    expect((await favoriteListings('a-troyes')).listings).toEqual([]);
    expect((await favoriteListings([42, '../x', 'A-TROYES', 'x'.repeat(81)])).listings).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it('au plus 30 favoris', async () => {
    search.mockClear();
    const many = Array.from({ length: 40 }, (_, i) => `f-${i}`);
    search.mockResolvedValueOnce(many.map(card));
    expect((await favoriteListings(many)).listings).toHaveLength(30);
  });
});
