import { afterEach, describe, expect, it, vi } from 'vitest';

// La clé Anthropic se lit sous son nom habituel (ANTHROPIC_API_KEY) ou sous API_KEY_ANTHROPIC (nom déjà utilisé
// dans les réglages du projet).

vi.mock('server-only', () => ({}));
const { anthropicKey, weboAvailable } = await import('./client');
const translation = await import('./claude');

afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.API_KEY_ANTHROPIC; });

describe('clé Anthropic', () => {
  it('lue sous l’un ou l’autre nom ; absente : Webo indisponible', () => {
    expect(weboAvailable()).toBe(false);
    expect(translation.weboAvailable()).toBe(false);
    process.env.API_KEY_ANTHROPIC = 'sk-ant-test';
    expect(anthropicKey()).toBe('sk-ant-test');
    expect(weboAvailable()).toBe(true);
    expect(translation.weboAvailable()).toBe(true);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-principale';
    expect(anthropicKey()).toBe('sk-ant-principale');
  });
});
