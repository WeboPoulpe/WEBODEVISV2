// Types d'événements proposés dans l'annuaire (liste fermée).
export const EVENT_TYPES = ['Mariage', 'Anniversaire', 'Cocktail', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(v: unknown): v is EventType {
  return typeof v === 'string' && (EVENT_TYPES as readonly string[]).includes(v);
}
