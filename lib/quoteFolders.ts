/**
 * Dossiers de devis — logique d'arborescence pure (aucun React, aucune requête).
 * Les classes Tailwind et les icônes vivent dans `components/devis/folderVisuals.tsx`
 * (le dossier `lib/` n'est pas scanné par Tailwind).
 */

export interface QuoteFolder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  icon: string;
  owner_user_id?: string;
  created_at?: string;
}

export interface FolderNode extends QuoteFolder {
  children: FolderNode[];
  depth: number;
}

/** Enfants directs d'un dossier (racine = parentId null), triés par nom. */
export function childrenOf(folders: QuoteFolder[], parentId: string | null): QuoteFolder[] {
  return folders
    .filter((f) => (f.parent_id ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

/** Arbre complet à partir de la liste plate. Les orphelins remontent à la racine. */
export function buildFolderTree(folders: QuoteFolder[]): FolderNode[] {
  const known = new Set(folders.map((f) => f.id));
  const build = (parentId: string | null, depth: number): FolderNode[] =>
    folders
      .filter((f) => {
        const p = f.parent_id ?? null;
        if (p === parentId) return true;
        // orphelin (parent supprimé côté serveur) → traité comme racine
        return parentId === null && p !== null && !known.has(p);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
      .map((f) => ({ ...f, depth, children: build(f.id, depth + 1) }));
  return build(null, 0);
}

/** Aplatit l'arbre en liste ordonnée (parcours préfixe) — pratique pour un sélecteur. */
export function flattenTree(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** Chemin racine → dossier (fil d'Ariane). Tableau vide si l'id est inconnu ou null. */
export function folderPath(folders: QuoteFolder[], id: string | null): QuoteFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: QuoteFolder[] = [];
  const seen = new Set<string>();
  let cur = id ? byId.get(id) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id); // garde-fou anti-cycle
    path.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return path;
}

/** Ids du dossier + de toute sa descendance. Ensemble vide si id est null (= racine, tout). */
export function descendantIds(folders: QuoteFolder[], id: string | null): Set<string> {
  const out = new Set<string>();
  if (!id) return out;
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const f of folders) if ((f.parent_id ?? null) === cur) stack.push(f.id);
  }
  return out;
}

/** true si `candidateId` est `folderId` lui-même ou l'un de ses descendants. */
export function isSelfOrDescendant(folders: QuoteFolder[], folderId: string, candidateId: string | null): boolean {
  if (!candidateId) return false;
  return descendantIds(folders, folderId).has(candidateId);
}

/**
 * Nombre de devis par dossier, sous-dossiers inclus.
 * `quoteFolderIds` = la liste des folder_id des devis visibles (null ignoré).
 */
export function folderCounts(
  folders: QuoteFolder[],
  quoteFolderIds: (string | null | undefined)[],
): Map<string, number> {
  const direct = new Map<string, number>();
  for (const fid of quoteFolderIds) {
    if (!fid) continue;
    direct.set(fid, (direct.get(fid) ?? 0) + 1);
  }
  const totals = new Map<string, number>();
  for (const f of folders) {
    let sum = 0;
    for (const id of descendantIds(folders, f.id)) sum += direct.get(id) ?? 0;
    totals.set(f.id, sum);
  }
  return totals;
}

/** Libellé du chemin d'un devis, ex. « Mariages › 2026 ». Vide si le devis est à la racine. */
export function folderPathLabel(folders: QuoteFolder[], id: string | null): string {
  return folderPath(folders, id).map((f) => f.name).join(' › ');
}
