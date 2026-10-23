import { requireWriter } from '@/server/session';
import { runWeboTurn } from '@/server/webo/turn';

// Discussion avec Webo, en flux : une ligne JSON par événement (spécialiste choisi, texte au fil de l'eau, fin ou erreur).
// Si le navigateur part en route, le tour continue jusqu'au bout : la réponse est payée et enregistrée.

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
  const body = (await req.json().catch(() => null)) as { conversationId?: unknown; text?: unknown; path?: unknown } | null;
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null;
  const text = typeof body?.text === 'string' ? body.text : '';
  const path = typeof body?.path === 'string' ? body.path.slice(0, 300) : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await runWeboTurn(user, { conversationId, text, path }, (e) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`)));
      try { controller.close(); } catch { /* déjà fermé par le navigateur */ }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
