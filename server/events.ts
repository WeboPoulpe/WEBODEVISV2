'use server';

import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  event_ingredients, ingredients, prestations, quotes, service_ingredients, supplier_order_items, supplier_orders,
} from '@/db/schema';
import { computeIngredientNeeds, groupNeedsBySupplier, type PrestationRecipe, type QuoteLine } from '@/lib/events/needs';
import { requireUser } from './session';

// Opérations en plusieurs étapes de la fiche événement. Chacune vérifie que le devis
// appartient à l'utilisateur connecté, puis écrit dans une seule transaction.

const AUTO_ORDER_NOTE = 'Commande générée depuis la liste de courses';

async function loadOwnedQuote(uid: string, quoteId: string) {
  const [quote] = await db
    .select({ id: quotes.id, services: quotes.services, guest_count: quotes.guest_count })
    .from(quotes)
    .where(and(
      eq(quotes.id, quoteId),
      sql`(${quotes.user_id} = ${uid} or ${quotes.owner_user_id} = ${uid} or ${quotes.owner_user_id} in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`,
    ))
    .limit(1);
  return quote ?? null;
}

export interface RecalculateResult {
  error: string | null;
  /** Nombre de lignes calculées. */
  lines: number;
  /** Lignes du devis sans prestation correspondante dans le catalogue. */
  unmatched: string[];
  /** Prestations du devis qui n'ont aucun ingrédient renseigné. */
  withoutIngredients: string[];
}

/**
 * Recalcule les courses d'un événement à partir des prestations du devis.
 * Seules les lignes calculées ('auto') sont remplacées : les lignes ajoutées à la main sont conservées,
 * et une ligne déjà cochée ou réaffectée à un fournisseur garde son état.
 */
export async function recalculateCourses(quoteId: string): Promise<RecalculateResult> {
  const user = await requireUser();
  const quote = await loadOwnedQuote(user.id, quoteId);
  const empty = { lines: 0, unmatched: [], withoutIngredients: [] };
  if (!quote) return { error: 'Événement introuvable.', ...empty };

  const lines = (Array.isArray(quote.services) ? quote.services : []) as QuoteLine[];
  const catalog = await db.select({ id: prestations.id, name: prestations.name }).from(prestations).where(eq(prestations.user_id, user.id));
  const links = catalog.length === 0 ? [] : await db
    .select({
      service_id: service_ingredients.service_id,
      ingredient_id: service_ingredients.ingredient_id,
      qty_per_person: service_ingredients.qty_per_person,
      unit: service_ingredients.unit,
      ingredient_unit: ingredients.unit,
      preferred_supplier_id: ingredients.preferred_supplier_id,
      volume_unit_price: ingredients.volume_unit_price,
    })
    .from(service_ingredients)
    .innerJoin(ingredients, eq(ingredients.id, service_ingredients.ingredient_id))
    .where(inArray(service_ingredients.service_id, catalog.map((p) => p.id)));

  const recipes: PrestationRecipe[] = catalog.map((p) => ({
    id: p.id,
    name: p.name,
    ingredients: links.filter((l) => l.service_id === p.id).map((l) => ({
      ingredient_id: l.ingredient_id,
      qty_per_person: Number(l.qty_per_person),
      unit: l.unit ?? l.ingredient_unit,
      preferred_supplier_id: l.preferred_supplier_id,
      unit_price: Number(l.volume_unit_price ?? 0),
    })),
  }));

  const { needs, unmatched, withoutIngredients } = computeIngredientNeeds(lines, recipes, quote.guest_count ?? 0);
  // Rien à calculer : on ne touche pas à la liste existante.
  if (needs.length === 0) return { error: null, lines: 0, unmatched, withoutIngredients };

  await db.transaction(async (tx) => {
    const previous = await tx
      .select({ ingredient_id: event_ingredients.ingredient_id, checked: event_ingredients.checked, supplier_id: event_ingredients.supplier_id })
      .from(event_ingredients)
      .where(and(eq(event_ingredients.quote_id, quoteId), eq(event_ingredients.source, 'auto')));
    const before = new Map(previous.map((p) => [p.ingredient_id, p]));

    await tx.delete(event_ingredients).where(and(eq(event_ingredients.quote_id, quoteId), eq(event_ingredients.source, 'auto')));
    await tx.insert(event_ingredients).values(needs.map((n) => ({
      quote_id: quoteId,
      ingredient_id: n.ingredient_id,
      quantity: String(n.quantity),
      unit: n.unit,
      supplier_id: before.get(n.ingredient_id)?.supplier_id ?? n.supplier_id,
      checked: before.get(n.ingredient_id)?.checked ?? false,
      source: 'auto',
    })));
  });

  return { error: null, lines: needs.length, unmatched, withoutIngredients };
}

export interface CreateOrdersResult {
  error: string | null;
  created: number;
  /** Nombre d'ingrédients sans fournisseur, donc absents des commandes. */
  withoutSupplier: number;
}

/**
 * Crée une commande en brouillon par fournisseur à partir de la liste de courses.
 * Relancer l'opération remplace les brouillons déjà générés pour cet événement au lieu d'en ajouter ;
 * les commandes envoyées ou reçues ne sont jamais touchées.
 */
export async function createSupplierOrders(quoteId: string): Promise<CreateOrdersResult> {
  const user = await requireUser();
  const quote = await loadOwnedQuote(user.id, quoteId);
  if (!quote) return { error: 'Événement introuvable.', created: 0, withoutSupplier: 0 };

  const rows = await db
    .select({
      ingredient_id: event_ingredients.ingredient_id,
      quantity: event_ingredients.quantity,
      supplier_id: event_ingredients.supplier_id,
      volume_unit_price: ingredients.volume_unit_price,
    })
    .from(event_ingredients)
    .innerJoin(ingredients, eq(ingredients.id, event_ingredients.ingredient_id))
    .where(eq(event_ingredients.quote_id, quoteId));
  if (rows.length === 0) return { error: 'La liste de courses est vide.', created: 0, withoutSupplier: 0 };

  const { orders, withoutSupplier } = groupNeedsBySupplier(rows.map((r) => ({
    ingredient_id: r.ingredient_id,
    quantity: Number(r.quantity),
    supplier_id: r.supplier_id,
    unit_price: Number(r.volume_unit_price ?? 0),
  })));
  if (orders.length === 0) {
    return { error: 'Aucun ingrédient n’a de fournisseur : attribuez-en un avant de créer les commandes.', created: 0, withoutSupplier: withoutSupplier.length };
  }

  await db.transaction(async (tx) => {
    await tx.delete(supplier_orders).where(and(
      eq(supplier_orders.user_id, user.id),
      eq(supplier_orders.event_id, quoteId),
      eq(supplier_orders.status, 'draft'),
      like(supplier_orders.notes, `${AUTO_ORDER_NOTE}%`),
    ));
    for (const order of orders) {
      const [created] = await tx.insert(supplier_orders).values({
        user_id: user.id,
        supplier_id: order.supplier_id,
        event_id: quoteId,
        status: 'draft',
        total_amount: String(order.total),
        notes: `${AUTO_ORDER_NOTE} (${quote.guest_count ?? 0} couverts)`,
      }).returning({ id: supplier_orders.id });
      await tx.insert(supplier_order_items).values(order.items.map((item) => ({
        order_id: created.id,
        ingredient_id: item.ingredient_id,
        quantity: String(item.quantity),
        unit_price: String(item.unit_price),
      })));
    }
  });

  return { error: null, created: orders.length, withoutSupplier: withoutSupplier.length };
}
