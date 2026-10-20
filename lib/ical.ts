// Fichiers agenda au format iCalendar (RFC 5545) : mission d'un extra (.ics à ajouter) et abonnement
// agenda du traiteur (flux lu régulièrement par Google Agenda, Apple Calendrier ou Outlook).
// Règles du format : lignes terminées par CRLF, pliées à 75 octets, virgules et points-virgules échappés.

/** Échappe un texte (SUMMARY, LOCATION, DESCRIPTION…). */
export const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Horodatage UTC (DTSTAMP) : 20261020T160000Z. */
export const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const encoder = new TextEncoder();

/**
 * Plie une ligne à 75 octets : la suite repart sur une nouvelle ligne commençant par une espace.
 * Ne coupe jamais au milieu d'un caractère (accents, symboles en plusieurs octets).
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  // La première ligne a 75 octets ; les suivantes 74, plus l'espace de tête.
  let limit = 75;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (size + n > limit) {
      parts.push(current);
      current = '';
      size = 0;
      limit = 74;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** Heure « 9:30 », « 09:30:00 » → « 09:30 », sinon null. */
export function hhmm(t: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Jour suivant d'une date AAAA-MM-JJ. */
export function nextDay(date: string): string {
  const d = new Date(date.slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const compactDate = (date: string) => date.slice(0, 10).replace(/-/g, '');
const local = (date: string, time: string) => `${compactDate(date)}T${time.replace(':', '')}00`;

export interface IcsEvent {
  /** Identifiant stable : le même événement garde le même UID d'une lecture à l'autre. */
  uid: string;
  /** Date AAAA-MM-JJ. */
  date: string;
  /** Heure de début (heure de Paris) ; absente : journée entière. */
  start?: string | null;
  /** Heure de fin ; absente : quatre heures après le début. Une fin avant le début passe au lendemain. */
  end?: string | null;
  summary: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  status?: 'CONFIRMED' | 'TENTATIVE';
  /** Rappel affiché avant le début, en heures. */
  alarmHours?: number;
}

/** Lignes DTSTART / DTEND d'un événement. */
export function whenLines(e: Pick<IcsEvent, 'date' | 'start' | 'end'>): string[] {
  const start = hhmm(e.start);
  if (!start) return [`DTSTART;VALUE=DATE:${compactDate(e.date)}`, `DTEND;VALUE=DATE:${compactDate(nextDay(e.date))}`];
  let endDate = e.date.slice(0, 10);
  let endTime = hhmm(e.end);
  if (!endTime) {
    const [h, mi] = start.split(':').map(Number);
    const total = h * 60 + mi + 240;
    endTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    if (total >= 1440) endDate = nextDay(endDate);
  } else if (endTime <= start) endDate = nextDay(endDate);
  return [`DTSTART;TZID=Europe/Paris:${local(e.date, start)}`, `DTEND;TZID=Europe/Paris:${local(endDate, endTime)}`];
}

// Fuseau de Paris décrit dans le fichier, comme le veut la norme pour tout TZID utilisé.
const PARIS_TIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

export function buildCalendar({ prodId, name, events, now = new Date() }: {
  prodId: string;
  /** Nom du calendrier affiché par l'agenda abonné. */
  name?: string;
  events: IcsEvent[];
  now?: Date;
}): string {
  const stamp = icsStamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...(name ? [`X-WR-CALNAME:${icsText(name)}`, 'X-WR-TIMEZONE:Europe/Paris', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'] : []),
  ];
  if (events.some((e) => hhmm(e.start))) lines.push(...PARIS_TIMEZONE);
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      ...whenLines(e),
      `SUMMARY:${icsText(e.summary)}`,
      ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      ...(e.status ? [`STATUS:${e.status}`] : []),
      ...(e.alarmHours ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.summary)}`, `TRIGGER:-PT${e.alarmHours}H`, 'END:VALARM'] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
