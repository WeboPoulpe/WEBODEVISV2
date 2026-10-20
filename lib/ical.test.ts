import { describe, expect, it } from 'vitest';
import { buildCalendar, foldLine, hhmm, icsText, whenLines } from './ical';

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('format iCalendar', () => {
  it('échappe virgules, points-virgules, barres obliques et retours à la ligne', () => {
    expect(icsText('Salle, étage 2; porte\\B\nCode 12')).toBe('Salle\\, étage 2\\; porte\\\\B\\nCode 12');
  });

  it('plie les lignes à 75 octets sans couper un caractère accentué', () => {
    expect(foldLine('SUMMARY:court')).toBe('SUMMARY:court');
    const long = `DESCRIPTION:${'é'.repeat(100)}`;
    const folded = foldLine(long);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    // Déplié, on retrouve la ligne d'origine.
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('journée entière sans heure, heure de Paris sinon', () => {
    expect(whenLines({ date: '2026-12-31' })).toEqual(['DTSTART;VALUE=DATE:20261231', 'DTEND;VALUE=DATE:20270101']);
    expect(whenLines({ date: '2026-12-12', start: '9:30' })).toEqual(['DTSTART;TZID=Europe/Paris:20261212T093000', 'DTEND;TZID=Europe/Paris:20261212T133000']);
    expect(whenLines({ date: '2026-12-12', start: '22:00:00', end: '02:00' })[1]).toBe('DTEND;TZID=Europe/Paris:20261213T020000');
    expect(hhmm('25:00')).toBeNull();
  });

  it('produit un calendrier en CRLF, avec fuseau seulement si une heure est donnée', () => {
    const now = new Date('2026-10-20T16:00:00Z');
    const allDay = buildCalendar({ prodId: '-//T//FR', name: 'Agenda', now, events: [{ uid: 'a@t', date: '2026-12-12', summary: 'Mariage, Dupont' }] });
    expect(allDay.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(allDay.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
    expect(allDay).toContain('SUMMARY:Mariage\\, Dupont');
    expect(allDay).toContain('DTSTAMP:20261020T160000Z');
    expect(allDay).not.toContain('VTIMEZONE');
    const timed = buildCalendar({ prodId: '-//T//FR', now, events: [{ uid: 'b@t', date: '2026-12-12', start: '18:00', summary: 'x', alarmHours: 2 }] });
    expect(timed).toContain('BEGIN:VTIMEZONE');
    expect(timed).toContain('TRIGGER:-PT2H');
  });
});
