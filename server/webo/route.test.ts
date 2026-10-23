import { describe, expect, it, vi } from 'vitest';

// La route en flux : le tour de discussion est confié à la plateforme (after), pour aller au bout même si le
// navigateur coupe la réponse — sinon les pièces réservées ne seraient ni réglées ni la réponse enregistrée.

vi.mock('server-only', () => ({}));
vi.mock('@/server/session', () => ({ requireWriter: async () => ({ id: 'u1', email: 'x@y.fr' }) }));
const kept: Promise<unknown>[] = [];
vi.mock('next/server', () => ({ after: (task: Promise<unknown> | (() => Promise<unknown>)) => { kept.push(typeof task === 'function' ? task() : task); } }));
let finished = false;
vi.mock('@/server/webo/turn', () => ({
  runWeboTurn: async (_u: unknown, _i: unknown, emit: (e: unknown) => void) => {
    emit({ type: 'agent', agent: 'aide' });
    await new Promise((r) => setTimeout(r, 30));
    emit({ type: 'text', delta: 'Bonjour' });
    emit({ type: 'done', conversationId: 'c1', reply: { text: 'Bonjour', agent: 'aide', proposals: [], coins: 1 }, balance: 199 });
    finished = true;
    return { error: null };
  },
}));

const { POST } = await import('@/app/api/webo/chat/route');

describe('route /api/webo/chat', () => {
  it('le navigateur coupe tout de suite : le tour est confié à la plateforme et va au bout', async () => {
    const res = await POST(new Request('http://x/api/webo/chat', { method: 'POST', body: JSON.stringify({ text: 'Bonjour' }) }));
    await res.body!.cancel();
    expect(kept).toHaveLength(1);
    await Promise.all(kept);
    expect(finished).toBe(true);
  });

  it('les événements sont relayés ligne par ligne', async () => {
    finished = false;
    const res = await POST(new Request('http://x/api/webo/chat', { method: 'POST', body: JSON.stringify({ text: 'Bonjour' }) }));
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l).type);
    expect(lines).toEqual(['agent', 'text', 'done']);
  });
});
