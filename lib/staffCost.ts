// Heures et coût du personnel (extras) : heures prévues d'après l'arrivée et la fin, heures retenues,
// taux appliqué, coût d'un événement, et récapitulatif mensuel par extra pour la paie (export CSV
// pour Excel : séparateur « ; », décimales à virgule, BOM UTF-8, comme lib/accountingExport.ts).
// Fonctions pures, sans accès à la base.

import type { MissionStatus } from './extras';

/** Statuts qui comptent pour les heures et la paie : l'extra a travaillé (ou doit travailler). */
export const PAID_STATUSES: readonly MissionStatus[] = ['confirme', 'present'];
export const isPaidStatus = (s: string | null | undefined) => (PAID_STATUSES as readonly string[]).includes(s ?? '');

/** Nombre lu depuis la base (les colonnes numeric arrivent souvent en texte) ; null si vide ou illisible. */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Minutes depuis minuit pour « 18:30 », « 18h30 » ou « 18h » ; null sinon. */
function minutesOf(time: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?\s*$/.exec(time ?? '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Heures prévues entre l'arrivée et la fin. Une fin plus tôt que l'arrivée passe minuit
 * (18:00 → 02:00 = 8 h). Null s'il manque une des deux heures ou si elles sont identiques.
 */
export function plannedHours(arrival: string | null | undefined, departure: string | null | undefined): number | null {
  const a = minutesOf(arrival), d = minutesOf(departure);
  if (a === null || d === null || a === d) return null;
  const span = d > a ? d - a : d + 24 * 60 - a;
  return round2(span / 60);
}

export interface MissionHours {
  arrival_time?: string | null;
  departure_time?: string | null;
  hours_worked?: number | string | null;
  hourly_rate?: number | string | null;
}

/** Heures retenues : les heures saisies, sinon les heures prévues, sinon 0. */
export function retainedHours(m: MissionHours): number {
  return toNumber(m.hours_worked) ?? plannedHours(m.arrival_time, m.departure_time) ?? 0;
}

/** Taux appliqué : celui de la mission, sinon le taux habituel de l'extra ; null si aucun. */
export function appliedRate(m: MissionHours, extraRate: number | string | null | undefined): number | null {
  return toNumber(m.hourly_rate) ?? toNumber(extraRate);
}

/** Coût brut d'une mission ; null tant qu'aucun taux n'est connu. */
export function missionCost(m: MissionHours, extraRate: number | string | null | undefined): number | null {
  const rate = appliedRate(m, extraRate);
  return rate === null ? null : round2(retainedHours(m) * rate);
}

export interface StaffTotals {
  hours: number;
  cost: number;
  /** Missions comptées dont le taux n'est pas connu (leur coût n'est pas dans le total). */
  missingRate: number;
}

/** Total des heures et du coût d'un ensemble de missions (statuts confirmé et présent seulement). */
export function staffTotals(missions: readonly (MissionHours & { status?: string | null; extraRate?: number | string | null })[]): StaffTotals {
  let hours = 0, cost = 0, missingRate = 0;
  for (const m of missions) {
    if (m.status !== undefined && !isPaidStatus(m.status)) continue;
    hours += retainedHours(m);
    const c = missionCost(m, m.extraRate);
    if (c === null) missingRate++;
    else cost += c;
  }
  return { hours: round2(hours), cost: round2(cost), missingRate };
}

// ── Récapitulatif pour la paie ───────────────────────────────────────────────

export interface PayrollMissionInput extends MissionHours {
  id: string;
  extra_id: string;
  status: string | null;
  event_date: string | null;
  event_type?: string | null;
  client_name?: string | null;
}

export interface PayrollExtraInput {
  id: string;
  name: string;
  role?: string | null;
  hourly_rate?: number | string | null;
}

export interface PayrollLine {
  missionId: string;
  date: string | null;
  event: string;
  client: string;
  hours: number;
  rate: number | null;
  amount: number | null;
}

export interface PayrollRow {
  extraId: string;
  name: string;
  role: string;
  missions: number;
  hours: number;
  /** Taux unique de la période ; null s'il varie d'une mission à l'autre ou n'est pas connu. */
  rate: number | null;
  /** Le taux change selon les missions. */
  mixedRates: boolean;
  amount: number;
  missingRate: number;
  lines: PayrollLine[];
}

/** Premier et dernier jour d'un mois « AAAA-MM ». */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * Récapitulatif par extra sur une période (dates incluses, AAAA-MM-JJ) : nombre de missions, heures,
 * taux et montant brut, avec le détail par événement. Seules les missions confirmées ou présentes comptent.
 */
export function payrollByExtra(
  missions: readonly PayrollMissionInput[],
  extras: readonly PayrollExtraInput[],
  period?: { from: string; to: string },
): PayrollRow[] {
  const byId = new Map(extras.map((e) => [e.id, e]));
  const rows = new Map<string, PayrollRow>();
  const sorted = [...missions].sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  for (const m of sorted) {
    if (!isPaidStatus(m.status)) continue;
    const day = m.event_date?.slice(0, 10) ?? null;
    if (period && (!day || day < period.from || day > period.to)) continue;
    const extra = byId.get(m.extra_id);
    if (!extra) continue;
    const row = rows.get(extra.id) ?? {
      extraId: extra.id, name: extra.name, role: extra.role ?? '', missions: 0, hours: 0,
      rate: null, mixedRates: false, amount: 0, missingRate: 0, lines: [],
    };
    const hours = retainedHours(m);
    const rate = appliedRate(m, extra.hourly_rate);
    const amount = rate === null ? null : round2(hours * rate);
    row.lines.push({ missionId: m.id, date: day, event: m.event_type ?? '', client: m.client_name ?? '', hours, rate, amount });
    row.missions++;
    row.hours = round2(row.hours + hours);
    if (amount === null) row.missingRate++;
    else row.amount = round2(row.amount + amount);
    rows.set(extra.id, row);
  }
  for (const row of rows.values()) {
    const rates = [...new Set(row.lines.map((l) => l.rate).filter((r): r is number => r !== null))];
    row.rate = rates.length === 1 ? rates[0] : null;
    row.mixedRates = rates.length > 1;
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// ── Export CSV ───────────────────────────────────────────────────────────────

const decimal = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));
const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const frDay = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

/** Libellé du mois « AAAA-MM » : « octobre 2026 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * CSV à transmettre au comptable : un récapitulatif par extra, puis le détail des missions.
 * Taux « variable » quand il change d'une mission à l'autre.
 */
export function payrollCsv(rows: readonly PayrollRow[], month: string): string {
  const lines: string[][] = [
    [`Heures des extras, ${monthLabel(month)}`],
    [],
    ['Extra', 'Rôle', 'Missions', 'Heures', 'Taux horaire brut', 'Montant brut'],
    ...rows.map((r) => [r.name, r.role, String(r.missions), decimal(r.hours), r.mixedRates ? 'variable' : decimal(r.rate), decimal(r.amount)]),
    ['Total', '', String(rows.reduce((s, r) => s + r.missions, 0)), decimal(round2(rows.reduce((s, r) => s + r.hours, 0))), '', decimal(round2(rows.reduce((s, r) => s + r.amount, 0)))],
    [],
    ['Détail des missions'],
    ['Extra', 'Date', 'Événement', 'Client', 'Heures', 'Taux horaire brut', 'Montant brut'],
    ...rows.flatMap((r) => r.lines.map((l) => [r.name, frDay(l.date), l.event, l.client, decimal(l.hours), decimal(l.rate), decimal(l.amount)])),
  ];
  return '﻿' + lines.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/**
 * Heures saisies à la main : « 7,5 », « 7.5 », « 7h30 », « 7:30 » ou « 7 h ». Null si vide ou illisible.
 */
export function parseHours(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const hm = /^(\d{1,2})\s*[:hH]\s*(\d{1,2})?$/.exec(t);
  if (hm) {
    const min = Number(hm[2] ?? 0);
    return min > 59 ? null : round2(Number(hm[1]) + min / 60);
  }
  const n = toNumber(t);
  return n === null || n < 0 || n > 48 ? null : round2(n);
}

/** Heures dans un champ de saisie : « 7h30 », « 8 ». */
export function hoursInput(h: number | null): string {
  if (h === null) return '';
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : String(hh);
}

/** Montant en euros pour l'écran : « 1 234,50 € ». */
export const euros = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/** Heures pour l'écran : « 7 h 30 ». */
export function hoursLabel(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`;
}
