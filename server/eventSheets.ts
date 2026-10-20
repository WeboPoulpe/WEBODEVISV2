'use server';

import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  event_extras, extras, ingredients, prestations, profiles, quotes, rental_items, service_ingredients, suppliers,
} from '@/db/schema';
import { CONFIRMED_STATUSES } from '@/lib/quoteStatus';
import { cleanRunSheet, productionPlan, type ProductionPlan, type ProductionRecipe, type RunSheetStep } from '@/lib/production';
import { requireUser } from './session';

// Documents imprimables de la fiche événement : fiche de production cuisine, production du jour
// et feuille de route. Lecture seule ; chaque fonction vérifie que le devis appartient au compte
// connecté ou à son entreprise (même règle que la fiche allergènes).

const companyAccess = (uid: string) =>
  sql`(${quotes.user_id} = ${uid} or ${quotes.owner_user_id} = ${uid} or ${quotes.owner_user_id} in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`;

// Colonnes lues explicitement : run_sheet et onsite_contact (migration 0023) sont lues à part,
// pour que les fiches restent disponibles sur une base qui n'a pas encore ces colonnes.
const EVENT_COLUMNS = {
  id: quotes.id,
  owner_user_id: quotes.owner_user_id,
  user_id: quotes.user_id,
  quote_number: quotes.quote_number,
  status: quotes.status,
  client_name: quotes.client_name,
  client_type: quotes.client_type,
  client_first_name: quotes.client_first_name,
  client_last_name: quotes.client_last_name,
  company_name: quotes.company_name,
  contact_person_name: quotes.contact_person_name,
  client_phone: quotes.client_phone,
  client_email: quotes.client_email,
  recipient_contact_phone: quotes.recipient_contact_phone,
  recipient_contact_email: quotes.recipient_contact_email,
  recipient_contact_role: quotes.recipient_contact_role,
  event_type: quotes.event_type,
  event_date: quotes.event_date,
  event_location: quotes.event_location,
  team_arrival_time: quotes.team_arrival_time,
  guest_count: quotes.guest_count,
  guest_count_adults: quotes.guest_count_adults,
  guest_count_children: quotes.guest_count_children,
  services: quotes.services,
  event_materials: quotes.event_materials,
  remarks: quotes.remarks,
  internal_notes: quotes.internal_notes,
};

type EventRow = { [K in keyof typeof EVENT_COLUMNS]: (typeof EVENT_COLUMNS)[K]['_']['data'] | null };

export interface EventHeading {
  id: string;
  companyName: string;
  quoteNumber: string | null;
  clientName: string;
  eventType: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  teamArrivalTime: string | null;
  guestCount: number;
  adults: number | null;
  children: number | null;
}

export interface EventProduction extends EventHeading {
  plan: ProductionPlan;
}

const clientNameOf = (q: EventRow) => {
  const person = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ');
  return (q.client_type === 'entreprise' ? q.company_name : person) || q.client_name || 'Client';
};

async function companyNameOf(owner: string) {
  const [p] = await db.select({ company: profiles.company_name }).from(profiles).where(eq(profiles.id, owner)).limit(1);
  return p?.company || 'Votre traiteur';
}

function heading(q: EventRow, companyName: string): EventHeading {
  return {
    id: q.id!,
    companyName,
    quoteNumber: q.quote_number,
    clientName: clientNameOf(q),
    eventType: q.event_type,
    eventDate: q.event_date,
    eventLocation: q.event_location,
    teamArrivalTime: q.team_arrival_time,
    guestCount: q.guest_count ?? 0,
    adults: q.guest_count_adults,
    children: q.guest_count_children,
  };
}

/** Catalogue et recettes d'un compte, avec les noms et allergènes des ingrédients. */
async function loadRecipes(owner: string): Promise<ProductionRecipe[]> {
  const catalog = await db
    .select({ id: prestations.id, name: prestations.name, allergens_extra: prestations.allergens_extra, allergens_checked: prestations.allergens_checked })
    .from(prestations).where(eq(prestations.user_id, owner));
  if (catalog.length === 0) return [];
  const links = await db
    .select({
      service_id: service_ingredients.service_id,
      ingredient_id: service_ingredients.ingredient_id,
      qty_per_person: service_ingredients.qty_per_person,
      unit: service_ingredients.unit,
      ingredient_unit: ingredients.unit,
      name: ingredients.name,
      allergens: ingredients.allergens,
    })
    .from(service_ingredients)
    .innerJoin(ingredients, eq(ingredients.id, service_ingredients.ingredient_id))
    .where(inArray(service_ingredients.service_id, catalog.map((p) => p.id)));
  return catalog.map((p) => ({
    ...p,
    ingredients: links.filter((l) => l.service_id === p.id).map((l) => ({
      ingredient_id: l.ingredient_id,
      name: l.name,
      qty_per_person: Number(l.qty_per_person) || 0,
      unit: l.unit || l.ingredient_unit,
      allergens: l.allergens,
    })),
  }));
}

const ownerOf = (q: EventRow, uid: string) => q.owner_user_id ?? q.user_id ?? uid;
const linesOf = (q: EventRow) => (Array.isArray(q.services) ? q.services : []) as { name?: string; quantity?: number; removed?: boolean; isPageBreak?: boolean }[];

async function loadEvent(uid: string, quoteId: string): Promise<EventRow | null> {
  const [q] = await db.select(EVENT_COLUMNS).from(quotes).where(and(eq(quotes.id, quoteId), companyAccess(uid))).limit(1);
  return (q as EventRow | undefined) ?? null;
}

