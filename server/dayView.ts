'use server';

import { getDayProduction, getRunSheet } from './eventSheets';
import { requireUser } from './session';
import { ALLERGEN_LABELS } from '@/lib/allergens';
import type { RunSheetStep } from '@/lib/production';

// « Ma journée » : les événements confirmés d'aujourd'hui et de demain (heure de Paris), avec tout ce qu'il
// faut sur place ou en cuisine. La page l'enregistre sur l'appareil pour le consulter sans réseau.
// Les données viennent des fiches existantes (production du jour et feuille de route), qui vérifient
// chacune que les devis appartiennent à l'entreprise du compte connecté.

export interface DayViewTeamMember {
  name: string;
  role: string | null;
  phone: string | null;
  arrival: string | null;
  departure: string | null;
}

export interface DayViewDish {
  name: string;
  toProduce: number;
  /** Libellés des allergènes (« Gluten », « Lait »…). */
  allergens: string[];
}

export interface DayViewEvent {
  id: string;
  date: string;
  quoteNumber: string | null;
  clientName: string;
  clientPhone: string | null;
  contactPerson: string | null;
  recipientPhone: string | null;
  recipientRole: string | null;
  /** Contact sur place, en texte libre (nom et téléphone). */
  onsiteContact: string | null;
  eventType: string | null;
  eventLocation: string | null;
  teamArrivalTime: string | null;
  guestCount: number;
  adults: number | null;
  children: number | null;
  steps: RunSheetStep[];
  team: DayViewTeamMember[];
  dishes: DayViewDish[];
  /** Lignes du devis sans plat au catalogue (location, personnel, plats saisis à la main). */
  otherLines: string[];
  remarks: string | null;
  internalNotes: string | null;
}

export interface DayViewDay {
  date: string;
  label: 'Aujourd’hui' | 'Demain';
  events: DayViewEvent[];
}

export interface DayView {
  /** Compte connecté : la copie enregistrée sur l'appareil est rangée sous ce compte. */
  accountId: string;
  companyName: string;
  /** Date et heure de préparation de ces informations (ISO). */
  generatedAt: string;
  days: DayViewDay[];
}

const parisDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Événements confirmés d'aujourd'hui et de demain, prêts à être consultés sans réseau. */
export async function getDayView(): Promise<DayView> {
  const user = await requireUser();
  const now = new Date();
  const today = parisDate(now);
  const dates: [string, DayViewDay['label']][] = [[today, 'Aujourd’hui'], [nextDay(today), 'Demain']];

  let companyName = '';
  const days = await Promise.all(dates.map(async ([date, label]) => {
    const production = await getDayProduction(date);
    if (production && !companyName && production.events.length > 0) companyName = production.companyName;
    const events = await Promise.all((production?.events ?? []).map(async (e): Promise<DayViewEvent | null> => {
      const sheet = await getRunSheet(e.id);
      if (!sheet) return null;
      return {
        id: e.id,
        date,
        quoteNumber: e.quoteNumber,
        clientName: e.clientName,
        clientPhone: sheet.clientPhone,
        contactPerson: sheet.contactPerson,
        recipientPhone: sheet.recipientPhone,
        recipientRole: sheet.recipientRole,
        onsiteContact: sheet.onsiteContact,
        eventType: e.eventType,
        eventLocation: e.eventLocation?.trim() || null,
        teamArrivalTime: e.teamArrivalTime,
        guestCount: e.guestCount,
        adults: e.adults,
        children: e.children,
        steps: sheet.steps,
        team: sheet.team.map(({ name, role, phone, arrival, departure }) => ({ name, role, phone, arrival, departure })),
        dishes: e.plan.dishes.map((d) => ({ name: d.name, toProduce: d.toProduce, allergens: d.allergens.map((k) => ALLERGEN_LABELS[k]) })),
        otherLines: e.plan.unmatched,
        remarks: sheet.remarks,
        internalNotes: sheet.internalNotes,
      };
    }));
    return { date, label, events: events.filter((e): e is DayViewEvent => e !== null) };
  }));

  return { accountId: user.id, companyName, generatedAt: now.toISOString(), days };
}
