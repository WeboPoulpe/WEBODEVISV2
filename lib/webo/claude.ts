import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { MENU_GLOSSARY } from '../menuGlossary';
import { anthropicKey } from './client';

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
export const weboAvailable = (): boolean => fake() || !!anthropicKey();

let client: Anthropic | null = null;

/** Une fiche traduite par Claude. Lève une erreur si la réponse est coupée, refusée ou illisible. */
export async function translateFicheFrToEn(f: { name: string; html: string }): Promise<{ name: string; html: string; usage: WeboUsage }> {
  if (fake()) {
    return { name: `EN ${f.name}`, html: f.html.replace(/>([^<]*\S[^<]*)</g, '>EN $1<'), usage: { input: 100, output: 50, cacheWrite: 0, cacheRead: 0 } };
  }
  // Attente courte et un seul nouvel essai : une fiche bloquée ne retient pas l'action serveur.
  client ??= new Anthropic({ apiKey: anthropicKey(), timeout: 60_000, maxRetries: 1 });
  const res = await client.messages.create({
    model: WEBO_MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: JSON.stringify({ name: f.name, html: f.html }) }],
  });
  const u = res.usage;
  const usage: WeboUsage = { input: u.input_tokens, output: u.output_tokens, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 };
  // Chaque échec porte le coût de l'appel, facturé quand même.
  const fail = (message: string) => Object.assign(new Error(message), { usage });
  if (res.stop_reason !== 'end_turn') throw fail(`Webo : réponse incomplète (${res.stop_reason}).`);
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw fail('Webo : réponse illisible.'); }
  const out = parsed as { name?: unknown; html?: unknown };
  if (typeof out?.name !== 'string' || typeof out?.html !== 'string') throw fail('Webo : réponse illisible.');
  if (!out.html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '')) throw fail('Webo : fiche vide.');
  return { name: out.name, html: out.html, usage };
}

// ── Réécriture d'un texte de brochure (Studio) ──────────────────────────────

export type RewriteMode = 'fix' | 'rephrase' | 'shorten' | 'warmer' | 'elegant' | 'english';
export const REWRITE_MODES: Record<RewriteMode, { label: string; instruction: string }> = {
  fix: { label: 'Corriger l’orthographe', instruction: 'Correct spelling, grammar, punctuation and typography (French rules: non-breaking spaces before : ; ! ?, « » quotes) without changing the wording otherwise.' },
  rephrase: { label: 'Reformuler', instruction: 'Rephrase in fluent, natural French for a caterer\'s brochure, keeping the meaning and roughly the same length.' },
  shorten: { label: 'Raccourcir', instruction: 'Make it about 40 % shorter, keeping the essential information.' },
  warmer: { label: 'Plus chaleureux', instruction: 'Make the tone warmer and more welcoming, as a caterer speaking to future guests, same language, similar length.' },
  elegant: { label: 'Plus élégant', instruction: 'Make the wording more refined and elegant (high-end catering), same language, similar length.' },
  english: { label: 'Traduire en anglais', instruction: 'Translate into natural English as found on a restaurant or wedding brochure.' },
};

const REWRITE_SYSTEM = `You edit short texts from a French caterer's brochure.
The "html" field is an HTML fragment. Return it with the same structure (same tags and attributes, in the same order); change only the visible text as asked. Never invent prices, dates, names, or facts. No explanations.
Answer only with the JSON object.`;

/** Un texte de brochure réécrit par Claude (correction, reformulation…). Lève une erreur (avec son coût) si la réponse est inutilisable. */
export async function rewriteBrochureText(html: string, mode: RewriteMode): Promise<{ html: string; usage: WeboUsage }> {
  if (fake()) return { html: html.replace(/>([^<]*\S[^<]*)</g, `>[${mode}] $1<`), usage: { input: 80, output: 40, cacheWrite: 0, cacheRead: 0 } };
  client ??= new Anthropic({ apiKey: anthropicKey(), timeout: 60_000, maxRetries: 1 });
  const res = await client.messages.create({
    model: WEBO_MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: REWRITE_SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object', properties: { html: { type: 'string' } }, required: ['html'], additionalProperties: false } } },
    messages: [{ role: 'user', content: JSON.stringify({ task: REWRITE_MODES[mode].instruction, html }) }],
  });
  const u = res.usage;
  const usage: WeboUsage = { input: u.input_tokens, output: u.output_tokens, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 };
  const fail = (message: string) => Object.assign(new Error(message), { usage });
  if (res.stop_reason !== 'end_turn') throw fail('Webo : réponse incomplète.');
  let out: { html?: unknown };
  try { out = JSON.parse(res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')); } catch { throw fail('Webo : réponse illisible.'); }
  if (typeof out?.html !== 'string' || !out.html.replace(/<[^>]*>|&nbsp;|\s/g, '')) throw fail('Webo : réponse vide.');
  return { html: out.html, usage };
}
