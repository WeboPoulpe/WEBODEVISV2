import { afterEach, describe, expect, it } from 'vitest';
import { directoryMetadata, directoryRobots } from './metadata';

const page = { title: 'Traiteurs', description: 'Les traiteurs.', path: '/traiteurs' };

describe('annuaire : consigne aux moteurs de recherche', () => {
  const saved = process.env.DIRECTORY_HOST;
  afterEach(() => {
    if (saved === undefined) delete process.env.DIRECTORY_HOST;
    else process.env.DIRECTORY_HOST = saved;
  });

  it('sans domaine propre, aucune page n’est indexée ni suivie', () => {
    expect(directoryRobots(false, undefined)).toEqual({ index: false, follow: false });
    expect(directoryRobots(true, undefined)).toEqual({ index: false, follow: false });
    expect(directoryRobots(false, '  ')).toEqual({ index: false, follow: false });
  });

  it('avec le domaine, seules les pages marquées sont écartées, leurs liens suivis', () => {
    expect(directoryRobots(false, 'choisirmontraiteur.fr')).toBeUndefined();
    expect(directoryRobots(true, 'choisirmontraiteur.fr')).toEqual({ index: false, follow: true });
  });

  it('les métadonnées d’une page suivent la variable DIRECTORY_HOST', () => {
    delete process.env.DIRECTORY_HOST;
    expect(directoryMetadata(page).robots).toEqual({ index: false, follow: false });
    process.env.DIRECTORY_HOST = 'choisirmontraiteur.fr';
    expect(directoryMetadata(page).robots).toBeUndefined();
    expect(directoryMetadata({ ...page, noindex: true }).robots).toEqual({ index: false, follow: true });
  });
});
