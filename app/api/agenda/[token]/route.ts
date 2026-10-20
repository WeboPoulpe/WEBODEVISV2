import { appOrigin } from '@/lib/mail';
import { calendarFeed } from '@/server/calendarFeed';

// Abonnement agenda d'un traiteur : /api/agenda/<jeton>.ics, relu régulièrement par son application d'agenda.
// L'adresse elle-même sert de clé : un jeton inconnu (ou remplacé depuis Paramètres) ne donne rien.

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ics = await calendarFeed(token.replace(/\.ics$/i, ''), await appOrigin());
  if (!ics) return new Response('Agenda introuvable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="webodevis.ics"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
