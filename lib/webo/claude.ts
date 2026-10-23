import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { MENU_GLOSSARY } from '../menuGlossary';

// Webo, l'IA de WeboDevis : traduction d'une fiche prestation (nom + texte mis en forme) du français vers l'anglais,
// par Claude Haiku 5.5. Côté serveur seulement : la clé (ANTHROPIC_API_KEY) ne quitte jamais le serveur.
// WEBO_FAKE=1 (hors production) : traduction simulée, sans réseau ni coût, pour les tests de bout en bout.

export const WEBO_MODEL = 'claude-haiku-5-5';

const SYSTEM = `You translate catering menu sheets ("fiches prestation") from French to English for a French caterer's quotes and brochures.

Rules:
- Write natural English as found on a restaurant or wedding menu: concise, appetising, no literal word-for-word phrasing.
- The "html" field is an HTML fragment. Return it with exactly the same structure: same tags, same attributes (including style and data-* attributes), same order, same line breaks. Translate only the visible text. Never add, remove or reorder elements, never add explanations.
- Keep proper names, place names, brand names and wine appellations as they are.
- Prices, quantities and numbers stay unchanged.
- Translate the "name" field the same way (plain text, no HTML).
- Use this glossary whenever the French term appears:
${MENU_GLOSSARY.map(([fr, en]) => `  ${fr} → ${en}`).join('\n')}

Answer only with the JSON object.`;

const SCHEMA = {
  type: 'object',
  properties: { name: { type: 'string' }, html: { type: 'string' } },
  required: ['name', 'html'],
  additionalProperties: false,
} as const;

export interface WeboUsage { input: number; output: number; cacheWrite: number; cacheRead: number }

const fake = () => process.env.WEBO_FAKE === '1' && process.env.NODE_ENV !== 'production';

/** Webo est utilisable : clé présente (ou traduction simulée). */
export const weboAvailable = (): boolean => fake() || !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;

/** Une fiche traduite par Claude. Lève une erreur si la réponse est coupée, refusée ou illisible. */
export async function translateFicheFrToEn(f: { name: string; html: string }): Promise<{ name: string; html: string; usage: WeboUsage }> {
  if (fake()) {
    return { name: `EN ${f.name}`, html: f.html.replace(/>([^<]+)</g, '>EN $1<'), usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  }
  client ??= new Anthropic();
  const res = await client.messages.create({
    model: WEBO_MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify({ name: f.name, html: f.html }) }],
  });
  if (res.stop_reason !== 'end_turn') throw new Error(`Webo : réponse incomplète (${res.stop_reason}).`);
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Webo : réponse illisible.'); }
  const out = parsed as { name?: unknown; html?: unknown };
  if (typeof out?.name !== 'string' || typeof out?.html !== 'string') throw new Error('Webo : réponse illisible.');
  const u = res.usage;
  return {
    name: out.name, html: out.html,
    usage: { input: u.input_tokens, output: u.output_tokens, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 },
  };
}
