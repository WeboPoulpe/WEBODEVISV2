'use server';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { ingredients, prestations, profiles, quotes, service_ingredients } from '@/db/schema';
import { allergenSheet, type AllergenSheetRow } from '@/lib/allergens';
import { requireUser } from './session';

export interface QuoteAllergenSheet {
  companyName: string;
  quoteNumber: string | null;
  clientName: string;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  rows: AllergenSheetRow[];
  unmatched: string[];
}

/** Fiche allergènes d'un devis : ses plats rapprochés du catalogue et de leurs recettes. */
export async function getQuoteAllergenSheet(quoteId: string): Promise<QuoteAllergenSheet | null> {
  const user = await requireUser();
  const [q] = await db.select().from(quotes).where(and(
    eq(quotes.id, quoteId),
    sql`(${quotes.user_id} = ${user.id} or ${quotes.owner_user_id} = ${user.id} or ${quotes.owner_user_id} in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${user.id}::uuid)))`,
  )).limit(1);
  if (!q) return null;
  const owner = q.owner_user_id ?? q.user_id ?? user.id;

  const catalog = await db.select({ id: prestations.id, name: prestations.name, allergens_extra: prestations.allergens_extra, allergens_checked: prestations.allergens_checked })
    .from(prestations).where(eq(prestations.user_id, owner));
  const recipe = catalog.length === 0 ? [] : await db
    .select({ service_id: service_ingredients.service_id, name: ingredients.name, allergens: ingredients.allergens })
    .from(service_ingredients)
    .innerJoin(ingredients, eq(ingredients.id, service_ingredients.ingredient_id))
    .where(inArray(service_ingredients.service_id, catalog.map((p) => p.id)));

  const lines = (Array.isArray(q.services) ? q.services : []) as { name?: string; removed?: boolean; isPageBreak?: boolean }[];
  const sheet = allergenSheet(lines, catalog.map((p) => ({
    name: p.name, allergens_extra: p.allergens_extra, allergens_checked: p.allergens_checked,
    ingredients: recipe.filter((r) => r.service_id === p.id).map((r) => ({ name: r.name, allergens: r.allergens })),
  })));

  const [p] = await db.select({ company: profiles.company_name }).from(profiles).where(eq(profiles.id, owner)).limit(1);
  const person = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ');
  return {
    companyName: p?.company || 'Votre traiteur',
    quoteNumber: q.quote_number,
    clientName: (q.client_type === 'entreprise' ? q.company_name : person) || q.client_name,
    eventType: q.event_type,
    eventDate: q.event_date,
    guestCount: q.guest_count,
    ...sheet,
  };
}
