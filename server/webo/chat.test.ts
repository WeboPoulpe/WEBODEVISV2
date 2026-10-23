import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testDb';
import { DEMO_USER_ID } from '@/lib/demo';

// Discussion avec Webo : aiguilleur, spécialiste et ses outils, débit au coût réel × coefficient. Claude est simulé.

vi.mock('server-only', () => ({}));
const CHEF = '00000000-0000-4000-8000-000000000301';
const READER = '00000000-0000-4000-8000-000000000302';
const OTHER = '00000000-0000-4000-8000-000000000303';
const MENU = '00000000-0000-4000-8000-000000000311';
let current = CHEF;
vi.mock('../session', () => ({
  requireUser: async () => ({ id: current, email: 'x@y.fr' }),
  requireWriter: async () => {
    if (current === READER) throw new Error('Votre accès est en consultation seule');
    return { id: current, email: 'x@y.fr' };
  },
}));
let pg: PGlite;
vi.mock('@/db', () => ({ get db() { return drizzle(pg, { schema }); }, get pool() { return null; } }));

type Reply = { model: string; stop_reason: string; content: unknown[]; usage: { input_tokens: number; output_tokens: number } };
let script: Reply[] = [];
const sentParams: Record<string, unknown>[] = [];
vi.mock('@/lib/webo/client', () => ({
  weboAvailable: () => true,
  weboFake: () => false,
  callClaude: async (params: Record<string, unknown>) => {
    sentParams.push(params);
    const next = script.shift();
    if (!next) throw new Error('script vide');
    return next;
  },
}));

