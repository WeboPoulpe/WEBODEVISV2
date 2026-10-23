import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, ingredient_stocks, profiles, prospect_requests, quotes, stock_movements, supplier_order_items, supplier_orders } from '@/db/schema';
import { createSupplierOrders } from '../events';
import { sendSupplierOrder } from '../supplierOrders';
import { defaultVatRate } from '@/lib/vat';
import { companyIdsOf } from '../companyScope';
import { quoteOfProspect } from './moreTools';

// Exécution des propositions « du reste du logiciel » (clients, prospects, stock, commandes, brochures, factures),
// une fois validées par le traiteur. Tout est revérifié ici, dans l'entreprise.

export interface MoreResult { href: string; label: string }
type User = { id: string };

const todayFr = () => new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

async function upsertCustomer(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const v = (k: string) => (p[k] == null ? null : String(p[k]));
  const note = v('note');
  if (p.customerId) {
    const [c] = await db.select().from(customers).where(and(eq(customers.id, String(p.customerId)), sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
    if (!c) throw new Error('Client introuvable.');
    await db.update(customers).set({
      ...(v('firstName') ? { first_name: v('firstName') } : {}), ...(v('lastName') ? { last_name: v('lastName') } : {}),
      ...(v('companyName') ? { company_name: v('companyName') } : {}), ...(v('contactName') ? { contact_person_name: v('contactName') } : {}),
      ...(v('email') ? { email: v('email')! } : {}), ...(v('phone') ? { phone: v('phone') } : {}), ...(v('address') ? { address: v('address') } : {}),
      ...(v('siret') ? { siret_number: v('siret') } : {}),
      // Note ajoutée à la suite, datée : les notes existantes ne sont jamais écrasées.
      ...(note ? { notes: sql`concat_ws(chr(10), nullif(${customers.notes}, ''), ${`${todayFr()} : ${note}`}::text)` } : {}),
      updated_at: new Date().toISOString(),
    }).where(eq(customers.id, c.id));
    return { href: '/clients', label: 'Voir les clients' };
  }
  const [row] = await db.insert(customers).values({
    owner_user_id: user.id, user_id: user.id, customer_type: v('type') === 'entreprise' ? 'entreprise' : 'particulier',
    first_name: v('firstName'), last_name: v('lastName'), company_name: v('companyName'), contact_person_name: v('contactName'),
    email: v('email')!, phone: v('phone'), address: v('address'), siret_number: v('siret'), notes: note ? `${todayFr()} : ${note}` : null,
  }).returning({ id: customers.id });
  return { href: `/clients?id=${row.id}`, label: 'Voir le client' };
}

async function setProspectStatus(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const id = String(p.prospectId);
  const status = String(p.status);
  await db.transaction(async (tx) => {
    // Qui change le statut du devis lié : lu par le déclencheur d'historique.
    await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);
    const [row] = await tx.update(prospect_requests).set({ status, updated_at: new Date().toISOString() })
      .where(and(eq(prospect_requests.id, id), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(companyId)}`)).returning({ id: prospect_requests.id });
    if (!row) throw new Error('Demande introuvable.');
    await tx.update(quotes).set({ status }).where(and(eq(quotes.prospect_id, id), sql`${quotes.owner_user_id} in ${companyIdsOf(companyId)}`));
  });
  return { href: '/prospects', label: 'Voir les prospects' };
}

async function prospectToQuote(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const id = String(p.prospectId);
  const [pr] = await db.select().from(prospect_requests).where(and(eq(prospect_requests.id, id), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  if (!pr) throw new Error('Demande introuvable.');
  if (await quoteOfProspect(companyId, id)) throw new Error('Cette demande a déjà son devis.');
  if (!pr.event_date) throw new Error('La demande n’a pas de date d’événement.');
  const email = pr.email.toLowerCase();
  let [c] = await db.select().from(customers).where(and(sql`lower(${customers.email}) = ${email}`, sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  if (!c) {
    [c] = await db.insert(customers).values({
      owner_user_id: user.id, user_id: user.id, customer_type: 'particulier', first_name: pr.first_name, last_name: pr.last_name, email, phone: pr.phone, address: pr.address,
    }).onConflictDoNothing().returning();
    if (!c) [c] = await db.select().from(customers).where(and(eq(customers.email, email), eq(customers.owner_user_id, user.id))).limit(1);
  }
  const [profile] = await db.select({ vat: profiles.default_vat_rate }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
  const [q] = await db.insert(quotes).values({
    owner_user_id: user.id, user_id: user.id, customer_id: c?.id ?? null, prospect_id: id,
    client_name: `${pr.first_name} ${pr.last_name}`, client_first_name: pr.first_name, client_last_name: pr.last_name, client_email: email, client_phone: pr.phone, client_address: pr.address,
    event_type: pr.event_type || 'Autre', event_date: pr.event_date, guest_count: Math.max(1, pr.guest_count ?? 1),
    ...(pr.guest_count_children ? { guest_count_children: pr.guest_count_children } : {}),
    event_location: pr.service_address, remarks: pr.message, status: 'devis_a_faire', template: 'classique',
    vat_rate: String(defaultVatRate(profile ? { default_vat_rate: profile.vat } : null)), services: [], total_amount: '0', hide_price: false, language: 'fr',
  }).returning({ id: quotes.id });
  await db.update(prospect_requests).set({ status: 'devis_a_faire', updated_at: new Date().toISOString() }).where(eq(prospect_requests.id, id));
  return { href: `/devis/${q.id}/modifier?mode=weboword`, label: 'Ouvrir le devis' };
}

type Move = { ingredientId: string; name: string; unit: string; type: 'in' | 'out' | 'adjust'; quantity: number; reason: string | null };

async function moveStock(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const moves = (p.moves ?? []) as Move[];
  await db.transaction(async (tx) => {
    // Le stock revérifié au moment d'écrire, lignes verrouillées : une sortie ne dépasse jamais ce qu'il y a.
    const ids = [...new Set(moves.map((m) => m.ingredientId))];
    const rows = await tx.select({ id: ingredient_stocks.ingredient_id, q: ingredient_stocks.quantity }).from(ingredient_stocks)
      .where(and(eq(ingredient_stocks.company_id, companyId), inArray(ingredient_stocks.ingredient_id, ids))).for('update');
    const left = new Map(rows.map((r) => [r.id, Number(r.q)]));
    for (const m of moves) {
      const have = left.get(m.ingredientId) ?? 0;
      if (m.type === 'out' && m.quantity > have) throw new Error(`Sortie impossible : il ne reste que ${have} ${m.unit} de « ${m.name} ».`);
      left.set(m.ingredientId, m.type === 'in' ? have + m.quantity : m.type === 'out' ? have - m.quantity : m.quantity);
    }
    await tx.insert(stock_movements).values(moves.map((m) => ({
      user_id: user.id, ingredient_id: m.ingredientId, movement_type: m.type, quantity: String(m.quantity), reason: m.reason ?? 'Webo',
    })));
  });
  return { href: '/stock', label: 'Voir le stock' };
}

async function createOrder(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const items = (p.items ?? []) as { ingredientId: string; quantity: number; unitPrice: number }[];
  const id = await db.transaction(async (tx) => {
    const [o] = await tx.insert(supplier_orders).values({
      user_id: user.id, supplier_id: String(p.supplierId), status: 'draft', total_amount: String(p.total ?? 0), notes: (p.notes as string | null) ?? null,
    }).returning({ id: supplier_orders.id });
    await tx.insert(supplier_order_items).values(items.map((x) => ({ order_id: o.id, ingredient_id: x.ingredientId, quantity: String(x.quantity), unit_price: String(x.unitPrice) })));
    return o.id;
  });
  return { href: `/commandes?id=${id}`, label: 'Voir la commande' };
}

async function receiveOrder(user: User, companyId: string, p: Record<string, unknown>): Promise<MoreResult> {
  const id = String(p.orderId);
  await db.transaction(async (tx) => {
    const [o] = await tx.select({ id: supplier_orders.id, status: supplier_orders.status }).from(supplier_orders)
      .where(and(eq(supplier_orders.id, id), sql`${supplier_orders.user_id} in ${companyIdsOf(companyId)}`)).for('update').limit(1);
    if (!o) throw new Error('Commande introuvable.');
    if (o.status === 'received' || o.status === 'cancelled') throw new Error('Cette commande est déjà reçue ou annulée.');
    const items = await tx.select().from(supplier_order_items).where(eq(supplier_order_items.order_id, id));
    if (items.length) {
      await tx.insert(stock_movements).values(items.map((x) => ({
        user_id: user.id, ingredient_id: x.ingredient_id, movement_type: 'in', quantity: String(x.quantity), reason: 'Commande reçue (Webo)', order_id: id,
      })));
    }
    await tx.update(supplier_orders).set({ status: 'received', received_at: new Date().toISOString(), updated_at: new Date().toISOString() }).where(eq(supplier_orders.id, id));
  });
  return { href: '/stock', label: 'Voir le stock' };
}

/** Exécute une proposition de ces modules ; null si la sorte n'en fait pas partie. */
export async function executeMore(kind: string, p: Record<string, unknown>, user: User, companyId: string): Promise<MoreResult | null> {
  switch (kind) {
    case 'customer_upsert': return upsertCustomer(user, companyId, p);
    case 'prospect_status': return setProspectStatus(user, companyId, p);
    case 'prospect_to_quote': return prospectToQuote(user, companyId, p);
    case 'stock_movement': return moveStock(user, companyId, p);
    case 'supplier_order': return createOrder(user, companyId, p);
    case 'supplier_order_receive': return receiveOrder(user, companyId, p);
    case 'supplier_order_send': {
      const r = await sendSupplierOrder({ orderId: String(p.orderId), to: String(p.to), message: String(p.message), deliveryDate: (p.deliveryDate as string | null) ?? null });
      if (r.error) throw new Error(r.error);
      return { href: '/commandes', label: 'Voir les commandes' };
    }
    case 'event_orders': {
      const r = await createSupplierOrders(String(p.quoteId));
      if (r.error) throw new Error(r.error);
      return { href: '/commandes', label: `Voir les commandes (${r.created} créée${r.created > 1 ? 's' : ''})` };
    }
    default: return null;
  }
}
