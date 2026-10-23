import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Mémoire de Webo : une habitude n'est retenue qu'après validation ; 30 au plus ; propre à l'entreprise.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000501';
const OTHER = '00000000-0000-4000-8000-000000000502';
let current = CHEF;
vi.mock('../session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
}));
vi.mock('@/lib/mail', () => ({ appOrigin: async () => 'https://webodevis.fr', sendMail: async () => ({ error: null }) }));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool } = await import('./tools');
const { decideProposal } = await import('./execute');
const { listWeboMemories, deleteWeboMemory } = await import('./memory');
const { memoriesText } = await import('./memoryStore');

let conv = '';
const propose = async (text: string) => JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, 'propose_memory', { text }));

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@m.fr', 'x'), ('${OTHER}', 'o@m.fr', 'x');
    insert into profiles (id, email) values ('${CHEF}', 'c@m.fr'), ('${OTHER}', 'o@m.fr');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id) values ($1, $1) returning id`, [CHEF])).rows[0].id;
}, 30_000);
beforeEach(async () => { current = CHEF; await pg.exec(`delete from webo_memories;`); });

describe('mémoire de Webo', () => {
  it('proposée puis validée : retenue, listée et redonnée aux spécialistes', async () => {
    const p = await propose('Acompte toujours à 40 %');
    expect(await listWeboMemories()).toHaveLength(0);
    expect((await decideProposal(p.proposal_id, 'accept')).error).toBeNull();
    const list = await listWeboMemories();
    expect(list.map((m) => m.text)).toEqual(['Acompte toujours à 40 %']);
    expect(await memoriesText(CHEF)).toContain('Acompte toujours à 40 %');
    current = OTHER;
    expect(await listWeboMemories()).toHaveLength(0);
    expect((await deleteWeboMemory(list[0].id)).error).toBeTruthy();
    current = CHEF;
    expect((await deleteWeboMemory(list[0].id)).error).toBeNull();
    expect(await listWeboMemories()).toHaveLength(0);
  });

  it('30 habitudes au plus ; texte trop long refusé', async () => {
    await pg.exec(`insert into webo_memories (company_id, text) select '${CHEF}', 'Habitude ' || g from generate_series(1, 30) g`);
    expect((await propose('Une de plus')).error).toBeTruthy();
    await pg.exec(`delete from webo_memories`);
    expect((await propose('x'.repeat(301))).error).toBeTruthy();
  });
});
