import { getSession } from 'next-auth/react';
import { upload as blobUpload } from '@vercel/blob/client';
import { QueryBuilder, type QueryDescriptor, type QueryResult } from '@/lib/compat/builder';

// Client historique de l'app, désormais branché sur Neon et Vercel Blob : même syntaxe
// `.from(...).select(...)` et `.storage.from(...)`, mais tout passe par le serveur,
// qui applique les règles d'accès.

// Les requêtes lancées au même moment (chargement d'une page, compteurs du menu…) partent dans un seul
// appel HTTP : une seule vérification de session, puis exécution en parallèle côté serveur.
// Le passage en JSON retire les `undefined` et transforme les dates en texte, comme le faisait supabase-js.
let pending: { descriptor: QueryDescriptor; resolve: (result: QueryResult) => void }[] = [];
let scheduled = false;

// Le serveur accepte au plus 40 requêtes par appel.
const MAX_BATCH = 40;

async function flush() {
  const batch = pending.slice(0, MAX_BATCH);
  pending = pending.slice(MAX_BATCH);
  scheduled = pending.length > 0;
  if (scheduled) setTimeout(flush, 0);
  const fail = (message: string) => batch.forEach((b) => b.resolve({ data: null, count: null, error: { message } }));
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: batch.map((b) => b.descriptor) }),
    });
    const body = await res.json();
    if (!Array.isArray(body.results)) { fail(body.error ?? 'Le serveur n’a pas répondu correctement.'); return; }
    batch.forEach((b, i) => b.resolve(body.results[i]));
  } catch {
    fail('Connexion au serveur impossible. Vérifiez votre réseau.');
  }
}

const execute = (descriptor: QueryDescriptor): Promise<QueryResult> =>
  new Promise((resolve) => {
    pending.push({ descriptor, resolve });
    if (!scheduled) { scheduled = true; setTimeout(flush, 0); }
  });

// Adresse publique de chaque fichier envoyé pendant cette session (chemin → URL).
const uploadedUrls = new Map<string, string>();

const storage = {
  // Le nom du « bucket » est ignoré : il n'y a qu'un espace de stockage, rangé par dossier d'utilisateur.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  from: (_bucket: string) => ({
    async upload(path: string, file: Blob, options?: { upsert?: boolean }) {
      try {
        const blob = await blobUpload(path, file, {
          access: 'public',
          handleUploadUrl: '/api/files',
          clientPayload: JSON.stringify({ upsert: !!options?.upsert }),
        });
        uploadedUrls.set(path, blob.url);
        return { data: { path }, error: null };
      } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : 'Le fichier n’a pas pu être envoyé.' } };
      }
    },
    /** Adresse publique d'un fichier qui vient d'être envoyé. */
    getPublicUrl(path: string) {
      return { data: { publicUrl: uploadedUrls.get(path) ?? '' } };
    },
    async remove(paths: string[]) {
      const res = await fetch('/api/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths }) });
      if (!res.ok) return { data: null, error: { message: (await res.json().catch(() => null))?.error ?? 'Le fichier n’a pas pu être supprimé.' } };
      return { data: paths, error: null };
    },
  }),
};

export function createClient() {
  return {
    from: (table: string) => new QueryBuilder(execute, table),
    auth: {
      async getUser() {
        const session = await getSession();
        return { data: { user: session?.user ? { id: session.user.id, email: session.user.email } : null }, error: null };
      },
    },
    storage,
  };
}
