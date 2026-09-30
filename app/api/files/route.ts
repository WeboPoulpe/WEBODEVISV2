import { NextResponse, type NextRequest } from 'next/server';
import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getSessionUser } from '@/server/session';

// Fichiers des utilisateurs (logos, photos, devis importés), stockés sur Vercel Blob.
// Le navigateur envoie le fichier directement à Blob ; cette route ne fait que délivrer
// l'autorisation, après avoir vérifié que le fichier va bien dans le dossier de l'utilisateur.

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/*',
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
        const user = await getSessionUser();
        if (!user) throw new Error('Non connecté');
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  const { paths } = (await request.json()) as { paths?: string[] };
  const own = (paths ?? []).filter((p) => typeof p === 'string' && p.startsWith(`${user.id}/`) && !p.includes('..'));
  if (own.length === 0) return NextResponse.json({ error: 'Aucun fichier à supprimer' }, { status: 400 });
  await del(own);
  return NextResponse.json({ deleted: own.length });
}
