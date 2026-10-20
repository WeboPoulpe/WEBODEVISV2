// Copie de « Ma journée » enregistrée sur l'appareil, pour la consulter sans réseau (en cuisine, sur le lieu).
// Rangée dans le stockage du navigateur (localStorage : quelques kilo-octets suffisent), une copie par compte,
// plus le nom du dernier compte enregistré : hors ligne, la session n'est pas lisible et c'est lui qu'on montre.
// Toute lecture ou écriture peut échouer (navigation privée, stockage plein ou bloqué) : on renvoie alors null.

import type { DayView } from '@/server/dayView';

const PREFIX = 'webodevis:journee:';
const LAST_ACCOUNT = `${PREFIX}dernier-compte`;
const VERSION = 1;

/** Ce qui est enregistré : la journée et la version du format. */
interface Saved {
  v: number;
  view: DayView;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const dayViewKey = (accountId: string) => `${PREFIX}${accountId}`;

/** Stockage du navigateur, ou null s'il n'est pas disponible. À n'appeler que dans un effet ou un gestionnaire. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Relit une copie enregistrée : null si elle est absente, illisible ou d'un ancien format. */
export function parseSavedDayView(raw: string | null): DayView | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Saved>;
    const view = data?.view;
    if (data?.v !== VERSION || !view || typeof view.accountId !== 'string' || typeof view.generatedAt !== 'string' || !Array.isArray(view.days)) return null;
    return view;
  } catch {
    return null;
  }
}

/** Enregistre la journée du compte. Renvoie faux si l'appareil a refusé. */
export function saveDayView(view: DayView, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(dayViewKey(view.accountId), JSON.stringify({ v: VERSION, view } satisfies Saved));
    storage.setItem(LAST_ACCOUNT, view.accountId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dernière copie enregistrée. Avec un compte connu, uniquement la sienne ; sans compte (hors ligne, la session
 * n'est pas lisible), celle du dernier compte qui a ouvert « Ma journée » sur cet appareil.
 */
export function loadDayView(accountId: string | null, storage: StorageLike | null = browserStorage()): DayView | null {
  if (!storage) return null;
  try {
    const id = accountId ?? storage.getItem(LAST_ACCOUNT);
    if (!id) return null;
    const view = parseSavedDayView(storage.getItem(dayViewKey(id)));
    return view && view.accountId === id ? view : null;
  } catch {
    return null;
  }
}

/** Efface la copie d'un compte (et le repère du dernier compte s'il le désigne). */
export function clearDayView(accountId: string, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(dayViewKey(accountId));
    if (storage.getItem(LAST_ACCOUNT) === accountId) storage.removeItem(LAST_ACCOUNT);
  } catch {
    // Rien à faire : la copie reste, elle sera remplacée au prochain chargement.
  }
}