/** Fiche de production d'un événement : plats à produire, ingrédients par plat et récapitulatif. */
export async function getProductionSheet(quoteId: string): Promise<EventProduction | null> {
  const user = await requireUser();
  const q = await loadEvent(user.id, quoteId);
  if (!q) return null;
  const owner = ownerOf(q, user.id);
  const [recipes, companyName] = await Promise.all([loadRecipes(owner), companyNameOf(owner)]);
  return { ...heading(q, companyName), plan: productionPlan(linesOf(q), recipes, q.guest_count ?? 0) };
}

export interface DayProduction {
  date: string;
  companyName: string;
  events: EventProduction[];
}

/** Production du jour : tous les événements confirmés d'une date (AAAA-MM-JJ), visibles par le compte. */
export async function getDayProduction(date: string): Promise<DayProduction | null> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return null;
  const rows = (await db.select(EVENT_COLUMNS).from(quotes)
    .where(and(eq(quotes.event_date, date), inArray(quotes.status, CONFIRMED_STATUSES), companyAccess(user.id)))
    .orderBy(asc(quotes.team_arrival_time), asc(quotes.created_at))) as EventRow[];

  const recipesByOwner = new Map<string, Promise<ProductionRecipe[]>>();
  const recipesFor = (owner: string) => {
    if (!recipesByOwner.has(owner)) recipesByOwner.set(owner, loadRecipes(owner));
    return recipesByOwner.get(owner)!;
  };
  const companyName = await companyNameOf(rows[0] ? ownerOf(rows[0], user.id) : user.id);
  const events = await Promise.all(rows.map(async (q) => ({
    ...heading(q, companyName),
    plan: productionPlan(linesOf(q), await recipesFor(ownerOf(q, user.id)), q.guest_count ?? 0),
  })));
  return { date, companyName, events };
}

// ── Feuille de route ────────────────────────────────────────────────────────

export interface RunSheetTeamMember {
  name: string;
  role: string | null;
  phone: string | null;
  arrival: string | null;
  departure: string | null;
  status: string;
}

export interface RunSheetMaterial {
  name: string;
  qty: number;
  unit: string | null;
  supplier: string | null;
}

export interface EventRunSheet extends EventHeading {
  contactPerson: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientRole: string | null;
  /** null : la colonne n'existe pas encore sur cette base (migration 0023 non appliquée). */
  onsiteContact: string | null;
  steps: RunSheetStep[];
  team: RunSheetTeamMember[];
  materials: RunSheetMaterial[];
  rentals: RunSheetMaterial[];
  remarks: string | null;
  internalNotes: string | null;
}

/** Feuille de route d'un événement : contacts, lieu, horaires, déroulé, équipe et matériel à emporter. */
export async function getRunSheet(quoteId: string): Promise<EventRunSheet | null> {
  const user = await requireUser();
  const q = await loadEvent(user.id, quoteId);
  if (!q) return null;
  const owner = ownerOf(q, user.id);

  // Déroulé et contact sur place : absents tant que la migration 0023 n'est pas appliquée.
  let steps: RunSheetStep[] = [];
  let onsiteContact: string | null = null;
  try {
    const [r] = await db.select({ run_sheet: quotes.run_sheet, onsite_contact: quotes.onsite_contact }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    steps = cleanRunSheet(r?.run_sheet);
    onsiteContact = r?.onsite_contact?.trim() || null;
  } catch {
    steps = [];
  }

  const [companyName, team, rentals] = await Promise.all([
    companyNameOf(owner),
    db.select({
      name: extras.name, role: extras.role, phone: extras.phone,
      arrival: event_extras.arrival_time, departure: event_extras.departure_time, status: event_extras.status,
    })
      .from(event_extras)
      .innerJoin(extras, eq(extras.id, event_extras.extra_id))
      .where(and(eq(event_extras.quote_id, quoteId), ne(event_extras.status, 'refuse')))
      .orderBy(asc(event_extras.arrival_time), asc(extras.name)),
    db.select({ name: rental_items.material_name, qty: rental_items.qty, unit: rental_items.unit, supplier: suppliers.name })
      .from(rental_items)
      .leftJoin(suppliers, eq(suppliers.id, rental_items.supplier_id))
      .where(eq(rental_items.quote_id, quoteId))
      .orderBy(asc(rental_items.material_name)),
  ]);

  const materials = (Array.isArray(q.event_materials) ? q.event_materials : [])
    .filter((m): m is { name: string; qty?: number; unit?: string } => !!m && typeof m === 'object' && typeof (m as { name?: unknown }).name === 'string' && !!(m as { name: string }).name.trim())
    .map((m) => ({ name: m.name.trim(), qty: Number(m.qty) || 1, unit: m.unit?.trim() || null, supplier: null }));

  return {
    ...heading(q, companyName),
    contactPerson: q.contact_person_name?.trim() || null,
    clientPhone: q.client_phone?.trim() || null,
    clientEmail: q.client_email?.trim() || null,
    recipientPhone: q.recipient_contact_phone?.trim() || null,
    recipientEmail: q.recipient_contact_email?.trim() || null,
    recipientRole: q.recipient_contact_role?.trim() || null,
    onsiteContact,
    steps,
    team,
    materials,
    rentals: rentals.map((r) => ({ name: r.name, qty: Number(r.qty) || 1, unit: r.unit, supplier: r.supplier })),
    remarks: q.remarks?.trim() || null,
    internalNotes: q.internal_notes?.trim() || null,
  };
}
