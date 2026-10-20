// Règles des messages de l'app (bandeaux en bas de l'écran), sans dépendance au navigateur.

export type FeedbackTone = 'info' | 'error' | 'success';

export interface Toast {
  id: number;
  message: string;
  tone: FeedbackTone;
}

/** Nombre de bandeaux visibles en même temps : au-delà, les plus anciens disparaissent. */
export const MAX_TOASTS = 3;

/** Durée d'affichage d'un bandeau, en millisecondes. Une erreur reste un peu plus longtemps. */
export function toastDuration(tone: FeedbackTone): number {
  return tone === 'error' ? 6000 : 4000;
}

/** Une erreur est annoncée tout de suite par les lecteurs d'écran ; le reste attend une pause. */
export function toastRole(tone: FeedbackTone): 'alert' | 'status' {
  return tone === 'error' ? 'alert' : 'status';
}

/** Ajoute un bandeau. Le même message déjà affiché n'est pas répété ; on garde les plus récents. */
export function addToast(list: Toast[], toast: Toast, max = MAX_TOASTS): Toast[] {
  const others = list.filter((t) => !(t.message === toast.message && t.tone === toast.tone));
  return [...others, toast].slice(-max);
}
