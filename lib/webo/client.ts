import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Accès à Claude pour l'assistant Webo, côté serveur seulement (la clé ANTHROPIC_API_KEY ne quitte pas le serveur).
// Attente courte et un seul nouvel essai : une réponse bloquée ne retient pas l'action serveur.

let client: Anthropic | null = null;

export const weboFake = () => process.env.WEBO_FAKE === '1' && process.env.NODE_ENV !== 'production';
export const weboAvailable = () => weboFake() || !!process.env.ANTHROPIC_API_KEY;

/**
 * Un appel à Claude. `fallbacks: 'default'` : en cas de refus par les garde-fous du modèle, l'API relance la même
 * demande sur un autre modèle (beta server-side-fallback-2026-07-01), utilisé pour les spécialistes Sonnet 5.5.
 */
export async function callClaude(params: Anthropic.MessageCreateParamsNonStreaming & { fallbacks?: 'default' }): Promise<Anthropic.Message> {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  if (params.fallbacks) {
    const { fallbacks, ...rest } = params;
    return (await client.beta.messages.create({ ...rest, betas: ['server-side-fallback-2026-07-01'], fallbacks } as never)) as unknown as Anthropic.Message;
  }
  return client.messages.create(params);
}
