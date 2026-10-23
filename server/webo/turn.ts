import 'server-only';
import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/db';
import { webo_conversations, webo_proposals } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';
import { weboAvailable } from '@/lib/webo/client';
import { modelCostUsd } from '@/lib/webo/models';
import { coinsForCost } from '@/lib/webocoins';
import { getWeboSettings } from '../settings';
import { companyIdFor, debitCoins, recordUsage, settleDebit, walletOf } from '../weboWallet';
import { routeMessage, runSpecialist, type CallUsage } from './agents';
import { isUuid, runTool, type AgentName, type ProposalSummary } from './tools';
import { memoriesText } from './memoryStore';

// Un tour de discussion avec Webo : un message du traiteur → l'aiguilleur choisit le spécialiste → réponse (émise au
// fil de l'eau) et propositions. Chaque réponse est payée au coût réel de ses appels × coefficient (au plus le solde).
// Appelé par l'action sendWeboMessage (sans flux) et par la route /api/webo/chat (flux).

export interface TranscriptEntry { role: 'user' | 'assistant'; text: string; agent?: AgentName; proposalIds?: string[]; coins?: number; rating?: 'up' | 'down'; at: string }
export interface ProposalView { id: string; kind: string; status: string; summary: ProposalSummary; result: { href?: string; label?: string; error?: string } | null }
export interface WeboReply { text: string; agent: AgentName; proposals: ProposalView[]; coins: number }

const MIN_COINS = 5;
const MAX_TEXT = 4000;
const MAX_ENTRIES = 60;

const STATUS_LABEL: Record<string, string> = { proposed: 'en attente de validation', done: 'validée', cancelled: 'annulée', failed: 'échouée' };

export async function proposalsByIds(ids: string[]): Promise<Map<string, ProposalView>> {
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

export type WeboEvent =
  | { type: 'agent'; agent: AgentName }
  | { type: 'text'; delta: string }
  | { type: 'done'; conversationId: string; reply: WeboReply; balance: number }
  | { type: 'error'; error: string; conversationId?: string; balance?: number };
export interface TurnInput { conversationId: string | null; text: string; path?: string }
export type TurnResult = { error: string | null; conversationId?: string; reply?: WeboReply; balance?: number };

/** Le devis de la page ouverte (s'il est de l'entreprise), résumé pour le spécialiste. */
async function pageContext(ctx: { userId: string; companyId: string; conversationId: string; proposals: string[] }, path: string | undefined): Promise<string> {
  const id = /^\/devis\/([0-9a-f-]{36})(?:\/|$|\?)/i.exec(path ?? '')?.[1];
  if (!id || !isUuid(id)) return '';
  const out = JSON.parse(await runTool(ctx, 'get_quote', { quote_id: id })) as { error?: string };
  return out.error ? '' : `Page ouverte : le traiteur regarde ce devis (« ce devis » désigne celui-ci).\n${JSON.stringify(out)}`;
}

/** Un tour complet. `emit` reçoit les morceaux ; s'il échoue (navigateur parti), le tour continue jusqu'au bout. */
export async function runWeboTurn(user: { id: string }, input: TurnInput, emit: (e: WeboEvent) => void): Promise<TurnResult> {
  const send = (e: WeboEvent) => { try { emit(e); } catch { /* flux fermé : on termine quand même */ } };
  const r = await turn(user, input, send);
  if (r.error) send({ type: 'error', error: r.error, conversationId: r.conversationId, balance: r.balance });
  else send({ type: 'done', conversationId: r.conversationId!, reply: r.reply!, balance: r.balance! });
  return r;
}

async function turn(user: { id: string }, input: TurnInput, send: (e: WeboEvent) => void): Promise<TurnResult> {
  const conversationId = input.conversationId;
  const text = input.text;
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
    send({ type: 'agent', agent });
    const context = [await memoriesText(companyId), await pageContext(ctx, input.path)].filter(Boolean).join('\n\n');
    replyText = (await runSpecialist(agent, ctx, history, message, todayFr(), usage, Date.now() + 50_000, context,
      (delta) => send({ type: 'text', delta }))).text;
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