const chat = await import('./chat');
const route = (agent: string): Reply => ({ model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ agent }) }], usage: { input_tokens: 1000, output_tokens: 100 } });
const say = (text: string, usage = { input_tokens: 10_000, output_tokens: 1000 }, model = 'claude-sonnet-5-5'): Reply => ({ model, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage });
const use = (name: string, input: unknown): Reply => ({ model: 'claude-sonnet-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `t-${name}-${Math.random()}`, name, input }], usage: { input_tokens: 2000, output_tokens: 200 } });
const balance = async () => {
  const { rows } = await pg.query<{ m: number; k: number }>(`select month_coins m, kept_coins k from webo_wallets where company_id = $1`, [CHEF]);
  return rows[0] ? rows[0].m + rows[0].k : null;
};

beforeAll(async () => {
  pg = await createTestDb();
  await pg.exec(`
    insert into users (id, email, password_hash) values ('${CHEF}', 'c@c.fr', 'x'), ('${READER}', 'r@c.fr', 'x'), ('${OTHER}', 'o@c.fr', 'x'), ('${DEMO_USER_ID}', 'demo@c.fr', 'x');
    insert into profiles (id, email, company_name, default_vat_rate) values ('${CHEF}', 'c@c.fr', 'Traiteur Chat', 10), ('${OTHER}', 'o@c.fr', 'Autre', 20), ('${DEMO_USER_ID}', 'demo@c.fr', 'Démo', 10);
    insert into profiles (id, email, parent_user_id, company_role) values ('${READER}', 'r@c.fr', '${CHEF}', 'lecture');
    insert into prestations (id, user_id, name, unit_price, category) values ('${MENU}', '${CHEF}', 'Menu Tentation', 76, 'dîner');
  `);
}, 30_000);
beforeEach(async () => {
  await pg.exec(`delete from webo_ledger; delete from webo_wallets; delete from webo_proposals; delete from webo_conversations;`);
  current = CHEF; script = []; sentParams.length = 0;
});

describe('discussion avec Webo', () => {
  it('débit = coût réel × coefficient, arrondi à la pièce ; réponse et historique enregistrés', async () => {
    script = [route('aide'), say('Ouvrez le devis puis « Dupliquer ».', undefined, 'claude-haiku-5-5')];
    const r = await chat.sendWeboMessage(null, 'Comment je fais une variante de devis ?');
    expect(r.error).toBeNull();
    // Haiku 1000/100 + Haiku 10 000/1 000 (l'aide est sur Haiku) = 0,00015 + 0,0015 = 0,00165 $ → ×0,92 ×100 ×3 = 0,46 → 1 pièce.
    expect(r.reply).toMatchObject({ text: 'Ouvrez le devis puis « Dupliquer ».', agent: 'aide', coins: 1 });
    expect(r.balance).toBe(199);
    const conv = await chat.getWeboConversation(r.conversationId!);
    expect(conv?.transcript.map((e) => e.role)).toEqual(['user', 'assistant']);
    expect((await chat.listWeboConversations())[0].title).toMatch(/^Comment je fais/);
  });

  it('spécialiste Devis : outils puis proposition affichée en carte ; Sonnet plus cher', async () => {
    script = [
      route('devis'),
      use('search_catalogue', { query: 'Tentation' }),
      use('propose_quote', { customer_id: null, new_customer: { first_name: 'Claire', last_name: 'Dupont', email: 'claire@d.fr', phone: null }, client_name: '', event_type: 'Mariage', event_date: '2027-06-12', guest_count: 50, event_location: null, remarks: null, lines: [{ prestation_id: MENU, name: 'Menu Tentation', quantity: null, unit_price: null }] }),
      say('Voici le devis proposé pour le mariage de Claire Dupont.'),
    ];
    const r = await chat.sendWeboMessage(null, 'Prépare un devis pour le mariage de Claire Dupont, 50 personnes le 12 juin 2027, menu Tentation, claire@d.fr');
    expect(r.error).toBeNull();
    expect(r.reply?.proposals).toHaveLength(1);
    expect(r.reply?.proposals[0]).toMatchObject({ kind: 'quote', status: 'proposed', summary: { title: 'Nouveau devis' } });
    // Le spécialiste reçoit ses outils, l'aiguilleur aucun.
    expect(sentParams[0].tools).toBeUndefined();
    expect((sentParams[1].tools as { name: string }[]).map((t) => t.name)).toContain('propose_quote');
    expect(sentParams[1].model).toBe('claude-sonnet-5-5');
    expect(r.reply!.coins).toBeGreaterThan(1);
  });

  it('solde sous 5 pièces : refusé sans appel à Claude', async () => {
    await pg.exec(`insert into webo_wallets (company_id, month_key, month_coins, kept_coins) values ('${CHEF}', '9999-12', 4, 0)`);
    const r = await chat.sendWeboMessage(null, 'Bonjour');
    expect(r.error).toMatch(/WeboCoins/);
    expect(sentParams).toHaveLength(0);
  });

  it('réponse plus chère que le solde : solde à 0, jamais négatif', async () => {
    await pg.exec(`insert into webo_wallets (company_id, month_key, month_coins, kept_coins) values ('${CHEF}', '9999-12', 6, 0)`);
    script = [route('devis'), say('Réponse très longue', { input_tokens: 400_000, output_tokens: 20_000 })];
    const r = await chat.sendWeboMessage(null, 'Bonjour');
    expect(r.error).toBeNull();
    expect(r.reply!.coins).toBe(6);
    expect(await balance()).toBe(0);
  });

  it('message trop long, conversation d’un autre : refusés', async () => {
    expect((await chat.sendWeboMessage(null, 'x'.repeat(4001))).error).toBeTruthy();
    script = [route('aide'), say('Bonjour')];
    const r = await chat.sendWeboMessage(null, 'Bonjour');
    current = OTHER;
    expect((await chat.sendWeboMessage(r.conversationId!, 'Et moi ?')).error).toBeTruthy();
    expect(await chat.getWeboConversation(r.conversationId!)).toBeNull();
  });

  it('démo et lecture seule : refusés', async () => {
    current = DEMO_USER_ID;
    expect((await chat.sendWeboMessage(null, 'Bonjour')).error).toBeTruthy();
    current = READER;
    await expect(chat.sendWeboMessage(null, 'Bonjour')).rejects.toThrow();
    expect(sentParams).toHaveLength(0);
  });

  it('historique redonné au spécialiste au message suivant, avec le sort des propositions', async () => {
    script = [route('aide'), say('Première réponse')];
    const r = await chat.sendWeboMessage(null, 'Premier message');
    script = [route('aide'), say('Deuxième réponse')];
    await chat.sendWeboMessage(r.conversationId!, 'Deuxième message');
    const last = JSON.stringify(sentParams[3].messages);
    expect(last).toContain('Premier message');
    expect(last).toContain('Première réponse');
  });
});
