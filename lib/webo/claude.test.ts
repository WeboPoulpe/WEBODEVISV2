import { beforeEach, describe, expect, it, vi } from 'vitest';

// Appel à Claude pour une fiche : la réponse doit être complète et lisible, sinon c'est un échec (pièce rendue).

vi.mock('server-only', () => ({}));
let reply: { stop_reason: string; content: { type: string; text: string }[]; usage: Record<string, number> };
const calls: Record<string, unknown>[] = [];
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: async (body: Record<string, unknown>) => { calls.push(body); return reply; } };
  },
}));

const { translateFicheFrToEn } = await import('./claude');
const usage = { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

beforeEach(() => { calls.length = 0; process.env.ANTHROPIC_API_KEY = 'test'; delete process.env.WEBO_FAKE; });

describe('Webo : appel à Claude', () => {
  it('réponse JSON complète : nom et fiche ; modèle Haiku 5.5', async () => {
    reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ name: 'Menu', html: '<p>Hi</p>' }) }], usage };
    const r = await translateFicheFrToEn({ name: 'Menu', html: '<p>Salut</p>' });
    expect(r).toMatchObject({ name: 'Menu', html: '<p>Hi</p>', usage: { input: 10, output: 5 } });
    expect(calls[0]).toMatchObject({ model: 'claude-haiku-5-5' });
  });

  it('coupée (max_tokens) : rejet', async () => {
    reply = { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"name":"M' }], usage };
    await expect(translateFicheFrToEn({ name: 'Menu', html: '<p>x</p>' })).rejects.toThrow();
  });

  it('fiche vide renvoyée : rejet ; réponse coupée : l’erreur porte le coût', async () => {
    reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ name: 'Menu', html: '<p> </p>' }) }], usage };
    await expect(translateFicheFrToEn({ name: 'Menu', html: '<p>x</p>' })).rejects.toThrow();
    reply = { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"name"' }], usage };
    await expect(translateFicheFrToEn({ name: 'Menu', html: '<p>x</p>' })).rejects.toMatchObject({ usage: { input: 10, output: 5 } });
  });

  it('texte non JSON : rejet', async () => {
    reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Voici la traduction' }], usage };
    await expect(translateFicheFrToEn({ name: 'Menu', html: '<p>x</p>' })).rejects.toThrow();
  });
});
