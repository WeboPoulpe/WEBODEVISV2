'use server';

import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/db';
import { webo_conversations, webo_proposals } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { weboAvailable } from '@/lib/webo/client';
import { modelCostUsd } from '@/lib/webo/models';
import { coinsForCost } from '@/lib/webocoins';
import { requireUser, requireWriter } from '../session';
import { getWeboSettings } from '../settings';
import { companyIdFor, debitCoins, recordUsage, settleDebit, walletOf } from '../weboWallet';
import { routeMessage, runSpecialist, type CallUsage } from './agents';
import { isUuid, type AgentName, type ProposalSummary } from './tools';

// La discussion avec Webo : un message du traiteur → l'aiguilleur choisit le spécialiste → réponse et propositions.
// Chaque réponse est payée au coût réel de ses appels × coefficient (au plus le solde restant).

export interface TranscriptEntry { role: 'user' | 'assistant'; text: string; agent?: AgentName; proposalIds?: string[]; coins?: number; at: string }
export interface ProposalView { id: string; kind: string; status: string; summary: ProposalSummary; result: { href?: string; label?: string; error?: string } | null }
export interface WeboReply { text: string; agent: AgentName; proposals: ProposalView[]; coins: number }

const MIN_COINS = 5;
const MAX_TEXT = 4000;
const MAX_ENTRIES = 60;

const STATUS_LABEL: Record<string, string> = { proposed: 'en attente de validation', done: 'validée', cancelled: 'annulée', failed: 'échouée' };

async function proposalsByIds(ids: string[]): Promise<Map<string, ProposalView>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(webo_proposals).where(inArray(webo_proposals.id, ids));
  return new Map(rows.map((r) => [r.id, { id: r.id, kind: r.kind, status: r.status, summary: r.summary as ProposalSummary, result: r.result as ProposalView['result'] }]));
}

/** L'historique redonné au spécialiste : derniers échanges, propositions et leur sort. */
async function historyText(transcript: TranscriptEntry[]): Promise<string> {
  const recent = transcript.slice(-12);
  const props = await proposalsByIds(recent.flatMap((e) => e.proposalIds ?? []));
  return recent.map((e) => {
    const who = e.role === 'user' ? 'Traiteur' : 'Webo';
    const p = (e.proposalIds ?? []).map((id) => props.get(id)).filter(Boolean)
      .map((v) => `\n  [Proposition « ${v!.summary.title} » : ${STATUS_LABEL[v!.status] ?? v!.status}]`).join('');
    return `${who} : ${e.text.slice(0, 1500)}${p}`;
  }).join('\n');
}

