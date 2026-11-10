import { NextResponse, type NextRequest } from 'next/server';
import { SITE_EVENTS, type SiteEvent } from '@/lib/siteStats';
import { buildRow, recordHit } from '@/server/siteStats';

// Collecte des statistiques du site (components/site/SiteAnalytics.tsx, via navigator.sendBeacon). Sans cookie,
// sans adresse IP gardée. Une personne connectée (l'équipe, un traiteur) n'est pas comptée : seuls les visiteurs.
// La visite part dans le paquet en attente (server/siteStats.ts) : la base n'est pas réveillée à chaque page.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token'];

export async function POST(request: NextRequest) {
  if (SESSION_COOKIES.some((c) => request.cookies.has(c))) return new NextResponse(null, { status: 204 });
  let body: { path?: unknown; referrer?: unknown; event?: unknown };
  try {
    body = JSON.parse((await request.text()).slice(0, 2000));
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const event = SITE_EVENTS.includes(body.event as SiteEvent) ? (body.event as SiteEvent) : 'view';
  // Seule la démo se déclare depuis le navigateur ; contact et inscription sont comptés côté serveur.
  if (event !== 'view' && event !== 'demo') return new NextResponse(null, { status: 204 });
  const row = buildRow(
    { path: String(body.path ?? ''), referrer: typeof body.referrer === 'string' ? body.referrer : null, event },
    {
      ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim(),
      userAgent: request.headers.get('user-agent') ?? '',
      ownHost: request.headers.get('host') ?? '',
    },
  );
  if (row) await recordHit(row);
  return new NextResponse(null, { status: 204 });
}
