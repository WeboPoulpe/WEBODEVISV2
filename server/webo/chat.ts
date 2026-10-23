'use server';

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { webo_conversations } from '@/db/schema';
import { requireUser, requireWriter } from '../session';
import { isUuid } from './tools';
import { proposalsByIds, runWeboTurn, type ProposalView, type TranscriptEntry, type TurnResult } from './turn';

// Actions de la discussion avec Webo. L'envoi passe d'ordinaire par la route /api/webo/chat (réponse au fil de l'eau) ;
// sendWeboMessage fait le même tour sans flux.

export type { ProposalView, TranscriptEntry, WeboReply } from './turn';

/** 👍 / 👎 sur une réponse de Webo (null : retirer la note). Seulement l'auteur de la conversation. */
export async function rateWeboReply(conversationId: string, index: number, rating: 'up' | 'down' | null): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!isUuid(conversationId) || !Number.isInteger(index) || ![null, 'up', 'down'].includes(rating)) return { error: 'Note impossible.' };
  const [conv] = await db.select().from(webo_conversations).where(and(eq(webo_conversations.id, conversationId), eq(webo_conversations.user_id, user.id))).limit(1);
  const transcript = (conv?.transcript ?? []) as TranscriptEntry[];
  if (!conv || transcript[index]?.role !== 'assistant') return { error: 'Note impossible.' };
  const next = transcript.map((e, i) => (i === index ? { ...e, rating: rating ?? undefined } : e));
  await db.update(webo_conversations).set({ transcript: next }).where(eq(webo_conversations.id, conv.id));
  return { error: null };
}

export async function sendWeboMessage(conversationId: string | null, text: string): Promise<TurnResult> {
  const user = await requireWriter();
  return runWeboTurn(user, { conversationId, text }, () => {});
}

export async function listWeboConversations(): Promise<{ id: string; title: string; updated_at: string }[]> {
  const user = await requireUser();
  return db.select({ id: webo_conversations.id, title: webo_conversations.title, updated_at: webo_conversations.updated_at })
    .from(webo_conversations).where(eq(webo_conversations.user_id, user.id))
    .orderBy(desc(webo_conversations.updated_at)).limit(20);
}

export async function getWeboConversation(id: string): Promise<{ id: string; transcript: TranscriptEntry[]; proposals: Record<string, ProposalView> } | null> {
  const user = await requireUser();
  if (!isUuid(id)) return null;
  const [conv] = await db.select().from(webo_conversations).where(and(eq(webo_conversations.id, id), eq(webo_conversations.user_id, user.id))).limit(1);
  if (!conv) return null;
  const transcript = conv.transcript as TranscriptEntry[];
  const props = await proposalsByIds(transcript.flatMap((e) => e.proposalIds ?? []));
  return { id: conv.id, transcript, proposals: Object.fromEntries(props) };
}
