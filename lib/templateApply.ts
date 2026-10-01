import { fold, sameName } from './equipment';

// Appliquer un modèle (location ou matériel) à un événement qui contient déjà des articles :
// « Ajouter » ou « Remplacer ». Le calcul est fait ici, sans base ni écran, pour que la fenêtre de choix
// affiche exactement ce qui sera fait (nombre d'articles ajoutés, mis à jour, retirés, gardés).
//
// Ajouter : un article déjà présent (même nom, sans tenir compte des accents ni des majuscules) voit sa quantité
// cumulée. Un second modèle sert en général un second temps de la réception (cocktail puis dîner) : la vaisselle,
// le nappage ou les brûleurs ne se réutilisent pas d'un temps à l'autre, et manquer coûte plus cher qu'avoir en trop.
// Exception : un article déjà commandé auprès d'un loueur n'est pas modifié (la commande passée resterait fausse) ;
// le surplus devient une ligne « complément », à commander.
//
// Remplacer : les articles présents sont retirés, ceux du modèle les remplacent. Les articles déjà commandés sont
// gardés si on le demande (par défaut) et comptent dans la quantité du modèle : seul le complément est ajouté.

export interface CurrentLine {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  /** Déjà commandé (ou commandé à part) : ne se modifie ni ne se retire sans le dire. */
  locked?: boolean;
}

export interface IncomingLine<T = unknown> {
  name: string;
  qty: number;
  unit: string | null;
  /** Données propres à l'article (fournisseur, prix…), reprises telles quelles. */
  data: T;
}

export interface AddedLine<T> extends IncomingLine<T> {
  /** Complément d'un article déjà commandé : le nom de cet article. */
  complementOf?: string;
}

export interface ApplyPlan<T> {
  add: AddedLine<T>[];
  update: { line: CurrentLine; qty: number }[];
  remove: CurrentLine[];
  /** Articles déjà commandés gardés tels quels. */
  keep: CurrentLine[];
}

export type ApplyMode = 'add' | 'replace';

/** Même article : même nom et même unité (une unité vide va avec toutes). « 2 cartons » et « 2 pièces » ne s'additionnent pas. */
const sameArticle = (a: { name: string; unit: string | null }, b: { name: string; unit: string | null }) =>
  sameName(a.name, b.name) && (!a.unit || !b.unit || fold(a.unit) === fold(b.unit));

/** Un modèle qui cite deux fois le même article n'en donne qu'une ligne. Les quantités nulles sont laissées de côté. */
export function mergeIncoming<T>(lines: IncomingLine<T>[]): IncomingLine<T>[] {
  const out: IncomingLine<T>[] = [];
  for (const line of lines) {
    if (!(line.qty > 0)) continue;
    const twin = out.find((o) => sameArticle(o, line));
    if (twin) twin.qty += line.qty;
    else out.push({ ...line });
  }
  return out;
}

export function planApply<T>(mode: ApplyMode, current: CurrentLine[], incoming: IncomingLine<T>[], keepLocked = true): ApplyPlan<T> {
  const lines = mergeIncoming(incoming);
  const plan: ApplyPlan<T> = { add: [], update: [], remove: [], keep: [] };

  if (mode === 'add') {
    for (const line of lines) {
      const free = current.find((c) => !c.locked && sameArticle(c, line));
      const ordered = current.find((c) => c.locked && sameArticle(c, line));
      if (free) plan.update.push({ line: free, qty: free.qty + line.qty });
      else if (ordered) plan.add.push({ ...line, complementOf: ordered.name });
      else plan.add.push(line);
    }
    return plan;
  }

  plan.keep = keepLocked ? current.filter((c) => c.locked) : [];
  plan.remove = current.filter((c) => !plan.keep.includes(c));
  for (const line of lines) {
    const kept = plan.keep.filter((c) => sameArticle(c, line));
    const covered = kept.reduce((sum, c) => sum + c.qty, 0);
    const rest = line.qty - covered;
    if (rest > 0) plan.add.push(kept.length ? { ...line, qty: rest, complementOf: kept[0].name } : line);
  }
  return plan;
}

const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** « 3 articles ajoutés, 2 mis à jour, 4 retirés, 1 gardé ». */
export function planSummary(plan: ApplyPlan<unknown>): string {
  const parts = [
    plan.add.length && count(plan.add.length, 'article ajouté', 'articles ajoutés'),
    plan.update.length && `${plan.update.length} mis à jour`,
    plan.remove.length && count(plan.remove.length, 'retiré', 'retirés'),
    plan.keep.length && count(plan.keep.length, 'gardé', 'gardés'),
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : 'Aucun changement';
}
