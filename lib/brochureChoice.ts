// ═══════════════════════════════════════════════════════════════════════════
// Brochures : prestations choisies par le lecteur (« Je veux ce menu »)
// ═══════════════════════════════════════════════════════════════════════════
// Le lecteur choisit des prestations dans la brochure ; elles partent avec sa demande, figées telles qu'elles sont
// au catalogue à ce moment-là (nom, prix HT, prix enfant…), puis deviennent les lignes du devis. Sans base.

export interface ChosenLine {
  prestationId: string;
  name: string;
  /** Prix unitaire HT du catalogue. */
  unitPrice: number;
  childUnitPrice: number | null;
  perGuest: boolean;
  category: string | null;
  description: string | null;
  gastroCardHtml: string | null;
}

/** Lignes lues en base (ou reçues), nettoyées ; une liste vide si illisibles. */
export function parseChosen(raw: unknown): ChosenLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30).flatMap((r): ChosenLine[] => {
    if (!r || typeof r !== 'object') return [];
    const x = r as Record<string, unknown>;
    const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
    const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    if (typeof x.prestationId !== 'string' || typeof x.name !== 'string') return [];
    return [{
      prestationId: x.prestationId, name: x.name.slice(0, 200), unitPrice: n(x.unitPrice) ?? 0, childUnitPrice: n(x.childUnitPrice),
      perGuest: x.perGuest === true, category: s(x.category, 80), description: s(x.description, 4000), gastroCardHtml: s(x.gastroCardHtml, 40000),
    }];
  });
}

/** Les lignes du devis tirées des prestations choisies : au couvert, quantité = nombre d'invités ; sinon 1. */
export function chosenToServices(chosen: ChosenLine[], guests: number | null) {
  return chosen.map((c) => ({
    id: crypto.randomUUID(), name: c.name, quantity: c.perGuest ? Math.max(1, guests ?? 1) : 1, unitPrice: c.unitPrice,
    ...(c.childUnitPrice != null ? { childUnitPrice: c.childUnitPrice } : {}),
    ...(c.category ? { category: c.category } : {}),
    ...(c.description ? { description: c.description } : {}),
    ...(c.gastroCardHtml ? { gastroCardHtml: c.gastroCardHtml } : {}),
  }));
}

/** Estimation montrée au lecteur : somme des prix affichés, au couvert × invités. */
export function estimate(items: { amount?: number | null; perGuest?: boolean }[], guests: number): number | null {
  const priced = items.filter((i) => i.amount != null);
  if (!priced.length) return null;
  return Math.round(priced.reduce((t, i) => t + (i.amount as number) * (i.perGuest ? Math.max(1, guests) : 1), 0) * 100) / 100;
}
