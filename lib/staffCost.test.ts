import { describe, expect, it } from 'vitest';
import {
  appliedRate, hoursInput, hoursLabel, parseHours, missionCost, monthRange, payrollByExtra, payrollCsv, plannedHours, retainedHours, staffTotals, toNumber,
} from './staffCost';

describe('heures prévues', () => {
  it('compte l’écart entre l’arrivée et la fin', () => {
    expect(plannedHours('18:00', '23:30')).toBe(5.5);
    expect(plannedHours('9h', '12h15')).toBe(3.25);
  });
  it('gère le passage de minuit', () => {
    expect(plannedHours('18:00', '02:00')).toBe(8);
    expect(plannedHours('22:30', '00:00')).toBe(1.5);
  });
  it('rien sans les deux heures', () => {
    expect(plannedHours('18:00', null)).toBeNull();
    expect(plannedHours('', '20:00')).toBeNull();
    expect(plannedHours('18:00', '18:00')).toBeNull();
    expect(plannedHours('abc', '20:00')).toBeNull();
  });
});

describe('heures retenues et coût', () => {
  it('les heures saisies l’emportent sur les heures prévues', () => {
    expect(retainedHours({ arrival_time: '18:00', departure_time: '23:00', hours_worked: '6.5' })).toBe(6.5);
    expect(retainedHours({ arrival_time: '18:00', departure_time: '23:00', hours_worked: null })).toBe(5);
    expect(retainedHours({})).toBe(0);
  });
  it('taux de la mission, sinon celui de l’extra', () => {
    expect(appliedRate({ hourly_rate: '15.50' }, 12)).toBe(15.5);
    expect(appliedRate({ hourly_rate: null }, '12')).toBe(12);
    expect(appliedRate({}, null)).toBeNull();
  });
  it('coût = heures × taux, null sans taux', () => {
    expect(missionCost({ arrival_time: '18:00', departure_time: '01:30' }, 14)).toBe(105);
    expect(missionCost({ hours_worked: 4 }, null)).toBeNull();
  });
  it('lit les nombres venus de la base', () => {
    expect(toNumber('12,5')).toBe(12.5);
    expect(toNumber('')).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('x')).toBeNull();
  });
  it('total d’un événement : seuls les confirmés et présents comptent', () => {
    const t = staffTotals([
      { status: 'present', hours_worked: 6, extraRate: 15 },
      { status: 'confirme', arrival_time: '18:00', departure_time: '22:00', hourly_rate: 20 },
      { status: 'confirme', hours_worked: 3 },
      { status: 'refuse', hours_worked: 8, extraRate: 15 },
      { status: 'a_solliciter', hours_worked: 8, extraRate: 15 },
    ]);
    expect(t).toEqual({ hours: 13, cost: 170, missingRate: 1 });
  });
});

describe('récapitulatif pour la paie', () => {
  const extras = [
    { id: 'b', name: 'Zoé Martin', role: 'Serveur', hourly_rate: '13.00' },
    { id: 'a', name: 'Amélie Durand', role: 'Cuisinier', hourly_rate: null },
  ];
  const missions = [
    { id: 'm1', extra_id: 'b', status: 'present', event_date: '2026-10-03', event_type: 'Mariage', client_name: 'Dupont; fils', arrival_time: '18:00', departure_time: '02:00' },
    { id: 'm2', extra_id: 'b', status: 'confirme', event_date: '2026-10-17', event_type: 'Cocktail', client_name: 'Mairie', hours_worked: 4.5, hourly_rate: 15 },
    { id: 'm3', extra_id: 'a', status: 'present', event_date: '2026-10-10', event_type: 'Buffet', client_name: 'Société X', hours_worked: 5, hourly_rate: 16 },
    { id: 'm4', extra_id: 'a', status: 'refuse', event_date: '2026-10-11', hours_worked: 5, hourly_rate: 16 },
    { id: 'm5', extra_id: 'a', status: 'present', event_date: '2026-11-02', hours_worked: 5, hourly_rate: 16 },
  ];

  it('mois : premier et dernier jour', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('regroupe par extra sur la période', () => {
    const rows = payrollByExtra(missions, extras, monthRange('2026-10'));
    expect(rows.map((r) => r.name)).toEqual(['Amélie Durand', 'Zoé Martin']);
    const [amelie, zoe] = rows;
    expect(amelie).toMatchObject({ missions: 1, hours: 5, rate: 16, mixedRates: false, amount: 80 });
    expect(zoe).toMatchObject({ missions: 2, hours: 12.5, rate: null, mixedRates: true, amount: 171.5, missingRate: 0 });
    expect(zoe.lines.map((l) => l.missionId)).toEqual(['m1', 'm2']);
  });

  it('CSV pour le comptable : point-virgule, virgule décimale, BOM', () => {
    const csv = payrollCsv(payrollByExtra(missions, extras, monthRange('2026-10')), '2026-10');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[2]).toBe('Extra;Rôle;Missions;Heures;Taux horaire brut;Montant brut');
    expect(lines[3]).toBe('Amélie Durand;Cuisinier;1;5,00;16,00;80,00');
    expect(lines[4]).toBe('Zoé Martin;Serveur;2;12,50;variable;171,50');
    expect(lines[5]).toBe('Total;;3;17,50;;251,50');
    expect(lines).toContain('Zoé Martin;03/10/2026;Mariage;"Dupont; fils";8,00;13,00;104,00');
  });

  it('heures saisies à la main', () => {
    expect(parseHours('7,5')).toBe(7.5);
    expect(parseHours('7h30')).toBe(7.5);
    expect(parseHours('7:45')).toBe(7.75);
    expect(parseHours('8 h')).toBe(8);
    expect(parseHours('')).toBeNull();
    expect(parseHours('beaucoup')).toBeNull();
    expect(parseHours('7h75')).toBeNull();
    expect(hoursInput(7.5)).toBe('7h30');
    expect(hoursInput(8)).toBe('8');
    expect(hoursInput(null)).toBe('');
  });

  it('heures lisibles', () => {
    expect(hoursLabel(7.5)).toBe('7 h 30');
    expect(hoursLabel(8)).toBe('8 h');
  });
});
