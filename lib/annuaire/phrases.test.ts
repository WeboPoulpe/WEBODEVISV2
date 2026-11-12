import { describe, expect, it } from 'vitest';
import { DEPARTMENTS } from './departments';
import { departmentWithArticle, eventPhrase, inDepartment, placeLine, sameRegion, servedPhrase } from './phrases';

describe('tournures de l’annuaire', () => {
  it('le département avec son article', () => {
    expect(inDepartment('10')).toBe('dans l’Aube');
    expect(inDepartment('51')).toBe('dans la Marne');
    expect(inDepartment('88')).toBe('dans les Vosges');
    expect(inDepartment('59')).toBe('dans le Nord');
    expect(inDepartment('31')).toBe('dans la Haute-Garonne');
    expect(inDepartment('68')).toBe('dans le Haut-Rhin');
    expect(inDepartment('34')).toBe('dans l’Hérault');
    expect(inDepartment('21')).toBe('dans la Côte-d’Or');
    expect(inDepartment('75')).toBe('à Paris');
    expect(inDepartment('971')).toBe('en Guadeloupe');
    expect(inDepartment('')).toBe('partout en France');
    expect(inDepartment('00')).toBe('partout en France');
    for (const d of DEPARTMENTS) expect(departmentWithArticle(d.code)).not.toBe('');
  });

  it('le type d’événement', () => {
    expect(eventPhrase('Communion')).toBe('une communion');
    expect(eventPhrase('Inconnu')).toBe('un événement');
    expect(eventPhrase(undefined)).toBe('un événement');
  });

  it('les départements de la même région', () => {
    expect(sameRegion('10')).toContain('51');
    expect(sameRegion('10')).not.toContain('10');
    expect(sameRegion('974')).toEqual([]);
    // Chaque département de métropole appartient à une région.
    for (const d of DEPARTMENTS.filter((x) => x.code.length < 3)) expect(sameRegion(d.code).length).toBeGreaterThan(0);
  });

  it('où se déplace le traiteur', () => {
    expect(servedPhrase(['10'])).toBe('dans l’Aube');
    expect(servedPhrase(['10', '51'])).toBe('dans l’Aube et la Marne');
    expect(servedPhrase(['75', '92'])).toBe('à Paris et dans les Hauts-de-Seine');
    expect(servedPhrase(['10', '51', '52'])).toBe('dans 3 départements');
    expect(servedPhrase(['00'])).toBe('');
    expect(placeLine('Troyes', ['10'])).toBe('Troyes, se déplace dans l’Aube');
    expect(placeLine('', ['10'])).toBe('Se déplace dans l’Aube');
    expect(placeLine('Troyes', [])).toBe('Troyes');
  });
});
