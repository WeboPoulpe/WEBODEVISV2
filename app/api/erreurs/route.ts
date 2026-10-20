import { NextResponse, type NextRequest } from 'next/server';
import { recordError } from '@/server/errorLog';
import { getSessionUser } from '@/server/session';

// Erreurs remontées par le navigateur (components/ErrorReporter.tsx). Ouvert à tous — une page publique peut aussi
// planter — mais borné : taille du message limitée, 20 envois par minute et par connexion, et plafond global
// d'erreurs nouvelles par heure dans server/errorLog.ts.

export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { n: number; until: number }>();

export async function POST(request: NextRequest) {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.until > now && h.n >= MAX_PER_WINDOW) return new NextResponse(null, { status: 204 });
  hits.set(ip, h && h.until > now ? { n: h.n + 1, until: h.until } : { n: 1, until: now + WINDOW_MS });
  if (hits.size > 5000) hits.clear();

  const text = await request.text().catch(() => '');
  if (!text || text.length > 16_000) return new NextResponse(null, { status: 204 });
  let body: { message?: unknown; stack?: unknown; path?: unknown; digest?: unknown };
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 204 }); }
  if (typeof body.message !== 'string' || !body.message.trim()) return new NextResponse(null, { status: 204 });

  const user = await getSessionUser().catch(() => null);
  await recordError({
    source: 'navigateur',
    message: body.message,
    stack: typeof body.stack === 'string' ? body.stack : null,
    path: typeof body.path === 'string' ? body.path : null,
    digest: typeof body.digest === 'string' ? body.digest : null,
    userId: user?.id ?? null,
    userAgent: request.headers.get('user-agent'),
  }).catch((e) => console.error('[erreurs]', e));
  return new NextResponse(null, { status: 204 });
}
