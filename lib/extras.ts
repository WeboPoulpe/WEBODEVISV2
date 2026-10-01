// Extras : rôles, statuts d'une mission, effectif conseillé et message d'invitation.
// Partagé entre la page Extras, l'onglet Équipe d'un événement et la page de missions de l'extra.

/** Rôles proposés, pour que tout le monde écrive la même chose et que l'équipe se compte par rôle. */
export const EXTRA_ROLES = ['Serveur', 'Chef de rang', 'Maître d’hôtel', 'Barman', 'Cuisinier', 'Commis de cuisine', 'Plongeur', 'Chauffeur', 'Livreur'] as const;

export type MissionStatus = 'a_solliciter' | 'confirme' | 'refuse' | 'present';

export const MISSION_STATUSES: { key: MissionStatus; label: string; tone: string }[] = [
  { key: 'a_solliciter', label: 'En attente', tone: 'bg-amber-100 text-amber-800' },
  { key: 'confirme', label: 'Confirmé', tone: 'bg-sage-100 text-sage' },
  { key: 'refuse', label: 'Indisponible', tone: 'bg-danger/10 text-danger' },
  { key: 'present', label: 'Présent', tone: 'bg-forest text-white' },
];

export const missionStatus = (s: string | null | undefined) => MISSION_STATUSES.find((m) => m.key === s) ?? MISSION_STATUSES[0];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Famille d'un rôle, pour compter l'équipe : service, cuisine, plonge, transport. */
export function roleFamily(role: string | null | undefined): 'service' | 'cuisine' | 'plonge' | 'transport' | null {
  const r = fold(role ?? '');
  if (!r) return null;
  if (/plong/.test(r)) return 'plonge';
  if (/cuisin|commis|chef(?! de rang)|traiteur/.test(r)) return 'cuisine';
  if (/chauffeur|livr|transport/.test(r)) return 'transport';
  if (/serv|rang|maitre|barman|barmaid|hote|sommelier/.test(r)) return 'service';
  return null;
}

export const FAMILY_LABELS: Record<'service' | 'cuisine' | 'plonge', [string, string]> = {
  service: ['serveur', 'serveurs'],
  cuisine: ['cuisinier', 'cuisiniers'],
  plonge: ['plongeur', 'plongeurs'],
};

/**
 * Effectif conseillé selon le nombre de couverts et le type de réception : un repère de métier
 * (un serveur pour 15 couverts à table, 25 en cocktail ; un cuisinier pour 50 ; un plongeur pour 80).
 */
export function suggestedStaff(guests: number | null | undefined, eventType?: string | null): Record<'service' | 'cuisine' | 'plonge', number> {
  const n = Math.max(0, guests ?? 0);
  if (!n) return { service: 0, cuisine: 0, plonge: 0 };
  const standing = /cocktail|vin d.honneur|apero|buffet|lunch/.test(fold(eventType ?? ''));
  return {
    service: Math.max(1, Math.ceil(n / (standing ? 25 : 15))),
    cuisine: Math.max(1, Math.ceil(n / 50)),
    plonge: n >= 40 ? Math.ceil(n / 80) : 0,
  };
}

const dateLong = (d: string | null | undefined) =>
  d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

/** Texte prêt à envoyer par SMS ou WhatsApp. */
export function missionMessage(p: {
  extraName: string; companyName?: string | null; eventType?: string | null; eventDate?: string | null;
  location?: string | null; arrival?: string | null; departure?: string | null; link: string;
}): string {
  const first = p.extraName.trim().split(/\s+/)[0] ?? '';
  const hours = p.arrival ? ` de ${p.arrival}${p.departure ? ` à ${p.departure}` : ''}` : '';
  const what = [p.eventType || 'Événement', dateLong(p.eventDate)].filter(Boolean).join(' le ');
  return [
    `Bonjour ${first},`,
    `${p.companyName ? `${p.companyName} vous propose` : 'Je vous propose'} une mission : ${what}${hours}${p.location ? `, ${p.location}` : ''}.`,
    `Tous les détails, et pour répondre : ${p.link}`,
  ].join('\n');
}

/** Numéro au format international sans « + », pour un lien WhatsApp (France par défaut). */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) return `33${digits.slice(1)}`;
  return digits;
}
