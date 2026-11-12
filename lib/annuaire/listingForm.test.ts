import { describe, expect, it } from 'vitest';
import { cleanListing, type ListingFields } from './listing';
import { inputOf } from './listingForm';

const fields: ListingFields = {
  displayName: 'Convivial Event', tagline: null, description: 'Cuisine de saison', city: 'Reims', postalCode: '51100',
  departments: ['51'], eventTypes: ['Mariage'], websiteUrl: null, guestsMin: 20, guestsMax: null, priceFrom: 45.5, siret: '92520576700013',
};

describe('inputOf', () => {
  it('met les champs vides en chaînes vides et les nombres en chaînes', () => {
    expect(inputOf(fields)).toMatchObject({ tagline: '', websiteUrl: '', guestsMin: '20', guestsMax: '', priceFrom: '45,5' });
  });
  it('fait l’aller-retour avec le nettoyage de la saisie', () => {
    expect(cleanListing(inputOf(fields)).fields).toEqual(fields);
  });
});
