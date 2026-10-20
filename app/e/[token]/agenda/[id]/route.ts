import { buildCalendar } from '@/lib/ical';
import { getMissionPage } from '@/server/missions';

// Une mission au format agenda (.ics) : le téléphone propose de l'ajouter à son calendrier.

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

  // Sans heure d'arrivée : journée entière ; sans heure de fin : quatre heures par défaut.
  const ics = buildCalendar({
    prodId: '-//WeboDevis//Missions//FR',
    events: [{
      uid: `${m.id}@webodevis.fr`,
      date: m.eventDate,
      start: m.arrival,
      end: m.departure,
      summary: title,
      location: m.location,
      description,
      alarmHours: 2,
    }],
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="mission-${m.eventDate}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
