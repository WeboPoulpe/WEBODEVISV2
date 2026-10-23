import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';

// Journée (résumé du tableau de bord), notes 👍/👎 des réponses, et leur lecture par l'admin.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000701';
const OTHER = '00000000-0000-4000-8000-000000000702';
const ADMIN = '00000000-0000-4000-8000-000000000703';
let current = CHEF;
let isAdmin = false;
vi.mock('../session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => ({ id: current, email: 'x@y.fr' }),
  requireAdmin: async () => { if (!isAdmin) throw new Error('Réservé aux administrateurs'); return { id: ADMIN, email: 'a@y.fr' }; },
}));
vi.mock('../dashboard', () => ({
  getDashboard: async () => ({
    today: '2026-10-23', modules: [],
    todo: [{ key: 'relance:1', kind: 'relance', title: 'Relancer Famille Lenoir', detail: 'Devis envoyé il y a 9 jours', due: '2026-10-23', when: 'Aujourd’hui', bucket: 'today', href: '/devis/1', action: 'Relancer' }],
    upcoming: [{ id: 'e1', client: 'Mariage Dupont', eventType: 'Mariage', date: '2026-10-25', guests: 120, total: 12000, status: 'acompte', missing: ['Matériel'] }],
    summary: { pendingCount: 3, pendingAmount: 9000, upcomingEvents: 1, upcomingGuests: 120 },
  }),
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

const { runTool, toolsFor } = await import('./tools');
const { rateWeboReply } = await import('./chat');
const { adminWeboDownvotes } = await import('./admin');
let conv = '';

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@q.fr', 'x'), ('${OTHER}', 'o@q.fr', 'x'), ('${ADMIN}', 'a@q.fr', 'x');
    insert into profiles (id, email, company_name) values ('${CHEF}', 'c@q.fr', 'Traiteur Qualité'), ('${OTHER}', 'o@q.fr', 'Autre'), ('${ADMIN}', 'a@q.fr', 'Admin');
  `);
  conv = (await pg.query<{ id: string }>(`insert into webo_conversations (company_id, user_id, title, transcript) values ($1, $1, 'Essai', $2::jsonb) returning id`, [CHEF, JSON.stringify([
    { role: 'user', text: 'Fais un devis', at: '2026-10-23T10:00:00Z' },
    { role: 'assistant', text: 'Mauvaise réponse', agent: 'devis', at: '2026-10-23T10:00:05Z' },
  ])])).rows[0].id;
}, 30_000);

describe('journée, notes et admin', () => {
  it('Journée : day_overview résume à faire et événements à venir', async () => {
    expect(toolsFor('journee').map((t) => t.name)).toEqual(['day_overview']);
    const r = JSON.parse(await runTool({ userId: CHEF, companyId: CHEF, conversationId: conv, proposals: [] }, 'day_overview', {}));
    expect(JSON.stringify(r)).toContain('Relancer Famille Lenoir');
    expect(JSON.stringify(r)).toContain('Mariage Dupont');
  });

  it('noter une réponse : seulement l’auteur, seulement une réponse de Webo', async () => {
    expect((await rateWeboReply(conv, 1, 'down')).error).toBeNull();
    expect((await rateWeboReply(conv, 0, 'down')).error).toBeTruthy();
    current = OTHER;
    expect((await rateWeboReply(conv, 1, 'up')).error).toBeTruthy();
    current = CHEF;
    const [row] = (await pg.query<{ transcript: { rating?: string }[] }>(`select transcript from webo_conversations where id = $1`, [conv])).rows;
    expect(row.transcript[1].rating).toBe('down');
  });

  it('admin : les réponses notées 👎, avec la question ; refusé aux autres', async () => {
    await expect(adminWeboDownvotes()).rejects.toThrow();
    isAdmin = true;
    const list = await adminWeboDownvotes();
    expect(list).toEqual([expect.objectContaining({ company: 'Traiteur Qualité', question: 'Fais un devis', answer: 'Mauvaise réponse', agent: 'devis' })]);
  });
});
