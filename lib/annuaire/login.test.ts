import { describe, expect, it } from 'vitest';
import { fromDirectory, loginDestination } from './login';

describe('connexion d’un traiteur venu de l’annuaire', () => {
  it('mène à « Ma fiche » quand la connexion vient de l’annuaire', () => {
    expect(fromDirectory('annuaire')).toBe(true);
    expect(loginDestination('annuaire')).toBe('/ma-fiche');
    expect(loginDestination(['annuaire', 'pwa'])).toBe('/ma-fiche');
  });

  it('garde l’accueil de l’application dans tous les autres cas', () => {
    for (const source of [undefined, '', 'pwa', 'Annuaire', 'annuaire ', '/ma-fiche', 'https://exemple.fr', ['pwa', 'annuaire']]) {
      expect(fromDirectory(source)).toBe(false);
      expect(loginDestination(source)).toBe('/');
    }
  });
});
