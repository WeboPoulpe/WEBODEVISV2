// Modification d'un devis par Webo, sans base : la même règle sert à l'aperçu de la proposition et à son exécution
// (sur le devis tel qu'il est au moment de la validation).

/** Statuts où un devis se modifie encore (pas validé, payé, refusé). */
export const EDITABLE_STATUSES = ['nouveau', 'broch_envoyee', 'devis_a_faire', 'devis_envoye', 'rdv_deg_a_venir', 'rdv_deg_fait', 'devis_final'];

export interface QuoteUpdateSpec {
  quoteId: string;
  guestCount: number | null;
  eventDate: string | null;
  eventLocation: string | null;
  /** Lignes ajoutées, déjà construites (prix du catalogue). */
  add: ({ name: string; quantity: number; unitPrice: number } & Record<string, unknown>)[];
  /** Noms des lignes retirées (sans tenir compte des majuscules). */
  remove: string[];
}

type Line = { id?: string; name?: string; quantity?: number } & Record<string, unknown>;

/**
 * Lignes et couverts après modification : lignes retirées, quantités « au couvert » suivant les couverts, ajouts.
 * Les adultes (prix enfant) suivent aussi : nouveaux couverts moins les enfants.
 */
export function applyQuoteUpdate(
  quote: { services: unknown; guestCount: number; adults?: number | null; children?: number | null },
  spec: QuoteUpdateSpec,
): { services: Line[]; guestCount: number; adults: number | null } {
  const remove = new Set(spec.remove.map((n) => n.toLowerCase()));
  const oldGuests = quote.guestCount;
  const guests = spec.guestCount ?? oldGuests;
  const kept = ((Array.isArray(quote.services) ? quote.services : []) as Line[])
    .filter((l) => !remove.has(String(l.name ?? '').toLowerCase()))
    // Comme l'éditeur : une ligne dont la quantité était le nombre de couverts suit le nouveau nombre.
    .map((l) => (spec.guestCount != null && l.quantity === oldGuests ? { ...l, quantity: guests } : l));
  const added = spec.add.map(({ fromCatalogue: _f, ...l }) => ({ id: crypto.randomUUID(), ...l }));
  const adults = quote.adults == null ? null : spec.guestCount != null ? Math.max(0, guests - (quote.children ?? 0)) : quote.adults;
  return { services: [...kept, ...added], guestCount: guests, adults };
}
