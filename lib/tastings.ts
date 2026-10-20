// Rendez-vous de dégustation : libellés, heure de fin et fichier agenda (.ics). Fonctions pures, utilisables
// côté serveur comme dans le navigateur.

import { buildCalendar, hhmm } from './ical';

export type TastingStatus = 'prevu' | 'fait' | 'annule';

export const TASTING_STATUS_LABELS: Record<TastingStatus, string> = {
  prevu: 'Prévue',
  fait: 'Faite',
  annule: 'Annulée',
};

export interface Tasting {
  id: string;
  quote_id: string | null;
  /** Numéro du devis lié, s'il y en a un. */
  quote_number: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  /** AAAA-MM-JJ. */
  tasting_date: string;
  /** HH:MM, heure de Paris. */
  start_time: string;
  duration_minutes: number;
  location: string | null;
  guest_count: number | null;
  notes: string | null;
  status: TastingStatus;
  notify_client: boolean;
  reminder_sent_at: string | null;
}

/** Durées proposées dans le formulaire, en minutes. */
export const TASTING_DURATIONS = [30, 45, 60, 90, 120, 180];

/** Heure de fin « HH:MM » (passe minuit si besoin, sans changer de jour). */
export function tastingEnd(start: string, minutes: number): string {
  const s = hhmm(start) ?? '00:00';
  const [h, m] = s.split(':').map(Number);
  const total = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** « 1 h 30 », « 45 min ». */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** « 14 h 30 ». */
export const timeFr = (t: string) => (hhmm(t) ?? t).replace(':', ' h ');

/** Fichier agenda d'une dégustation, joint aux emails du client : son téléphone propose de l'ajouter. */
export function tastingIcs({ id, date, start, minutes, companyName, location, description }: {
  id: string;
  date: string;
  start: string;
  minutes: number;
  companyName: string;
  location: string | null;
  description?: string | null;
}): string {
  return buildCalendar({
    prodId: '-//WeboDevis//Degustations//FR',
    events: [{
      uid: `degustation-${id}@webodevis.fr`,
      date,
      start,
      end: tastingEnd(start, minutes),
      summary: `Dégustation – ${companyName}`,
      location,
      description,
      status: 'CONFIRMED',
      alarmHours: 2,
    }],
  });
}