const todayFr = () => new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export async function sendWeboMessage(conversationId: string | null, text: string): Promise<{ error: string | null; conversationId?: string; reply?: WeboReply; balance?: number }> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: 'Webo n’est pas disponible dans la démonstration.' };
  const message = typeof text === 'string' ? text.trim() : '';
  if (!message) return { error: 'Écrivez votre demande.' };
  if (message.length > MAX_TEXT) return { error: `Message trop long (${MAX_TEXT} caractères au plus).` };
  if (!weboAvailable()) return { error: 'Webo est indisponible pour le moment.' };
  const companyId = await companyIdFor(user.id);
  if (isDemoUser(companyId)) return { error: 'Webo n’est pas disponible dans la démonstration.' };

  // 1. La conversation, réservée le temps de la réponse : un second envoi en même temps attend son tour.
  const busyUntil = () => new Date(Date.now() + 3 * 60_000).toISOString();
  let conv: typeof webo_conversations.$inferSelect | undefined;
  if (conversationId) {
    if (!isUuid(conversationId)) return { error: 'Conversation introuvable.' };
    [conv] = await db.update(webo_conversations).set({ busy_until: busyUntil() })
      .where(and(eq(webo_conversations.id, conversationId), eq(webo_conversations.user_id, user.id),
        or(isNull(webo_conversations.busy_until), lt(webo_conversations.busy_until, new Date().toISOString()))))
      .returning();
    if (!conv) {
      const [exists] = await db.select({ id: webo_conversations.id }).from(webo_conversations)
        .where(and(eq(webo_conversations.id, conversationId), eq(webo_conversations.user_id, user.id))).limit(1);
      return { error: exists ? 'Webo répond encore à votre message précédent : un instant.' : 'Conversation introuvable.' };
    }
  }
  const release = async () => { if (conv) await db.update(webo_conversations).set({ busy_until: null }).where(eq(webo_conversations.id, conv.id)); };
  const transcript = ((conv?.transcript ?? []) as TranscriptEntry[]);
  if (transcript.length >= MAX_ENTRIES) { await release(); return { error: 'Cette conversation est complète : commencez-en une nouvelle.' }; }

  // 2. Réservation de 5 pièces avant tout appel : sans elles, pas de Claude (même avec plusieurs envois en parallèle).
  const hold = await debitCoins(companyId, { userId: user.id, amount: MIN_COINS, reason: `Webo : ${message.slice(0, 60)}`, idempotencyKey: `chat:${crypto.randomUUID()}` });
  if (!hold.ok) {
    await release();
    const total = (await walletOf(companyId)).total;
    return { error: `Il faut au moins ${MIN_COINS} WeboCoins pour écrire à Webo. Vous en avez ${total}.` };
  }
  if (!conv) {
    [conv] = await db.insert(webo_conversations).values({ company_id: companyId, user_id: user.id, title: message.slice(0, 80), busy_until: busyUntil() }).returning();
  }
  const history = await historyText(transcript);
  const ctx = { userId: user.id, companyId, conversationId: conv.id, proposals: [] as string[] };

  // 3. Aiguilleur puis spécialiste ; chaque appel fait est compté, même si la suite échoue.
  let agent: AgentName = 'aide';
  let replyText: string;
  let failed = false;
  const usage: CallUsage[] = [];
  try {
    const routed = await routeMessage(message, history);
    agent = routed.agent;
    usage.push(...routed.usage);
    replyText = (await runSpecialist(agent, ctx, history, message, todayFr(), usage, Date.now() + 50_000)).text;
  } catch (e) {
    console.error('[webo] réponse', e);
    failed = true;
    replyText = 'Je n’ai pas pu terminer ma réponse. Réessayez dans un instant.';
  }

  // 4. Paiement : la réservation est ramenée au coût réel × coefficient (au plus le solde).
  const settings = await getWeboSettings();
  const costUsd = usage.reduce((s, u) => s + modelCostUsd(u.model, u), 0);
  const due = usage.length ? coinsForCost(costUsd, settings.actionCoefficient, settings.usdEur) : 0;
  const coins = await settleDebit(hold.ledgerId, due, `Webo : ${message.slice(0, 60)}`);
  if (usage.length) {
    await recordUsage(hold.ledgerId, {
      model: `webo-${agent}`, input: usage.reduce((s, u) => s + u.input + u.cacheWrite + u.cacheRead, 0),
      output: usage.reduce((s, u) => s + u.output, 0), costUsd,
    });
  }

  // 5. L'échange est gardé (même raté), et la conversation libérée.
  const now = new Date().toISOString();
  const next: TranscriptEntry[] = [
    ...transcript,
    { role: 'user', text: message, at: now },
    { role: 'assistant', text: replyText, agent, proposalIds: ctx.proposals, coins, at: now },
  ];
  await db.update(webo_conversations).set({ transcript: next, updated_at: now, busy_until: null }).where(eq(webo_conversations.id, conv.id));
  const balance = (await walletOf(companyId)).total;
  if (failed) return { error: replyText, conversationId: conv.id, balance };
  const props = await proposalsByIds(ctx.proposals);
  return {
    error: null, conversationId: conv.id, balance,
    reply: { text: replyText, agent, proposals: ctx.proposals.map((id) => props.get(id)!).filter(Boolean), coins },
  };
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
