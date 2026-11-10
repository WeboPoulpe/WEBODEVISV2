import { describe, it, expect } from 'vitest';
import { accessFrom, periodStart, nextPeriodStart, periodKey, statusLabel, type SubRow } from './subscription';

const row = (o: Partial<SubRow> = {}): SubRow => ({
  status: 'active', comped: false, ever_subscribed: true, cancel_at_period_end: false,
  current_period_end: null, plan: 'mensuel', anchor_day: 17, ...o,
});
const on = { demo: false, enforced: true };

describe('accessFrom', () => {
  it('tout le monde a full quand le réglage est éteint', () => {
    expect(accessFrom(null, { demo: false, enforced: false })).toBe('full');
    expect(accessFrom(row({ status: 'canceled' }), { demo: false, enforced: false })).toBe('full');
  });
  it('démo et offert : full', () => {
    expect(accessFrom(null, { demo: true, enforced: true })).toBe('full');
    expect(accessFrom(row({ comped: true, status: 'canceled' }), on)).toBe('full');
  });
  it('active et past_due : full', () => {
    expect(accessFrom(row(), on)).toBe('full');
    expect(accessFrom(row({ status: 'past_due' }), on)).toBe('full');
  });
  it('résilié ou impayé après un abonnement : lecture seule', () => {
    expect(accessFrom(row({ status: 'canceled' }), on)).toBe('readonly');
    expect(accessFrom(row({ status: 'unpaid' }), on)).toBe('readonly');
    expect(accessFrom(row({ status: 'paused' }), on)).toBe('readonly');
  });
  it('jamais abonné : unpaid', () => {
    expect(accessFrom(null, on)).toBe('unpaid');
    expect(accessFrom(row({ status: 'incomplete', ever_subscribed: false }), on)).toBe('unpaid');
  });
});

describe('calendrier des pièces', () => {
  it('periodStart', () => {
    expect(periodStart(17, new Date('2026-11-10T12:00:00Z')).toISOString()).toBe('2026-10-16T22:00:00.000Z');
    expect(periodStart(31, new Date('2027-02-15T12:00:00Z')).toISOString()).toBe('2027-01-30T23:00:00.000Z');
    expect(periodStart(31, new Date('2027-03-01T12:00:00Z')).toISOString()).toBe('2027-02-27T23:00:00.000Z');
  });
  it('periodStart pile à minuit : ce jour-là', () => {
    expect(periodStart(17, new Date('2026-11-16T23:00:00.000Z')).toISOString()).toBe('2026-11-16T23:00:00.000Z');
    expect(periodStart(17, new Date('2026-11-16T22:59:59.999Z')).toISOString()).toBe('2026-10-16T22:00:00.000Z');
  });
  it('periodStart sur un changement d’année', () => {
    expect(periodStart(17, new Date('2027-01-05T12:00:00Z')).toISOString()).toBe('2026-12-16T23:00:00.000Z');
  });
  it('nextPeriodStart', () => {
    expect(nextPeriodStart(31, new Date('2027-02-15T12:00:00Z')).toISOString()).toBe('2027-02-27T23:00:00.000Z');
    expect(nextPeriodStart(17, new Date('2026-12-20T12:00:00Z')).toISOString()).toBe('2027-01-16T23:00:00.000Z');
  });
  it('periodKey', () => {
    expect(periodKey(17, new Date('2026-11-20T12:00:00Z'))).toBe('s:2026-11-17');
    expect(periodKey(17, new Date('2026-11-10T12:00:00Z'))).toBe('s:2026-10-17');
  });
});

describe('statusLabel', () => {
  it('libellés', () => {
    expect(statusLabel('active', false)).toBe('Actif');
    expect(statusLabel('active', true)).toBe('Se termine bientôt');
    expect(statusLabel('past_due', false)).toBe('Paiement en retard');
    expect(statusLabel('canceled', false)).toBe('Terminé');
    expect(statusLabel('incomplete', false)).toBe('Inactif');
  });
});
