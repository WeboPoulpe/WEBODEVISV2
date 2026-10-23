import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { webo_proposals } from '@/db/schema';

// Briques communes aux outils de Webo : types, définition d'un outil strict, erreurs attendues, création d'une
// proposition (la seule écriture que fait un outil).

export type AgentName = 'devis' | 'factures' | 'catalogue' | 'prospects' | 'clients' | 'stock' | 'evenements' | 'journee' | 'aide';
export interface ToolContext { userId: string; companyId: string; conversationId: string; proposals: string[] }

export interface ProposalSummary {
  title: string;
  fields: { label: string; value: string }[];
  lines?: { label: string; detail: string; amount: string }[];
  total?: string;
  note?: string;
}

export type Handler = (ctx: ToolContext, input: Record<string, unknown>) => Promise<unknown>;

export const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
export const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Champs facultatifs : forme anyOf, documentée pour les outils stricts.
export const nullableStr = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
export const nullableNum = { anyOf: [{ type: 'number' }, { type: 'null' }] } as const;

export function tool(name: string, description: string, properties: Record<string, unknown>): Anthropic.Tool {
  return {
    name, description, strict: true,
    input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  } as Anthropic.Tool;
}

export class ToolError extends Error {}
export const fail = (m: string): never => { throw new ToolError(m); };
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;


export async function propose(ctx: ToolContext, kind: string, payload: unknown, summary: ProposalSummary) {
  const [row] = await db.insert(webo_proposals).values({
    conversation_id: ctx.conversationId, company_id: ctx.companyId, user_id: ctx.userId, kind, payload, summary,
  }).returning({ id: webo_proposals.id });
  ctx.proposals.push(row.id);
  return { proposal_id: row.id, summary, note: 'Proposition affichée au traiteur : elle ne sera faite que s’il la valide.' };
}
