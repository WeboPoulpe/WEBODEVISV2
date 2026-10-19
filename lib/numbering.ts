// Format des numéros de documents (devis, factures, avoirs), réglé dans Paramètres et stocké dans
// profiles.numbering. Le numéro lui-même est attribué en base par next_document_number() (migration 0017) :
// ce module n'en fait qu'un aperçu, avec exactement les mêmes règles.

export type DocumentKind = 'quote' | 'invoice' | 'credit';

export interface NumberFormat {
  prefix: string;
  withYear: boolean;
  digits: number;
}

export type NumberingSettings = Partial<Record<DocumentKind, Partial<NumberFormat>>>;

export const KIND_LABELS: Record<DocumentKind, string> = { quote: 'Devis', invoice: 'Factures', credit: 'Avoirs' };

const DEFAULT_PREFIX: Record<DocumentKind, string> = { quote: 'D-', invoice: 'F-', credit: 'AV-' };

/** Format effectif d'un type de document : réglages du compte, sinon valeurs par défaut. */
export function numberFormat(settings: NumberingSettings | null | undefined, kind: DocumentKind): NumberFormat {
  const f = settings?.[kind] ?? {};
  const digits = Number.isFinite(Number(f.digits)) ? Math.min(Math.max(Math.trunc(Number(f.digits)), 1), 8) : 4;
  return { prefix: f.prefix ?? DEFAULT_PREFIX[kind], withYear: f.withYear ?? true, digits };
}

/** Numéro n au format donné, comme next_document_number() le produirait. */
export function formatDocumentNumber(format: NumberFormat, n: number, year = new Date().getFullYear()): string {
  return `${format.prefix}${format.withYear ? `${year}-` : ''}${String(n).padStart(format.digits, '0')}`;
}

/** Un préfixe reste court et lisible : lettres, chiffres, tirets, barres et points. */
export function cleanPrefix(prefix: string): string {
  return prefix.replace(/[^A-Za-z0-9\-_/.]/g, '').slice(0, 12);
}
