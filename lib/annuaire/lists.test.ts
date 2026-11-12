import { describe, expect, it } from 'vitest';
import { DEPARTMENTS, departmentByCode, departmentBySlug, departmentOfPostalCode } from './departments';
import { isEventType } from './eventTypes';
import { directoryUrl, DIRECTORY_URL } from './config';

describe('listes fermées de l’annuaire', () => {
  it('101 départements, codes et slugs uniques', () => {
    expect(DEPARTMENTS).toHaveLength(101);
    expect(new Set(DEPARTMENTS.map((d) => d.code)).size).toBe(101);
    expect(new Set(DEPARTMENTS.map((d) => d.slug)).size).toBe(101);
    expect(departmentBySlug('aube-10')?.code).toBe('10');
    expect(departmentByCode('2A')?.slug).toBe('corse-du-sud-2a');
    expect(departmentByCode('974')?.slug).toBe('la-reunion-974');
    expect(departmentByCode('22')?.name).toBe('Côtes-d’Armor'.replace('’', "'"));
    expect(departmentByCode('95')?.slug).toBe('val-d-oise-95');
    expect(departmentByCode('00')).toBeUndefined();
  });
  it('département d’un code postal', () => {
    expect(departmentOfPostalCode('10000')).toBe('10');
    expect(departmentOfPostalCode('75008')).toBe('75');
    expect(departmentOfPostalCode('20000')).toBe('2A');
    expect(departmentOfPostalCode('20199')).toBe('2A');
    expect(departmentOfPostalCode('20200')).toBe('2B');
    expect(departmentOfPostalCode('20600')).toBe('2B');
    expect(departmentOfPostalCode('97400')).toBe('974');
    expect(departmentOfPostalCode('97600')).toBe('976');
    expect(departmentOfPostalCode('abc')).toBeNull();
    expect(departmentOfPostalCode('1000')).toBeNull();
    expect(departmentOfPostalCode('99999')).toBeNull();
  });
  it('types d’événements', () => {
    expect(isEventType('Mariage')).toBe(true);
    expect(isEventType('mariage')).toBe(false);
    expect(isEventType(3)).toBe(false);
  });
  it('adresse de l’annuaire', () => {
    expect(directoryUrl('/annuaire/aube-10')).toBe(`${DIRECTORY_URL}/annuaire/aube-10`);
  });
});
