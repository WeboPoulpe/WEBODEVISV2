import { describe, expect, it } from 'vitest';
import { cleanListing, listingSlug, listingVisible, readyToSubmit, slugify, type ListingFields, type ListingInput } from './listing';

const base: ListingInput = {
  displayName: 'Convivial Event', tagline: 'Traiteur de saison', description: 'Cuisine de saison',
  city: 'Troyes', postalCode: '10000', departments: ['10'], eventTypes: ['Mariage'], websiteUrl: '',
  guestsMin: '20', guestsMax: '300', priceFrom: '45', siret: '92520576700013',
};
const complete: ListingFields = {
  displayName: 'Convivial Event', tagline: null, city: 'Troyes', postalCode: '10000',
  description: 'Cuisine de saison faite maison pour vos mariages, anniversaires et séminaires, dans toute l’Aube.',
  departments: ['10'], eventTypes: ['Mariage'], websiteUrl: null, guestsMin: 20, guestsMax: 300, priceFrom: 45,
  siret: '92520576700013',
};

describe('annuaire : règles de la fiche', () => {
  it('visible seulement publiée, compte actif, accès complet', () => {
    const ok = { access: 'full' as const, active: true, deleting: false };
    expect(listingVisible({ status: 'publiee' }, ok)).toBe(true);
    for (const s of ['brouillon', 'en_attente', 'refusee', 'suspendue'] as const) expect(listingVisible({ status: s }, ok)).toBe(false);
    expect(listingVisible({ status: 'publiee' }, { ...ok, access: 'readonly' })).toBe(false);
    expect(listingVisible({ status: 'publiee' }, { ...ok, access: 'unpaid' })).toBe(false);
    expect(listingVisible({ status: 'publiee' }, { ...ok, active: false })).toBe(false);
    expect(listingVisible({ status: 'publiee' }, { ...ok, deleting: true })).toBe(false);
  });

  it('slug propre et unique', () => {
    expect(slugify('Chez Éloïse & Fils — Traiteur')).toBe('chez-eloise-fils-traiteur');
    expect(slugify('../admin')).toBe('admin');
    expect(slugify('***')).toBe('traiteur');
    expect(slugify('a'.repeat(100)).length).toBe(60);
    const taken = new Set(['convivial-event-troyes', 'convivial-event-troyes-2']);
    expect(listingSlug('Convivial Event', 'Troyes', (s) => taken.has(s))).toBe('convivial-event-troyes-3');
    expect(listingSlug('Convivial Event', null, () => false)).toBe('convivial-event');
    const long = listingSlug('a'.repeat(100), null, (s) => s === 'a'.repeat(60));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(/-2$/);
  });

  it('nettoie la saisie', () => {
    const { fields, error } = cleanListing({
      ...base, displayName: ' Convivial Event ', tagline: '', description: '<script>x</script>Cuisine de saison',
      departments: ['10', '51', 'ZZ'], eventTypes: ['Mariage', 'Pirate'], websiteUrl: 'javascript:alert(1)',
      priceFrom: '45,50', siret: '925 205 767 00013',
    });
    expect(error).toBeNull();
    expect(fields).toMatchObject({
      displayName: 'Convivial Event', tagline: null, description: 'xCuisine de saison', departments: ['10', '51'],
      eventTypes: ['Mariage'], websiteUrl: null, guestsMin: 20, guestsMax: 300, priceFrom: 45.5, siret: '92520576700013',
    });
    expect(cleanListing({ ...base, websiteUrl: 'exemple.fr' }).fields.websiteUrl).toBe('https://exemple.fr/');
    expect(cleanListing({ ...base, guestsMin: '300', guestsMax: '20' }).error).toMatch(/convives/);
    expect(cleanListing({ ...base, displayName: 'A' }).error).toMatch(/nom/i);
    expect(cleanListing({ ...base, tagline: 'x'.repeat(141) }).error).toMatch(/accroche/);
    expect(cleanListing({ ...base, description: 'x'.repeat(3001) }).error).toMatch(/présentation/);
    expect(cleanListing({ ...base, departments: ['ZZ'] }).error).toMatch(/département/);
    expect(cleanListing({ ...base, eventTypes: [] }).error).toMatch(/événement/);
    expect(cleanListing({ ...base, priceFrom: '-3' }).error).toMatch(/prix/);
  });

  it('dit ce qui manque avant de soumettre', () => {
    expect(readyToSubmit(complete, 1)).toBeNull();
    expect(readyToSubmit(complete, 0)).toMatch(/photo/);
    expect(readyToSubmit({ ...complete, siret: null }, 1)).toMatch(/SIRET/);
    expect(readyToSubmit({ ...complete, siret: '123' }, 1)).toMatch(/SIRET/);
    expect(readyToSubmit({ ...complete, description: 'Court' }, 1)).toMatch(/présentation/);
    expect(readyToSubmit({ ...complete, city: null }, 1)).toMatch(/ville/);
    expect(readyToSubmit({ ...complete, postalCode: null }, 1)).toMatch(/code postal/);
    expect(readyToSubmit({ ...complete, departments: [] }, 1)).toMatch(/département/);
    expect(readyToSubmit({ ...complete, eventTypes: [] }, 1)).toMatch(/événement/);
  });
});
