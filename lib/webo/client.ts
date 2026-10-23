import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Accès à Claude pour l'assistant Webo, côté serveur seulement (la clé ANTHROPIC_API_KEY ne quitte pas le serveur).
// Attente courte (30 s) et un seul nouvel essai : avec le délai de la boucle (50 s), une réponse tient dans la durée
// maximale de l'action (maxDuration de app/(app)/layout.tsx).

let client: Anthropic | null = null;

export const weboFake = () => process.env.WEBO_FAKE === '1' && process.env.NODE_ENV !== 'production';
export const weboAvailable = () => weboFake() || !!process.env.ANTHROPIC_API_KEY;

/**
 * Un appel à Claude. `fallbacks: 'default'` : en cas de refus par les garde-fous du modèle, l'API relance la même
 * demande sur un autre modèle (beta server-side-fallback-2026-07-01), utilisé pour les spécialistes Sonnet 5.5.
 */
export async function callClaude(params: Anthropic.MessageCreateParamsNonStreaming & { fallbacks?: 'default' }): Promise<Anthropic.Message> {
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  if (params.fallbacks) {
    const { fallbacks, ...rest } = params;
    return (await client.beta.messages.create({ ...rest, betas: ['server-side-fallback-2026-07-01'], fallbacks } as never)) as unknown as Anthropic.Message;
  }
  return client.messages.create(params);
}

/** Comme callClaude, en flux : `onText` reçoit le texte au fil de l'eau ; renvoie le message complet. */
export async function callClaudeStream(
  params: Anthropic.MessageCreateParamsNonStreaming & { fallbacks?: 'default' },
  onText: (delta: string) => void,
): Promise<Anthropic.Message> {
  client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
  if (params.fallbacks) {
    const { fallbacks, ...rest } = params;
    const stream = client.beta.messages.stream({ ...rest, betas: ['server-side-fallback-2026-07-01'], fallbacks } as never);
    stream.on('text', (delta: string) => onText(delta));
    return (await stream.finalMessage()) as unknown as Anthropic.Message;
  }
  const stream = client.messages.stream(params);
  stream.on('text', (delta) => onText(delta));
  return stream.finalMessage();
}
