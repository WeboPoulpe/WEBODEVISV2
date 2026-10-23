'use server';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
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

export interface ConversationRow { id: string; title: string; updated_at: string }

/** Conversations de l'utilisateur, 30 par page, plus récentes d'abord ; recherche dans le titre et les messages. */
export async function listWeboConversations(opts: { query?: string; page?: number } = {}): Promise<{ rows: ConversationRow[]; more: boolean }> {
  const user = await requireUser();
  const size = 30;
  const page = Math.max(0, Math.floor(Number(opts.page ?? 0) || 0));
  const q = typeof opts.query === 'string' ? opts.query.trim().slice(0, 100) : '';
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db.select({ id: webo_conversations.id, title: webo_conversations.title, updated_at: webo_conversations.updated_at })
    .from(webo_conversations)
    .where(and(eq(webo_conversations.user_id, user.id), q ? or(ilike(webo_conversations.title, like), sql`${webo_conversations.transcript}::text ilike ${like}`) : undefined))
    .orderBy(desc(webo_conversations.updated_at)).limit(size + 1).offset(page * size);
  return { rows: rows.slice(0, size), more: rows.length > size };
}

export async function renameWeboConversation(id: string, title: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const clean = typeof title === 'string' ? title.trim().slice(0, 120) : '';
  if (!isUuid(id) || !clean) return { error: 'Titre invalide.' };
  const [row] = await db.update(webo_conversations).set({ title: clean })
    .where(and(eq(webo_conversations.id, id), eq(webo_conversations.user_id, user.id))).returning({ id: webo_conversations.id });
  return row ? { error: null } : { error: 'Conversation introuvable.' };
}

/** Supprime une conversation (et ses propositions, qui ne sont donc plus validables). */
export async function deleteWeboConversation(id: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!isUuid(id)) return { error: 'Conversation introuvable.' };
  const [row] = await db.delete(webo_conversations)
    .where(and(eq(webo_conversations.id, id), eq(webo_conversations.user_id, user.id))).returning({ id: webo_conversations.id });
  return row ? { error: null } : { error: 'Conversation introuvable.' };
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
