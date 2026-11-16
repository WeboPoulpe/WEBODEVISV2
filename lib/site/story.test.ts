import { describe, expect, it } from 'vitest';
import { CHECKLIST, CREW, DAYS, INVOICED, MARGIN, REQUESTS, STORY, clampGuests, quoteLines, quoteTotalTtc } from './story';

describe('la semaine de Julien', () => {
  it('raconte six demandes, trois extras, huit étapes', () => {
    expect(REQUESTS).toHaveLength(6);
    expect(CREW).toHaveLength(3);
    expect(CHECKLIST).toHaveLength(5);
    expect(DAYS.map((d) => d.id)).toEqual(['lun', 'devis', 'mer', 'jeu', 'ven', 'sam', 'fin', 'tarif']);
  });

  it('calcule le devis du mariage', () => {
    expect(quoteLines(120).map((l) => l.amount)).toEqual([2160, 6240, 1440]);
    expect(quoteTotalTtc(120)).toBe(10824);
  });

  it('facture ce que le devis final annonce', () => {
    expect(INVOICED).toBe(quoteTotalTtc(STORY.finalGuests));
    expect(MARGIN).toBeGreaterThan(0);
    expect(MARGIN).toBeLessThan(INVOICED);
  });

  it('laisse le compteur atteindre le nombre final de convives', () => {
    expect((STORY.finalGuests - STORY.guests) % STORY.step).toBe(0);
  });

  it('garde le nombre de convives entre ses bornes', () => {
    expect(clampGuests(0)).toBe(20);
    expect(clampGuests(9999)).toBe(300);
    expect(clampGuests(Number.NaN)).toBe(STORY.guests);
  });
});
