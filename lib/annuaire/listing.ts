// Règles pures de la fiche de l'annuaire : visibilité, adresse (slug), nettoyage de la saisie, contrôle avant envoi.
import type { Access } from '@/lib/subscription';
import { cleanPaymentUrl } from '@/lib/paymentLink';
import { cleanSiret } from '@/lib/companies';
import { departmentByCode } from './departments';
import { isEventType } from './eventTypes';

export type ListingStatus = 'brouillon' | 'en_attente' | 'publiee' | 'refusee' | 'suspendue';

/** Une fiche n'est publique que si elle est publiée, que le compte est actif, en cours de vie et à jour de son abonnement. */
export function listingVisible(
  l: { status: ListingStatus },
  account: { access: Access; active: boolean; deleting: boolean },
): boolean {
  return l.status === 'publiee' && account.access === 'full' && account.active && !account.deleting;
}

const SLUG_MAX = 60;

/** Minuscules, sans accents, lettres, chiffres et tirets seulement ; 60 caractères au plus ; « traiteur » si rien ne reste. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return slug || 'traiteur';
}

/** Adresse de la fiche : nom et ville, puis -2, -3… tant qu'elle est déjà prise. */
export function listingSlug(name: string, city: string | null, taken: (slug: string) => boolean): string {
  const base = slugify([name, city].filter(Boolean).join(' '));
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken(candidate)) return candidate;
  }
}

/** Saisie brute du formulaire : tout en chaînes, nombres compris. */
export interface ListingInput {
  displayName: string;
  tagline: string;
  description: string;
  city: string;
  postalCode: string;
  departments: string[];
  eventTypes: string[];
  websiteUrl: string;
  guestsMin: string;
  guestsMax: string;
  priceFrom: string;
  siret: string;
}

/** Les mêmes champs, nettoyés : null quand vide, nombres en nombres. */
export interface ListingFields {
  displayName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  postalCode: string | null;
  departments: string[];
  eventTypes: string[];
  websiteUrl: string | null;
  guestsMin: number | null;
  guestsMax: number | null;
  priceFrom: number | null;
  siret: string | null;
}

const NAME_MIN = 2;
const NAME_MAX = 80;
const TAGLINE_MAX = 140;
const DESCRIPTION_MAX = 3000;
const DESCRIPTION_MIN_TO_SUBMIT = 80;
const CITY_MAX = 80;

/** Texte brut : balises retirées, espaces superflus réduits, sauts de ligne gardés. */
const plain = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const orNull = (v: string) => v || null;

/** Nombre entier positif saisi en chaîne : null si vide, NaN si illisible. */
function whole(value: string): number | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  return /^\d{1,9}$/.test(v) ? Number(v) : Number.NaN;
}

function price(value: string): number | null {
  const v = (value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!v) return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(v)) return Number.NaN;
  return Number(v);
}

export function cleanListing(input: ListingInput): { fields: ListingFields; error: string | null } {
  const guestsMin = whole(input.guestsMin);
  const guestsMax = whole(input.guestsMax);
  const priceFrom = price(input.priceFrom);
  const departments = [...new Set((input.departments ?? []).filter((c) => !!departmentByCode(c)))];
  const eventTypes = [...new Set((input.eventTypes ?? []).filter(isEventType))];
  const postal = (input.postalCode ?? '').replace(/\s/g, '');
  const siretDigits = (cleanSiret(input.siret) ?? '').replace(/\D/g, '');

  const fields: ListingFields = {
    displayName: plain(input.displayName).replace(/\s+/g, ' '),
    tagline: orNull(plain(input.tagline).replace(/\s+/g, ' ')),
    description: orNull(plain(input.description)),
    city: orNull(plain(input.city).replace(/\s+/g, ' ')),
    postalCode: orNull(postal),
    departments,
    eventTypes,
    websiteUrl: cleanPaymentUrl(input.websiteUrl),
    guestsMin: guestsMin !== null && Number.isNaN(guestsMin) ? null : guestsMin,
    guestsMax: guestsMax !== null && Number.isNaN(guestsMax) ? null : guestsMax,
    priceFrom: priceFrom !== null && Number.isNaN(priceFrom) ? null : priceFrom,
    siret: orNull(siretDigits),
  };

  const fail = (error: string) => ({ fields, error });
  const len = fields.displayName.length;
  if (len < NAME_MIN || len > NAME_MAX) return fail(`Le nom de l’entreprise doit faire entre ${NAME_MIN} et ${NAME_MAX} caractères.`);
  if (fields.tagline && fields.tagline.length > TAGLINE_MAX) return fail(`L’accroche ne peut pas dépasser ${TAGLINE_MAX} caractères.`);
  if (fields.description && fields.description.length > DESCRIPTION_MAX) return fail(`La présentation ne peut pas dépasser ${DESCRIPTION_MAX} caractères.`);
  if (fields.city && fields.city.length > CITY_MAX) return fail(`Le nom de la ville est trop long.`);
  if (postal && !/^\d{5}$/.test(postal)) return fail('Le code postal doit comporter 5 chiffres.');
  if (!departments.length) return fail('Choisissez au moins un département où vous intervenez.');
  if (!eventTypes.length) return fail('Choisissez au moins un type d’événement.');
  if (Number.isNaN(guestsMin) || Number.isNaN(guestsMax)) return fail('Le nombre de convives doit être un nombre entier.');
  if (guestsMin !== null && guestsMax !== null && guestsMin > guestsMax) return fail('Le nombre minimum de convives ne peut pas dépasser le maximum.');
  if (Number.isNaN(priceFrom)) return fail('Le prix doit être un montant positif, par exemple 45,50.');
  return { fields, error: null };
}

/** Ce qui manque pour envoyer la fiche à la validation, ou null si elle est prête. */
export function readyToSubmit(fields: ListingFields, photoCount: number): string | null {
  const missing: string[] = [];
  if (fields.displayName.trim().length < NAME_MIN) missing.push('le nom de l’entreprise');
  if (!fields.city) missing.push('la ville');
  if (!fields.postalCode) missing.push('le code postal');
  if ((fields.description ?? '').length < DESCRIPTION_MIN_TO_SUBMIT) missing.push(`une présentation d’au moins ${DESCRIPTION_MIN_TO_SUBMIT} caractères`);
  if (!fields.departments.length) missing.push('un département');
  if (!fields.eventTypes.length) missing.push('un type d’événement');
  if (!/^\d{14}$/.test(fields.siret ?? '')) missing.push('le SIRET (14 chiffres)');
  if (photoCount < 1) missing.push('une photo');
  return missing.length ? `Pour envoyer la fiche, il manque : ${missing.join(', ')}.` : null;
}
