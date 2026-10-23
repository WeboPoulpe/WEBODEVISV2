import 'server-only';
import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/db';
import { webo_memories } from '@/db/schema';

// Habitudes du traiteur retenues par Webo : lues pour les spécialistes, ajoutées seulement par une proposition validée.

export const MAX_MEMORIES = 30;
export const MAX_MEMORY_TEXT = 300;

export async function memoryCount(companyId: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(webo_memories).where(eq(webo_memories.company_id, companyId));
  return Number(r?.n ?? 0);
}

export async function memoriesOf(companyId: string) {
  return db.select({ id: webo_memories.id, text: webo_memories.text, created_at: webo_memories.created_at })
    .from(webo_memories).where(eq(webo_memories.company_id, companyId)).orderBy(asc(webo_memories.created_at));
}

/** Le texte redonné aux spécialistes (vide s'il n'y a rien). */
export async function memoriesText(companyId: string): Promise<string> {
  const rows = await memoriesOf(companyId);
  return rows.length ? `Habitudes du traiteur (à respecter sauf demande contraire) :\n${rows.map((r) => `- ${r.text}`).join('\n')}` : '';
}
