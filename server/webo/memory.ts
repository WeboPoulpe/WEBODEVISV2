'use server';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { webo_memories } from '@/db/schema';
import { requireUser, requireWriter } from '../session';
import { companyIdFor } from '../weboWallet';
import { memoriesOf } from './memoryStore';
import { isUuid } from './tools';

// « Ce que Webo retient » dans Paramètres : tous les membres voient la liste ; ceux qui peuvent modifier l'effacent.

export async function listWeboMemories(): Promise<{ id: string; text: string; created_at: string }[]> {
  const user = await requireUser();
  return memoriesOf(await companyIdFor(user.id));
}

export async function deleteWeboMemory(id: string): Promise<{ error: string | null }> {
  const user = await requireWriter();
  if (!isUuid(id)) return { error: 'Introuvable.' };
  const companyId = await companyIdFor(user.id);
  const [row] = await db.delete(webo_memories).where(and(eq(webo_memories.id, id), eq(webo_memories.company_id, companyId))).returning({ id: webo_memories.id });
  return row ? { error: null } : { error: 'Introuvable.' };
}
