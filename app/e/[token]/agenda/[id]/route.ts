import { getMissionPage } from '@/server/missions';

// Une mission au format agenda (.ics) : le téléphone propose de l'ajouter à son calendrier.

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const local = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '').padEnd(4, '0')}00`;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const page = await getMissionPage(token);
  const m = page?.missions.find((x) => x.id === id);
  if (!page || !m || !m.eventDate) return new Response('Mission introuvable', { status: 404 });

  const title = `${m.eventType || 'Mission'} – ${page.company.name}`;
  const description = [
    m.clientName && `Client : ${m.clientName}`,
    m.guestCount ? `${m.guestCount} couverts` : '',
    m.notes ? `Consignes : ${m.notes}` : '',
    page.company.phone ? `Contact : ${page.company.phone}` : '',
  ].filter(Boolean).join('\n');

  const hhmm = (t: string | null) => (t && /^\d{1,2}:\d{2}/.test(t) ? t.slice(0, 5).padStart(5, '0') : null);
  const start = hhmm(m.arrival);
  const end = hhmm(m.departure);
  let when: string[];
  if (start) {
    // Sans heure de fin : quatre heures par défaut ; une fin avant le début passe au lendemain.
    let endDate = m.eventDate, endTime = end;
    if (!endTime) {
      const [h, mi] = start.split(':').map(Number);
      const total = h * 60 + mi + 240;
      endTime = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      if (total >= 1440) endDate = nextDay(m.eventDate);
    } else if (endTime <= start) endDate = nextDay(m.eventDate);
    when = [`DTSTART;TZID=Europe/Paris:${local(m.eventDate, start)}`, `DTEND;TZID=Europe/Paris:${local(endDate, endTime)}`];
  } else {
    when = [`DTSTART;VALUE=DATE:${m.eventDate.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(m.eventDate).replace(/-/g, '')}`];
  }

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WeboDevis//Missions//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${m.id}@webodevis.fr`,
    `DTSTAMP:${stamp(new Date())}`,
    ...when,
    `SUMMARY:${esc(title)}`,
    ...(m.location ? [`LOCATION:${esc(m.location)}`] : []),
    ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="mission-${m.eventDate}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function nextDay(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
