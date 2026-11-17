import { NextResponse, type NextRequest } from 'next/server';
import { originFromPath, safeDestination } from '@/lib/origine';
import { buildRow, recordHit } from '@/server/siteStats';

// Lien court des posts et stories Instagram : webodevis.fr/ig (bio) et webodevis.fr/ig/<libellé> (une story).
// Le clic part dans le paquet des statistiques (sans réveiller la base), puis la visite continue sur le site avec
// ?o=<origine>, que components/site/OrigineCapture.tsx garde le temps de la visite. Une personne connectée
// (l'équipe) et les robots sont redirigés sans être comptés. Destination : un chemin du site (?vers=/demo), jamais
// une autre adresse. Voir lib/origine.ts.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIES = ['next-auth.session-token', '__Secure-next-auth.session-token'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ libelle?: string[] }> }) {
  const { libelle } = await params;
  const origin = originFromPath(libelle);

  if (!SESSION_COOKIES.some((c) => request.cookies.has(c))) {
    const row = buildRow(
      { path: origin === 'instagram' ? '/ig' : `/ig/${origin.slice('instagram:'.length)}`, event: 'clic', origin },
      {
        ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim(),
        userAgent: request.headers.get('user-agent') ?? '',
        ownHost: request.headers.get('host') ?? '',
      },
    );
    // La mesure ne doit jamais empêcher d'arriver sur le site.
    if (row) await recordHit(row).catch(() => {});
  }

  let target = new URL(safeDestination(request.nextUrl.searchParams.get('vers')), request.nextUrl.origin);
  // Deuxième garde : quoi que contienne ?vers=, on ne quitte jamais le site.
  if (target.origin !== request.nextUrl.origin) target = new URL('/site', request.nextUrl.origin);
  target.searchParams.set('o', origin);
  return NextResponse.redirect(target, 302);
}
