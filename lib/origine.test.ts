import { afterEach, expect, it, vi } from 'vitest';
import { captureOriginFromUrl, originFromPath, originLabel, parseOrigin, readStoredOrigin, safeDestination, storeOrigin } from './origine';

afterEach(() => vi.unstubAllGlobals());

it('accepte bio et libellés', () => {
  expect(parseOrigin('instagram')).toBe('instagram');
  expect(parseOrigin('instagram:lancement')).toBe('instagram:lancement');
});

it('refuse le reste', () => {
  for (const v of ['facebook', 'instagram:', 'instagram:A', 'instagram:<script>', 'instagram:' + 'a'.repeat(31), 42, null, undefined]) {
    expect(parseOrigin(v)).toBeNull();
  }
});

it('libellé tiré du chemin', () => {
  expect(originFromPath(undefined)).toBe('instagram');
  expect(originFromPath([])).toBe('instagram');
  expect(originFromPath(['demo-noel'])).toBe('instagram:demo-noel');
  expect(originFromPath(['Pas Bon'])).toBe('instagram');
});

it('destination interne seulement', () => {
  expect(safeDestination('/demo')).toBe('/demo');
  expect(safeDestination('/tarifs?x=1')).toBe('/tarifs?x=1');
  for (const v of [null, '', 'https://x.fr', '//x.fr', '/\\x.fr', 'javascript:alert(1)', '/' + 'a'.repeat(300)]) {
    expect(safeDestination(v)).toBe('/site');
  }
});

it('libellé lisible', () => {
  expect(originLabel('instagram')).toBe('Instagram · bio');
  expect(originLabel('instagram:lancement')).toBe('Instagram · lancement');
});

it('stockage de la visite', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  expect(readStoredOrigin()).toBeNull();
  storeOrigin('instagram:lancement');
  expect(readStoredOrigin()).toBe('instagram:lancement');
});

it('stockage bloqué : pas d’erreur', () => {
  vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('bloqué'); } });
  expect(readStoredOrigin()).toBeNull();
  expect(() => storeOrigin('instagram')).not.toThrow();
});

it('capte l’origine et nettoie l’adresse', () => {
  expect(captureOriginFromUrl('https://webodevis.fr/site?o=instagram%3Alancement&x=1')).toEqual({ origin: 'instagram:lancement', cleaned: '/site?x=1' });
  expect(captureOriginFromUrl('https://webodevis.fr/demo?o=instagram#tarifs')).toEqual({ origin: 'instagram', cleaned: '/demo#tarifs' });
});

it('origine invalide : retirée de l’adresse, pas gardée', () => {
  expect(captureOriginFromUrl('https://webodevis.fr/demo?o=facebook')).toEqual({ origin: null, cleaned: '/demo' });
});

it('rien à capter : rien à faire', () => {
  expect(captureOriginFromUrl('https://webodevis.fr/demo?x=1')).toEqual({ origin: null, cleaned: null });
});
