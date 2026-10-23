import { after } from 'next/server';
import { requireWriter } from '@/server/session';
import { runWeboTurn, type WeboImage } from '@/server/webo/turn';

// Discussion avec Webo, en flux : une ligne JSON par événement (spécialiste choisi, texte au fil de l'eau, fin ou erreur).
// Le tour est confié à la plateforme (after) : si le navigateur part en route, il va quand même au bout — la réponse
// est payée, enregistrée, et la conversation libérée. Le flux ne fait que relayer ses événements.

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let user: { id: string };
  try {
    user = await requireWriter();
  } catch (e) {
    const readOnly = e instanceof Error && e.name === 'ReadOnlyError';
    return Response.json({ error: readOnly ? 'Votre accès est en consultation seule : Webo ne peut pas agir pour vous.' : 'Connectez-vous pour parler à Webo.' }, { status: readOnly ? 403 : 401 });
  }
  const body = (await req.json().catch(() => null)) as { conversationId?: unknown; text?: unknown; path?: unknown; image?: unknown } | null;
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null;
  const text = typeof body?.text === 'string' ? body.text : '';
  const path = typeof body?.path === 'string' ? body.path.slice(0, 300) : undefined;
  // Photo : vérifiée (type, taille) par runWeboTurn avant toute réservation de pièces.
  const raw = body?.image as { mediaType?: unknown; data?: unknown } | null | undefined;
  const image = raw && typeof raw.mediaType === 'string' && typeof raw.data === 'string' ? { mediaType: raw.mediaType, data: raw.data } as WeboImage : null;

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    cancel() { closed = true; },
  });
  const push = (e: unknown) => {
    if (closed) return;
    try { controller?.enqueue(encoder.encode(`${JSON.stringify(e)}\n`)); } catch { closed = true; }
  };
  const turn = runWeboTurn(user, { conversationId, text, path, image }, push).finally(() => {
    if (!closed) { closed = true; try { controller?.close(); } catch { /* déjà fermé */ } }
  });
  after(turn);
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
