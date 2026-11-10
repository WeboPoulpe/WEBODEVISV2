import { NextResponse, type NextRequest } from 'next/server';
import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import { requireWriter, UnauthorizedError } from '@/server/session';

// Fichiers des utilisateurs (logos, photos, devis importés), stockés sur Vercel Blob.
// Le navigateur envoie le fichier directement à Blob ; cette route ne fait que délivrer
// l'autorisation, après avoir vérifié que le fichier va bien dans le dossier de l'utilisateur.

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/*',
  // Vidéos courtes des brochures (Studio).
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const notConfigured = () =>
  NextResponse.json({ error: 'Le stockage de fichiers n’est pas encore configuré (BLOB_READ_WRITE_TOKEN manquant).' }, { status: 503 });

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return notConfigured();
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Envoi : refusé en consultation seule et sans abonnement actif.
        const user = await requireWriter();
        if (isDemoUser(user.id)) throw new Error(DEMO_BLOCKED);
        // Chaque compte n'écrit que dans son propre dossier.
        if (!pathname.startsWith(`${user.id}/`) || pathname.includes('..')) throw new Error('Emplacement refusé');
        const upsert = clientPayload ? !!JSON.parse(clientPayload).upsert : false;
        return { allowedContentTypes: ALLOWED_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: false, allowOverwrite: upsert };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Envoi refusé' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return notConfigured();
  let user: { id: string };
  try {
    user = await requireWriter();
  } catch (e) {
    const signedOut = e instanceof UnauthorizedError || !(e instanceof Error);
    return NextResponse.json({ error: signedOut ? 'Non connecté' : e.message }, { status: signedOut ? 401 : 403 });
  }
  if (isDemoUser(user.id)) return NextResponse.json({ error: DEMO_BLOCKED }, { status: 403 });
  const { paths } = (await request.json()) as { paths?: string[] };
  const own = (paths ?? []).filter((p) => typeof p === 'string' && p.startsWith(`${user.id}/`) && !p.includes('..'));
  if (own.length === 0) return NextResponse.json({ error: 'Aucun fichier à supprimer' }, { status: 400 });
  await del(own);
  return NextResponse.json({ deleted: own.length });
}
