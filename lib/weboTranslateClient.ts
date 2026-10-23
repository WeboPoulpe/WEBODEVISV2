// Traduction de fiches en anglais, au choix : par Webo (1 WeboCoin la fiche, côté serveur) ou gratuite (MyMemory,
// dans le navigateur). En mode Webo, ce que le serveur ne prend pas (solde, plafond, panne…) part en gratuit.
// Deux fiches identiques (même nom, même texte) ne sont traduites et payées qu'une fois.

import { translateWithWebo, type WeboFallback, type WeboResult } from '@/server/weboTranslate';
import { translateHtmlFrToEnDetailed, translateTextFrToEn } from './prestationCard';

export interface Fiche {
  key: string;
  name: string;
  html: string;
  /** Le nom ne sert qu'à nommer la fiche (journal des WeboCoins) : la traduction gratuite ne le traduit pas. */
  keepName?: boolean;
}
export interface Translated { name: string; html: string; by: 'webo' | 'free' }
export type TranslationMode = 'webo' | 'free';

type WeboFn = (fiches: { key: string; requestId: string; name: string; html: string }[]) => Promise<{ results: WeboResult[]; spent: number; balance: number }>;
interface Deps {
  webo: WeboFn;
  free: { html: (html: string) => Promise<{ html: string; missed: number }>; text: (text: string) => Promise<string | null> };
}
const DEFAULT_DEPS: Deps = { webo: translateWithWebo, free: { html: translateHtmlFrToEnDetailed, text: translateTextFrToEn } };

const BATCH = 40;
const identity = (f: Pick<Fiche, 'name' | 'html'>) => `${f.name}\u0000${f.html}`;

/** Nombre de fiches distinctes : ce que coûte un passage par Webo, en pièces. */
export function countFiches(fiches: Pick<Fiche, 'name' | 'html'>[]): number {
  return new Set(fiches.map(identity)).size;
}

export interface TranslationRun {
  byKey: Map<string, Translated>;
  /** Fiches traduites par Webo, et en gratuit. */
  webo: number;
  free: number;
  /** Pourquoi des fiches sont passées en gratuit en mode Webo (la première raison rencontrée). */
  fallbackWhy: WeboFallback | null;
  /** Morceaux restés en français dans la traduction gratuite. */
  missed: number;
}

export async function translateFiches(fiches: Fiche[], mode: TranslationMode, deps: Deps = DEFAULT_DEPS): Promise<TranslationRun> {
  const run: TranslationRun = { byKey: new Map(), webo: 0, free: 0, fallbackWhy: null, missed: 0 };
  // Une seule traduction par fiche distincte, puis répartie sur ses clés.
  const groups = new Map<string, { fiche: Fiche; keys: string[] }>();
  for (const f of fiches) {
    const id = identity(f);
    const g = groups.get(id);
    if (g) g.keys.push(f.key); else groups.set(id, { fiche: f, keys: [f.key] });
  }
  const distinct = [...groups.values()];
  const done = new Map<string, Translated>();

  if (mode === 'webo' && distinct.length > 0) {
    for (let i = 0; i < distinct.length; i += BATCH) {
      const batch = distinct.slice(i, i + BATCH).map(({ fiche }) => ({
        key: identity(fiche), requestId: crypto.randomUUID(), name: fiche.name, html: fiche.html,
      }));
      const res = await deps.webo(batch).catch(() => ({ results: batch.map((b) => ({ key: b.key, ok: false as const, why: 'error' as const })), spent: 0, balance: 0 }));
      for (const r of res.results) {
        if (r.ok) { done.set(r.key, { name: r.name, html: r.html, by: 'webo' }); run.webo++; }
        else run.fallbackWhy ??= r.why;
      }
    }
  }

  for (const { fiche } of distinct) {
    const id = identity(fiche);
    if (done.has(id)) continue;
    const html = await deps.free.html(fiche.html);
    const wantName = !fiche.keepName && !!fiche.name.trim();
    const name = wantName ? await deps.free.text(fiche.name) : null;
    run.missed += html.missed + (wantName && !name ? 1 : 0);
    done.set(id, { name: name ?? fiche.name, html: html.html, by: 'free' });
    run.free++;
  }

  for (const [id, { keys }] of groups) for (const k of keys) run.byKey.set(k, done.get(id)!);
  return run;
}

/** Phrase qui explique pourquoi des fiches sont passées en gratuit. */
export function fallbackMessage(why: WeboFallback): string {
  switch (why) {
    case 'balance': return 'Plus assez de WeboCoins — rechargez bientôt depuis Mes WeboCoins';
    case 'cap': return 'Limite mensuelle de traductions Webo atteinte';
    case 'error': return 'Webo n’a pas répondu pour certaines fiches';
    case 'readonly': return 'Votre accès en lecture ne permet pas d’utiliser Webo';
    case 'demo': return 'Webo n’est pas disponible dans la démonstration';
    case 'off': return 'Webo est indisponible';
  }
}

/** Bilan d'une traduction : « 4 fiches traduites par Webo (4 W), 2 en gratuit ». */
export function runSummary(run: Pick<TranslationRun, 'webo' | 'free'>, price = 1): string {
  const parts: string[] = [];
  if (run.webo) parts.push(`${run.webo} fiche${run.webo > 1 ? 's' : ''} traduite${run.webo > 1 ? 's' : ''} par Webo (${run.webo * price} W)`);
  if (run.free) parts.push(run.webo ? `${run.free} en gratuit` : `${run.free} fiche${run.free > 1 ? 's' : ''} traduite${run.free > 1 ? 's' : ''} en gratuit`);
  return parts.join(', ');
}
