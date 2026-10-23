import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Un tour de discussion en flux : texte au fil de l'eau, page ouverte, cache. Claude est simulé.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000401';
const OTHER = '00000000-0000-4000-8000-000000000402';
const MINE = '00000000-0000-4000-8000-000000000411';
const THEIRS = '00000000-0000-4000-8000-000000000412';
vi.mock('../session', () => ({
  requireUser: async () => ({ id: CHEF, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: CHEF, email: 'x@y.fr' }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

type Reply = { model: string; stop_reason: string; content: { type: string; text?: string }[]; usage: { input_tokens: number; output_tokens: number } };
let script: Reply[] = [];
const sent: Record<string, unknown>[] = [];
const next = (params: Record<string, unknown>) => { sent.push(params); const r = script.shift(); if (!r) throw new Error('script vide'); return r; };
vi.mock('@/lib/webo/client', () => ({
  weboAvailable: () => true,
  weboFake: () => false,
  callClaude: async (params: Record<string, unknown>) => next(params),
  callClaudeStream: async (params: Record<string, unknown>, onText: (d: string) => void) => {
    const r = next(params);
    for (const b of r.content) if (b.type === 'text') for (const w of (b.text ?? '').split(/(?<= )/)) onText(w);
    return r;
  },
}));

const { runWeboTurn } = await import('./turn');
const route = (agent: string): Reply => ({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ agent }) }], usage: { input_tokens: 500, output_tokens: 20 } });
const say = (text: string): Reply => ({ model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 3000, output_tokens: 300 } });
const user = { id: CHEF, email: 'x@y.fr' };

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@t.fr', 'x'), ('${OTHER}', 'o@t.fr', 'x');
    insert into profiles (id, email, company_name) values ('${CHEF}', 'c@t.fr', 'Traiteur Flux'), ('${OTHER}', 'o@t.fr', 'Autre');
    insert into quotes (id, owner_user_id, user_id, client_name, event_date, event_type, guest_count, status, services) values
      ('${MINE}', '${CHEF}', '${CHEF}', 'Famille Lenoir', '2027-05-01', 'Mariage', 80, 'devis_a_faire', '[{"id":"l1","name":"Menu Tentation","quantity":80,"unitPrice":76}]'),
      ('${THEIRS}', '${OTHER}', '${OTHER}', 'Client Secret', '2027-05-02', 'Gala', 30, 'devis_a_faire', '[]');
  `);
}, 30_000);
beforeEach(async () => { await pg.exec(`delete from webo_ledger; delete from webo_wallets; delete from webo_proposals; delete from webo_conversations;`); script = []; sent.length = 0; });

const run = async (text: string, path = '/') => {
  const events: { type: string; [k: string]: unknown }[] = [];
  await runWeboTurn(user, { conversationId: null, text, path }, (e) => events.push(e));
  return events;
};

describe('tour de discussion en flux', () => {
  it('texte émis au fil de l’eau, spécialiste annoncé, puis fin avec pièces et solde', async () => {
    script = [route('aide'), say('Ouvrez le devis puis Dupliquer.')];
    const events = await run('Comment dupliquer ?');
    expect(events[0]).toMatchObject({ type: 'agent', agent: 'aide' });
    const deltas = events.filter((e) => e.type === 'text');
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.map((e) => e.delta).join('')).toBe('Ouvrez le devis puis Dupliquer.');
    expect(events.at(-1)).toMatchObject({ type: 'done', reply: { text: 'Ouvrez le devis puis Dupliquer.' } });
  });

  it('page d’un devis de l’entreprise : son résumé est donné au spécialiste', async () => {
    script = [route('devis'), say('Je regarde ce devis.')];
    await run('Ajoute un trou normand', `/devis/${MINE}/modifier`);
    const msg = JSON.stringify(sent[1].messages);
    expect(msg).toContain('Page ouverte');
    expect(msg).toContain('Famille Lenoir');
  });

  it('chemin vers le devis d’une autre entreprise : ignoré', async () => {
    script = [route('devis'), say('Lequel ?')];
    await run('Ajoute un trou normand', `/devis/${THEIRS}/modifier`);
    const msg = JSON.stringify(sent[1].messages);
    expect(msg).not.toContain('Client Secret');
    expect(msg).not.toContain('Page ouverte');
  });

  it('consignes et outils mis en cache (cache_control en tête de requête)', async () => {
    script = [route('devis'), say('Bonjour')];
    await run('Bonjour');
    expect(sent[1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('le navigateur coupe le flux en route : la réponse est quand même payée et enregistrée', async () => {
    script = [route('aide'), say('Réponse complète')];
    let n = 0;
    await runWeboTurn(user, { conversationId: null, text: 'Bonjour', path: '/' }, () => { if (++n > 1) throw new Error('flux fermé'); });
    const [conv] = (await pg.query<{ transcript: unknown[] }>(`select transcript from webo_conversations`)).rows;
    expect(conv.transcript).toHaveLength(2);
    const [w] = (await pg.query<{ m: number }>(`select month_coins m from webo_wallets`)).rows;
    expect(w.m).toBeLessThan(200);
  });
});
