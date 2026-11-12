import { describe, expect, it } from 'vitest';
import type { PublicListing } from '@/server/directoryPublic';
import { directoryBreadcrumb, listingJsonLd } from './schema';

const listing: PublicListing = {
  slug: 'a-troyes',
  name: 'La Table </script> d’Élise',
  tagline: 'Cuisine de saison',
  city: 'Troyes',
  departments: ['10', '51'],
  eventTypes: ['Mariage', 'Cocktail'],
  coverUrl: 'https://x.public.blob.vercel-storage.com/a.jpg',
  logoUrl: null,
  priceFrom: 45,
  description: 'Tout est fait maison.\n</script><script>alert(1)</script>',
  postalCode: '10000',
  websiteUrl: 'https://latable.fr',
  guestsMin: 20,
  guestsMax: 300,
  photos: [{ url: 'https://x.public.blob.vercel-storage.com/a.jpg', alt: 'Buffet' }],
  brochures: [],
  publishedAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
};

describe('données structurées', () => {
  it('données structurées d’une fiche, sans note tant qu’il n’y a pas d’avis', () => {
    const j = listingJsonLd(listing) as Record<string, unknown>;
    expect(j['@type']).toBe('FoodEstablishment');
    expect(j.url).toBe('https://choisirmontraiteur.fr/traiteur/a-troyes');
    expect(j).not.toHaveProperty('aggregateRating');
    expect(JSON.stringify(j)).not.toContain('</script');
    expect(j.address).toMatchObject({ addressLocality: 'Troyes', postalCode: '10000', addressCountry: 'FR' });
    expect(j.image).toEqual(['https://x.public.blob.vercel-storage.com/a.jpg']);
  });

  it('fil d’Ariane sur l’adresse canonique', () => {
    const b = directoryBreadcrumb([{ name: 'Accueil', path: '/' }, { name: 'Traiteurs', path: '/traiteurs' }]) as { itemListElement: { item: string }[] };
    expect(b.itemListElement.map((i) => i.item)).toEqual(['https://choisirmontraiteur.fr/', 'https://choisirmontraiteur.fr/traiteurs']);
  });
});
