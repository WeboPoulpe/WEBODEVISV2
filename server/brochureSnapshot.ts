import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { brochure_versions } from '@/db/schema';
import { parseStudio } from '@/lib/brochureStudio';

// Versions automatiques des pages du Studio, prises par le serveur seulement (à l'enregistrement d'une brochure
// déjà vérifiée) : jamais appelable depuis le navigateur.

/** Versions automatiques gardées par brochure (les nommées restent toutes). */
const KEEP_AUTO = 60;
const AUTO_EVERY_MS = 30 * 60_000;

/**
 * Appelée avant d'enregistrer de nouvelles pages : garde l'état d'avant comme version automatique, si la dernière
 * date de plus de 30 minutes (un historique par séance de travail, pas par frappe).
 */
export async function snapshotBeforeSave(brochureId: string, previous: unknown, userId: string): Promise<void> {
  const doc = parseStudio(previous);
  if (!doc) return;
  const [last] = await db.select({ at: brochure_versions.created_at }).from(brochure_versions)
    .where(eq(brochure_versions.brochure_id, brochureId)).orderBy(desc(brochure_versions.created_at)).limit(1);
  if (last && Date.now() - new Date(last.at).getTime() < AUTO_EVERY_MS) return;
  await db.insert(brochure_versions).values({ brochure_id: brochureId, studio: doc, auto: true, created_by: userId });
  const old = await db.select({ id: brochure_versions.id }).from(brochure_versions)
    .where(and(eq(brochure_versions.brochure_id, brochureId), eq(brochure_versions.auto, true)))
    .orderBy(desc(brochure_versions.created_at)).offset(KEEP_AUTO);
  if (old.length) await db.delete(brochure_versions).where(inArray(brochure_versions.id, old.map((o) => o.id)));
}

