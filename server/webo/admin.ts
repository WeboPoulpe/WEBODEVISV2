'use server';

import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, webo_conversations } from '@/db/schema';
import { requireAdmin } from '../session';
import type { TranscriptEntry } from './turn';

// Admin : les réponses de Webo notées 👎 par les traiteurs, avec la question qui les a amenées, pour améliorer les
// consignes (et nourrir scripts/webo-eval.ts).

export interface Downvote { conversationId: string; company: string; question: string; answer: string; agent: string | null; at: string }

export async function adminWeboDownvotes(): Promise<Downvote[]> {
  await requireAdmin();
  const rows = await db.select({ id: webo_conversations.id, transcript: webo_conversations.transcript, company: profiles.company_name, email: profiles.email })
    .from(webo_conversations)
    .leftJoin(profiles, eq(profiles.id, webo_conversations.company_id))
    .where(sql`${webo_conversations.transcript} @> '[{"rating":"down"}]'::jsonb`)
    .orderBy(desc(webo_conversations.updated_at)).limit(50);
  return rows.flatMap((r) => {
    const t = r.transcript as TranscriptEntry[];
    return t.flatMap((e, i) => (e.role === 'assistant' && e.rating === 'down' ? [{
      conversationId: r.id, company: r.company || r.email || '—',
      question: [...t.slice(0, i)].reverse().find((x) => x.role === 'user')?.text ?? '', answer: e.text, agent: e.agent ?? null, at: e.at,
    }] : []));
  });
}
