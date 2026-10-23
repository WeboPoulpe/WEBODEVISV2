// Modèles de Webo et leur coût réel. Aiguilleur et aide : Claude Haiku 5.5 (rapide, presque gratuit) ; spécialistes
// qui préparent devis, factures, prestations et réponses : Claude Sonnet 5.5 (meilleur rapport qualité/prix pour agir).

export const WEBO_MODELS = { router: 'claude-haiku-5-5', help: 'claude-haiku-5-5', specialist: 'claude-sonnet-5-5' } as const;

/** Prix en dollars par million de jetons : entrée, sortie. */
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.10, 0.50],
  'claude-sonnet-5-5': [2, 10],
};

export interface Usage { input: number; output: number; cacheWrite?: number; cacheRead?: number }

/** Coût réel d'un appel ; écriture en cache ×1,25 et lecture ×0,1 du prix d'entrée. Modèle inconnu : tarif Sonnet. */
export function modelCostUsd(model: string, u: Usage): number {
  const [inPrice, outPrice] = PRICES[model] ?? PRICES['claude-sonnet-5-5'];
  const IN = inPrice / 1_000_000;
  return u.input * IN + u.output * (outPrice / 1_000_000) + (u.cacheWrite ?? 0) * IN * 1.25 + (u.cacheRead ?? 0) * IN * 0.1;
}
