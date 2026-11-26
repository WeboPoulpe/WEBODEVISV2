// Kits de matériel : un modèle (« Kit café ») peut être inclus dans d'autres (« Brunch », « Mariage »), sur plusieurs
// niveaux. Le lien est vivant : on met le modèle à plat au moment de l'utiliser. Un article présent dans plusieurs
// kits donne plusieurs lignes ; elles s'additionnent ensuite (mergeIncoming, lib/templateApply.ts).

export interface KitLink { parent_id: string; child_id: string; sort_order?: number }

const childrenOf = (setId: string, links: KitLink[]) =>
  links.filter((l) => l.parent_id === setId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((l) => l.child_id);

/** Articles du modèle, puis ceux de ses kits (et des kits de ses kits). Une boucle éventuelle est ignorée. */
export function flattenSet<T extends { set_id: string }>(setId: string, items: T[], links: KitLink[]): T[] {
  const out: T[] = [];
  const walk = (id: string, path: Set<string>) => {
    if (path.has(id)) return;
    const next = new Set(path).add(id);
    out.push(...items.filter((i) => i.set_id === id));
    for (const child of childrenOf(id, links)) walk(child, next);
  };
  walk(setId, new Set());
  return out;
}

/** Tous les modèles inclus, directement ou non, dans ce modèle. */
export function descendants(setId: string, links: KitLink[]): Set<string> {
  const seen = new Set<string>();
  const stack = [setId];
  while (stack.length) {
    for (const child of childrenOf(stack.pop()!, links)) {
      if (!seen.has(child)) { seen.add(child); stack.push(child); }
    }
  }
  return seen;
}

/** Inclure `childId` dans `parentId` créerait une boucle (ou l'inclut dans lui-même). */
export const wouldCycle = (parentId: string, childId: string, links: KitLink[]) =>
  parentId === childId || descendants(childId, links).has(parentId);
