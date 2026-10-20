import { describe, expect, it } from 'vitest';
import type { DayView } from '@/server/dayView';
import { clearDayView, dayViewKey, loadDayView, parseSavedDayView, saveDayView, type StorageLike } from './offlineStore';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const view = (accountId: string): DayView => ({ accountId, companyName: 'Traiteur A', generatedAt: '2026-12-12T07:00:00.000Z', days: [] });

describe('copie de « Ma journée » sur l’appareil', () => {
  it('enregistre une copie par compte et la relit', () => {
    const s = memory();
    expect(saveDayView(view('a'), s)).toBe(true);
    expect(saveDayView(view('b'), s)).toBe(true);
    expect(loadDayView('a', s)?.accountId).toBe('a');
    expect(loadDayView('b', s)?.accountId).toBe('b');
    expect(loadDayView('c', s)).toBeNull();
  });

  it('sans compte connu (hors ligne), relit celle du dernier compte enregistré', () => {
    const s = memory();
    saveDayView(view('a'), s);
    saveDayView(view('b'), s);
    expect(loadDayView(null, s)?.accountId).toBe('b');
    clearDayView('b', s);
    expect(loadDayView(null, s)).toBeNull();
    expect(loadDayView('a', s)?.accountId).toBe('a');
  });

  it('ignore une copie illisible, d’un autre format ou rangée sous un autre compte', () => {
    expect(parseSavedDayView('pas du json')).toBeNull();
    expect(parseSavedDayView(JSON.stringify({ v: 0, view: view('a') }))).toBeNull();
    const s = memory();
    s.setItem(dayViewKey('a'), JSON.stringify({ v: 1, view: view('b') }));
    expect(loadDayView('a', s)).toBeNull();
  });

  it('ne lève jamais d’erreur si le stockage est indisponible ou plein', () => {
    const full: StorageLike = {
      getItem: () => { throw new Error('bloqué'); },
      setItem: () => { throw new Error('plein'); },
      removeItem: () => { throw new Error('bloqué'); },
    };
    expect(saveDayView(view('a'), full)).toBe(false);
    expect(loadDayView('a', full)).toBeNull();
    expect(() => clearDayView('a', full)).not.toThrow();
    expect(saveDayView(view('a'), null)).toBe(false);
    expect(loadDayView(null, null)).toBeNull();
  });
});
