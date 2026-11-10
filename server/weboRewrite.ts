'use server';

// Réécriture d'un texte de brochure par Webo (Studio : corriger, reformuler, raccourcir…), payée en WeboCoins comme
// une traduction de fiche : une pièce réservée avant l'appel à Claude, rendue s'il échoue.

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { brochures, profiles } from '@/db/schema';
import { PAGE_TEMPLATES, THEMES, parseStudio, sanitizeStudio, type StudioDoc } from '@/lib/brochureStudio';
import { companyIdsOf } from './companyScope';
import { newLinkToken } from './brochureAccess';
import { listBrochurePhotos } from './brochures';
import { isDemoUser } from '@/lib/demo';
import { sanitizeHtml } from '@/lib/sanitize';
import { haikuCostUsd } from '@/lib/webocoins';
import { REWRITE_MODES, designCover, rewriteBrochureText, translateTexts, weboAvailable, WEBO_MODEL, type RewriteMode, type WeboUsage } from '@/lib/webo/claude';
import { requireWriter } from './session';
import { getWeboSettings } from './settings';
import { companyIdFor, debitCoins, recordUsage, refundDebit, walletOf } from './weboWallet';

const MAX_HTML = 12_000;

export async function rewriteWithWebo(input: { html: string; mode: RewriteMode; requestId: string }): Promise<{ html: string; balance: number } | { error: string }> {
  const user = await requireWriter();
  const mode = input?.mode;
  if (!mode || !(mode in REWRITE_MODES)) return { error: 'Demande inconnue.' };
  const html = String(input.html ?? '');
  if (!html.replace(/<[^>]*>|&nbsp;|\s/g, '')) return { error: 'Le texte est vide.' };
  if (html.length > MAX_HTML) return { error: 'Texte trop long pour Webo : coupez-le en plusieurs.' };
  const companyId = await companyIdFor(user.id);
  const [me] = await db.select({ role: profiles.company_role }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  if (me?.role === 'lecture') return { error: 'Votre accès est en lecture seule.' };
  if (isDemoUser(user.id) || isDemoUser(companyId)) return { error: 'Webo n’écrit pas dans le compte de démonstration.' };
  if (!weboAvailable()) return { error: 'Webo n’est pas disponible pour le moment.' };
  const settings = await getWeboSettings();
  const debit = await debitCoins(companyId, {
    userId: user.id, amount: settings.translationPrice, reason: `Brochure : ${REWRITE_MODES[mode].label}`,
    idempotencyKey: `rw:${companyId}:${String(input.requestId ?? '').slice(0, 100)}`,
  });
  if (!debit.ok) return { error: debit.reason === 'demo' ? 'Webo n’écrit pas dans le compte de démonstration.' : 'Plus assez de WeboCoins pour ce mois.' };
  if (debit.replay) return { error: 'Demande déjà traitée.' };
  try {
    const out = await rewriteBrochureText(html, mode);
    await recordUsage(debit.ledgerId, { model: WEBO_MODEL, input: out.usage.input, output: out.usage.output, costUsd: haikuCostUsd(out.usage) });
    return { html: sanitizeHtml(out.html), balance: (await walletOf(companyId)).total };
  } catch (e) {
    const usage = (e as { usage?: { input: number; output: number } }).usage;
    if (usage) await recordUsage(debit.ledgerId, { model: WEBO_MODEL, input: usage.input, output: usage.output, costUsd: haikuCostUsd(usage) });
    await refundDebit(debit.ledgerId);
    return { error: 'Webo n’a pas pu réécrire ce texte. Réessayez.' };
  }
}

/** Ce qui empêche Webo de travailler pour ce compte (lecture seule, démonstration, indisponible), ou null. */
async function blocked(userId: string, companyId: string): Promise<string | null> {
  const [me] = await db.select({ role: profiles.company_role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (me?.role === 'lecture') return 'Votre accès est en lecture seule.';
  if (isDemoUser(userId) || isDemoUser(companyId)) return 'Webo n’écrit pas dans le compte de démonstration.';
  if (!weboAvailable()) return 'Webo n’est pas disponible pour le moment.';
  return null;
}

/**
 * Réserve des pièces, fait le travail, note son coût ; rend les pièces si Claude échoue. Renvoie le résultat ou
 * le message d'erreur.
 */
async function withCoins<T>(userId: string, companyId: string, amount: number, reason: string, key: string, work: () => Promise<{ value: T; usage: WeboUsage[] }>): Promise<{ value: T } | { error: string }> {
  const debit = await debitCoins(companyId, { userId, amount, reason, idempotencyKey: key });
  if (!debit.ok) return { error: debit.reason === 'demo' ? 'Webo n’écrit pas dans le compte de démonstration.' : 'Plus assez de WeboCoins pour ce mois.' };
  if (debit.replay) return { error: 'Demande déjà traitée.' };
  const record = async (usage: WeboUsage[]) => {
    const total = usage.reduce((t, u) => ({ input: t.input + u.input, output: t.output + u.output, cacheWrite: t.cacheWrite + u.cacheWrite, cacheRead: t.cacheRead + u.cacheRead }), { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
    if (total.input || total.output) await recordUsage(debit.ledgerId, { model: WEBO_MODEL, input: total.input, output: total.output, costUsd: haikuCostUsd(total) });
  };
  try {
    const { value, usage } = await work();
    await record(usage);
    return { value };
  } catch (e) {
    const usage = (e as { usage?: WeboUsage }).usage;
    if (usage) await record([usage]);
    await refundDebit(debit.ledgerId);
    return { error: 'Webo n’a pas pu le faire. Vos WeboCoins sont rendus ; réessayez.' };
  }
}

export interface CoverProposal { templateId: string; themeName: string; title: string; subtitle: string; photoUrl: string | null }

/** « Fais-moi une couverture » : Webo choisit une mise en page, un thème, une photo de l'entreprise, et écrit les titres. */
export async function designCoverWithWebo(input: { description: string; language: 'fr' | 'en'; requestId: string }): Promise<CoverProposal | { error: string }> {
  const user = await requireWriter();
  const description = String(input?.description ?? '').trim().slice(0, 600);
  if (description.length < 3) return { error: 'Décrivez la couverture voulue (« mariage champêtre, tons verts, photo de buffet »…).' };
  const companyId = await companyIdFor(user.id);
  const stop = await blocked(user.id, companyId);
  if (stop) return { error: stop };
  const photos = (await listBrochurePhotos()).slice(0, 80);
  const templates = PAGE_TEMPLATES.filter((t) => t.id.startsWith('cover-')).map((t) => t.id);
  const settings = await getWeboSettings();
  const res = await withCoins(user.id, companyId, settings.translationPrice, 'Brochure : couverture par Webo', `cv:${companyId}:${String(input.requestId ?? '').slice(0, 100)}`, async () => {
    const out = await designCover({ description, language: input.language === 'en' ? 'en' : 'fr', templates, themes: THEMES.map((t) => t.name), photos: photos.map((p) => p.label) });
    return { value: out.idea, usage: [out.usage] };
  });
  if ('error' in res) return res;
  const idea = res.value;
  return { templateId: idea.template, themeName: idea.theme, title: idea.title, subtitle: idea.subtitle, photoUrl: photos[idea.photo]?.url ?? null };
}

/** Textes d'une brochure du Studio à traduire : textes et retouches de prestation, avec de quoi les remettre. */
function textsOf(doc: StudioDoc): { get: string[]; put: (translated: string[]) => StudioDoc } {
  const spots: { p: number; e: number }[] = [];
  doc.pages.forEach((page, p) => page.els.forEach((el, e) => {
    if ((el.type === 'text' && el.html.replace(/<[^>]*>|&nbsp;|\s/g, '')) || (el.type === 'prestation' && el.html)) spots.push({ p, e });
  }));
  return {
    get: spots.map(({ p, e }) => { const el = doc.pages[p].els[e]; return el.type === 'text' ? el.html : el.type === 'prestation' ? el.html ?? '' : ''; }),
    put: (translated) => {
      const next = structuredClone(doc);
      spots.forEach(({ p, e }, i) => { const el = next.pages[p].els[e]; if (el.type === 'text' || el.type === 'prestation') el.html = translated[i]; });
      return next;
    },
  };
}

/** Textes par appel à Claude (une réponse doit tenir dans sa limite). */
const BATCH_TEXTS = 30;
const BATCH_CHARS = 24_000;

/**
 * Version anglaise d'une brochure du Studio, en un clic : une copie, en anglais, tous ses textes traduits par Webo,
 * la mise en page gardée (les fiches des prestations prennent leur version anglaise du catalogue quand elle existe).
 * 1 WeboCoin par tranche de 10 textes.
 */
export async function createEnglishVersion(brochureId: string, requestId: string): Promise<{ id: string } | { error: string }> {
  const user = await requireWriter();
  const [b] = await db.select().from(brochures).where(and(eq(brochures.id, brochureId), sql`${brochures.owner_user_id} in ${companyIdsOf(user.id)}`)).limit(1);
  if (!b) return { error: 'Brochure introuvable.' };
  const doc = parseStudio(b.studio);
  if (b.editor_mode !== 'studio' || !doc) return { error: 'La version anglaise se fait pour une brochure du Studio.' };
  const companyId = await companyIdFor(user.id);
  const stop = await blocked(user.id, companyId);
  if (stop) return { error: stop };
  const { get, put } = textsOf(doc);
  if (get.some((t) => t.length > BATCH_CHARS)) return { error: 'Un texte est trop long pour Webo : coupez-le en plusieurs.' };
  const settings = await getWeboSettings();
  const coins = Math.max(1, Math.ceil(get.length / 10)) * settings.translationPrice;
  const res = await withCoins(user.id, companyId, coins, `Brochure : version anglaise de ${b.name}`.slice(0, 200), `en:${companyId}:${String(requestId ?? '').slice(0, 100)}`, async () => {
    const out: string[] = [];
    const usage: WeboUsage[] = [];
    let batch: string[] = [];
    const flush = async () => {
      if (!batch.length) return;
      const r = await translateTexts(batch);
      out.push(...r.texts);
      usage.push(r.usage);
      batch = [];
    };
    for (const t of get) {
      if (batch.length >= BATCH_TEXTS || batch.join('').length + t.length > BATCH_CHARS) await flush();
      batch.push(t);
    }
    await flush();
    return { value: sanitizeStudio(put(out.map((t) => sanitizeHtml(t)))), usage };
  });
  if ('error' in res) return res;
  const [row] = await db.insert(brochures).values({
    owner_user_id: b.owner_user_id, user_id: user.id, name: `${b.name} (EN)`.slice(0, 120), style: b.style, language: 'en',
    show_prices: b.show_prices, price_mode: b.price_mode, vat_rate: b.vat_rate, is_active: true, share_token: newLinkToken(),
    cover: b.cover, content: b.content, editor_mode: 'studio', studio: res.value, notify: b.notify,
  }).returning({ id: brochures.id });
  return { id: row.id };
}
