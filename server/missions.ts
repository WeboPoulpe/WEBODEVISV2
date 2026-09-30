'use server';

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { event_extras, event_ingredients, extras, ingredients, quotes, suppliers } from '@/db/schema';
import { isDemoUser } from '@/lib/demo';

// Liste de courses d'une mission, pour un extra qui n'a pas de compte : le lien personnel de l'extra
// (son jeton) est la seule clé, et il n'ouvre que les événements où les courses lui ont été confiées.

export interface MissionCourses {
  extraName: string;
  event: { client_name: string; event_type: string; event_date: string; guest_count: number };
  lines: { id: string; name: string; quantity: number; unit: string | null; supplier: string | null; notes: string | null; checked: boolean }[];
}

/** L'événement, si les courses en ont été confiées à l'extra qui détient ce lien. */
async function entrustedQuote(token: string, quoteId: string) {
  if (!/^[a-f0-9]{16,64}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(quoteId)) return null;
  const [row] = await db
    .select({
      extraName: extras.name, owner: quotes.owner_user_id,
      client_name: quotes.client_name, event_type: quotes.event_type, event_date: quotes.event_date, guest_count: quotes.guest_count,
    })
    .from(event_extras)
    .innerJoin(extras, eq(extras.id, event_extras.extra_id))
    .innerJoin(quotes, eq(quotes.id, event_extras.quote_id))
    .where(and(eq(extras.access_token, token), eq(event_extras.quote_id, quoteId), eq(event_extras.assign_courses, true)))
    .limit(1);
  return row ?? null;
}

export async function getMissionCourses(token: string, quoteId: string): Promise<MissionCourses | null> {
  const quote = await entrustedQuote(token, quoteId);
  if (!quote) return null;
  const rows = await db
    .select({
      id: event_ingredients.id, name: ingredients.name, quantity: event_ingredients.quantity, unit: event_ingredients.unit,
      defaultUnit: ingredients.unit, supplier: suppliers.name, notes: event_ingredients.notes, checked: event_ingredients.checked,
    })
    .from(event_ingredients)
    .innerJoin(ingredients, eq(ingredients.id, event_ingredients.ingredient_id))
    .leftJoin(suppliers, eq(suppliers.id, event_ingredients.supplier_id))
    .where(eq(event_ingredients.quote_id, quoteId))
    .orderBy(asc(suppliers.name), asc(ingredients.name));
  return {
    extraName: quote.extraName,
    event: { client_name: quote.client_name, event_type: quote.event_type, event_date: quote.event_date, guest_count: quote.guest_count },
    lines: rows.map((r) => ({
      id: r.id, name: r.name, quantity: Number(r.quantity), unit: r.unit ?? r.defaultUnit, supplier: r.supplier, notes: r.notes, checked: r.checked,
    })),
  };
}

/** Coche ou décoche un article pris. */
export async function setMissionCourseChecked(token: string, quoteId: string, lineId: string, checked: boolean): Promise<{ error: string | null }> {
  const quote = await entrustedQuote(token, quoteId);
  if (!quote) return { error: 'Ce lien ne donne plus accès à cette liste.' };
  // Compte de démonstration : rien n'est enregistré.
  if (isDemoUser(quote.owner)) return { error: null };
  await db.update(event_ingredients).set({ checked: !!checked })
    .where(and(eq(event_ingredients.id, lineId), eq(event_ingredients.quote_id, quoteId)));
  return { error: null };
}
