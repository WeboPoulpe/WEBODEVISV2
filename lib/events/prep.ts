// Préparation d'un événement : ce qui reste à faire, calculé de la même façon par la fiche événement
// et par le tableau de bord. Fonctions pures, utilisables côté serveur comme dans le navigateur.

interface Line {
  id?: string;
  category?: string;
  isPageBreak?: boolean;
  removed?: boolean;
}

const has = (category: string | undefined, keys: string[]) => !!category && keys.some((k) => category.toLowerCase().includes(k));
export const isMaterielLine = (l: { category?: string }) => has(l.category, ['matériel', 'materiel', 'vaisselle', 'équipement', 'equipement', 'location', 'technique']);
export const isPersonnelLine = (l: { category?: string }) => has(l.category, ['personnel', 'service', 'staff', 'extra', 'cuisinier', 'serveur']);

/** Lignes du devis à préparer dans l'onglet Matériel (matériel et personnel). */
export const prepLines = <T extends Line>(services: T[] | null | undefined): T[] =>
  (Array.isArray(services) ? services : []).filter((l) => !l.isPageBreak && !l.removed && (isMaterielLine(l) || isPersonnelLine(l)));

/** Tâches de la checklist : faites et total. */
export function checklistProgress(checklist: unknown): { done: number; total: number } {
  const items = Array.isArray(checklist) ? (checklist as { done?: boolean }[]) : [];
  return { done: items.filter((i) => i?.done).length, total: items.length };
}

/** Matériel à préparer : ajouté à la main et lignes matériel / personnel du devis, cochés ou non. */
export function materialProgress(materials: unknown, services: unknown, checks: unknown): { done: number; total: number } {
  const manual = Array.isArray(materials) ? (materials as { checked?: boolean }[]) : [];
  const lines = prepLines(Array.isArray(services) ? (services as Line[]) : []);
  const checked = new Set(Array.isArray(checks) ? (checks as string[]) : []);
  return {
    done: manual.filter((m) => m?.checked).length + lines.filter((l) => l.id && checked.has(l.id)).length,
    total: manual.length + lines.length,
  };
}
