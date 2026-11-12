// Passage des champs enregistrés de la fiche à la saisie brute du formulaire (tout en chaînes, nombres compris).
import type { ListingFields, ListingInput } from './listing';

export function inputOf(fields: ListingFields): ListingInput {
  return {
    displayName: fields.displayName,
    tagline: fields.tagline ?? '',
    description: fields.description ?? '',
    city: fields.city ?? '',
    postalCode: fields.postalCode ?? '',
    departments: [...fields.departments],
    eventTypes: [...fields.eventTypes],
    websiteUrl: fields.websiteUrl ?? '',
    guestsMin: fields.guestsMin === null ? '' : String(fields.guestsMin),
    guestsMax: fields.guestsMax === null ? '' : String(fields.guestsMax),
    priceFrom: fields.priceFrom === null ? '' : String(fields.priceFrom).replace('.', ','),
    siret: fields.siret ?? '',
  };
}
