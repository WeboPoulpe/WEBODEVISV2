import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Historique des conversations avec Webo : recherche, pages, renommer, supprimer — seulement les siennes.

vi.mock('server-only', () => ({}));
const ME = '00000000-0000-4000-8000-000000000801';
const OTHER = '00000000-0000-4000-8000-000000000802';
let current = ME;
vi.mock('../session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const chat = await import('./chat');
const { decideProposal } = await import('./execute');
let target = '';
let proposal = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${ME}', 'm@h.fr', 'x'), ('${OTHER}', 'o@h.fr', 'x');
    insert into profiles (id, email) values ('${ME}', 'm@h.fr'), ('${OTHER}', 'o@h.fr');
    insert into webo_conversations (company_id, user_id, title, transcript, updated_at)
      select '${ME}', '${ME}', 'Conversation ' || g, '[{"role":"user","text":"bonjour","at":"2026-10-01T00:00:00Z"}]'::jsonb, now() - (g || ' hours')::interval from generate_series(1, 35) g;
    insert into webo_conversations (company_id, user_id, title, transcript) values
      ('${ME}', '${ME}', 'Mariage Dupont', '[{"role":"user","text":"devis pour Claire avec trou normand","at":"2026-10-01T00:00:00Z"}]'::jsonb),
      ('${OTHER}', '${OTHER}', 'Secret', '[{"role":"user","text":"trou normand ailleurs","at":"2026-10-01T00:00:00Z"}]'::jsonb);
  `);
  target = (await pg.query<{ id: string }>(`select id from webo_conversations where title = 'Mariage Dupont'`)).rows[0].id;
  proposal = (await pg.query<{ id: string }>(`insert into webo_proposals (conversation_id, company_id, user_id, kind, payload, summary) values ($1, $2, $2, 'memory', '{"text":"x"}', '{"title":"Retenir","fields":[]}') returning id`, [target, ME])).rows[0].id;
}, 30_000);

describe('historique de Webo', () => {
  it('30 par page, plus récentes d’abord, puis la suite', async () => {
    const first = await chat.listWeboConversations();
    expect(first.rows).toHaveLength(30);
    expect(first.more).toBe(true);
    expect(first.rows[0].title).toBe('Mariage Dupont');
    const second = await chat.listWeboConversations({ page: 1 });
    expect(second.rows).toHaveLength(6);
    expect(second.more).toBe(false);
  });

  it('recherche dans les titres et le contenu ; jamais les conversations des autres', async () => {
    expect((await chat.listWeboConversations({ query: 'trou normand' })).rows.map((r) => r.title)).toEqual(['Mariage Dupont']);
    expect((await chat.listWeboConversations({ query: 'Dupont' })).rows).toHaveLength(1);
  });

  it('renommer et supprimer : seulement les siennes ; une proposition d’une conversation supprimée n’est plus validable', async () => {
    current = OTHER;
    expect((await chat.renameWeboConversation(target, 'Piratée')).error).toBeTruthy();
    expect((await chat.deleteWeboConversation(target)).error).toBeTruthy();
    current = ME;
    expect((await chat.renameWeboConversation(target, '  Mariage Claire Dupont  ')).error).toBeNull();
    expect((await chat.listWeboConversations({ query: 'Claire Dupont' })).rows[0].title).toBe('Mariage Claire Dupont');
    expect((await chat.deleteWeboConversation(target)).error).toBeNull();
    expect(await chat.getWeboConversation(target)).toBeNull();
    expect((await decideProposal(proposal, 'accept')).error).toBeTruthy();
  });
});
