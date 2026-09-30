import type { HelpCategoryId, HelpGuide, HelpMedia } from './types';
import { demarrer } from './guides/demarrer';
import { devis } from './guides/devis';
import { clients } from './guides/clients';
import { evenements } from './guides/evenements';
import { stock } from './guides/stock';
import { catalogue } from './guides/catalogue';
import { compte } from './guides/compte';
import media from './media.json';

export type { HelpCategoryId, HelpGuide, HelpMedia, HelpStep } from './types';

export const HELP_CATEGORIES: { id: HelpCategoryId; label: string }[] = [
  { id: 'demarrer', label: 'Démarrer' },
  { id: 'devis', label: 'Devis' },
  { id: 'clients', label: 'Clients et demandes' },
  { id: 'evenements', label: 'Événements' },
  { id: 'stock', label: 'Stock et achats' },
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'compte', label: 'Compte' },
];

export const HELP_GUIDES: HelpGuide[] = [...demarrer, ...devis, ...clients, ...evenements, ...stock, ...catalogue, ...compte];

/** Vidéos et images des guides, produites par `node scripts/help/record.mjs` puis `node scripts/help/upload.mjs`. */
export const HELP_MEDIA = media as Record<string, HelpMedia>;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function searchGuides(query: string): HelpGuide[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return HELP_GUIDES;
  return HELP_GUIDES.filter((g) => {
    const hay = fold(`${g.title} ${g.summary} ${g.keywords.join(' ')} ${g.steps.map((s) => s.title).join(' ')}`);
    return words.every((w) => hay.includes(w));
  });
}

/** Guides qui concernent la page ouverte, du plus précis au plus général. */
export function guidesForPath(pathname: string): HelpGuide[] {
  return HELP_GUIDES
    .filter((g) => g.href && (g.href === '/' ? pathname === '/' : pathname === g.href || pathname.startsWith(`${g.href}/`)))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0));
}
