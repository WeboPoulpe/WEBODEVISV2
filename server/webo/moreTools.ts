import 'server-only';
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { brochures, customer_invoice_payments, customer_invoices, customers, ingredient_stocks, ingredients, prospect_requests, quotes, supplier_order_items, supplier_orders, suppliers } from '@/db/schema';
import { PAYMENT_METHODS } from '@/lib/invoices';
import { companyIdsOf } from '../companyScope';
import { eur, fail, isUuid, like, nullableStr, propose, str, tool, type AgentName, type Handler, type ToolContext } from './toolKit';

// Outils de Webo pour le reste du logiciel : clients et prospects, stock et commandes fournisseurs, factures émises
// et paiements, brochures. Même règle : lire, ou proposer (une carte que le traiteur valide).

export const PROSPECT_STATUSES = ['nouveau', 'broch_envoyee', 'devis_a_faire', 'devis_envoye', 'rdv_deg_a_venir', 'rdv_deg_fait', 'devis_final', 'valide', 'acompte', 'paye', 'refus_client', 'refus_traiteur'] as const;
const STATUS_LABEL: Record<string, string> = {
  nouveau: 'Nouveau', broch_envoyee: 'Brochure envoyée', devis_a_faire: 'Devis à faire', devis_envoye: 'Devis envoyé',
  rdv_deg_a_venir: 'Dégustation à venir', rdv_deg_fait: 'Dégustation faite', devis_final: 'Devis final', valide: 'Validé',
  acompte: 'Acompte reçu', paye: 'Payé', refus_client: 'Refus du client', refus_traiteur: 'Refus du traiteur',
};
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export const MORE_TOOLS: Record<string, Anthropic.Tool> = {
  get_customer: tool('get_customer', 'Fiche d’un client : coordonnées, notes, ses devis.', { customer_id: { type: 'string' } }),
  propose_customer: tool('propose_customer', 'Propose de créer un client (customer_id null) ou de modifier une fiche (customer_id). Champs null = inchangés (à la création : particulier = prénom et nom ; entreprise = raison sociale et contact ; email obligatoire). `note` s’ajoute à la suite des notes.', {
    customer_id: nullableStr,
    type: { anyOf: [{ type: 'string', enum: ['particulier', 'entreprise'] }, { type: 'null' }] },
    first_name: nullableStr, last_name: nullableStr, company_name: nullableStr, contact_person_name: nullableStr,
    email: nullableStr, phone: nullableStr, address: nullableStr, siret: nullableStr, note: nullableStr,
  }),
  propose_prospect_status: tool('propose_prospect_status', `Propose de changer le statut d’un prospect (et de son devis s’il en a un). Statuts : ${PROSPECT_STATUSES.join(', ')}.`, {
    prospect_id: { type: 'string' }, status: { type: 'string', enum: [...PROSPECT_STATUSES] },
  }),
  stock_levels: tool('stock_levels', 'Niveaux de stock (ingrédients de l’entreprise et du catalogue commun) ; low_only : seulement ce qui est sous le seuil d’alerte.', {
    query: nullableStr, low_only: { type: 'boolean' },
  }),
  propose_stock_movement: tool('propose_stock_movement', 'Propose des mouvements de stock : in (entrée), out (sortie, jamais plus que le stock), adjust (inventaire : la quantité devient celle indiquée).', {
    movements: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ingredient_id: { type: 'string' }, type: { type: 'string', enum: ['in', 'out', 'adjust'] }, quantity: { type: 'number' }, reason: nullableStr },
        required: ['ingredient_id', 'type', 'quantity', 'reason'], additionalProperties: false,
      },
    },
  }),
  list_suppliers: tool('list_suppliers', 'Fournisseurs de l’entreprise.', { query: nullableStr }),
  list_supplier_orders: tool('list_supplier_orders', 'Commandes fournisseurs récentes (statut : draft, sent, received, cancelled ; null = toutes).', {
    status: { anyOf: [{ type: 'string', enum: ['draft', 'sent', 'received', 'cancelled'] }, { type: 'null' }] },
  }),
  propose_supplier_order: tool('propose_supplier_order', 'Propose une commande fournisseur en brouillon (ingrédients et quantités ; prix d’achat du catalogue).', {
    supplier_id: { type: 'string' },
    items: {
      type: 'array',
      items: { type: 'object', properties: { ingredient_id: { type: 'string' }, quantity: { type: 'number' } }, required: ['ingredient_id', 'quantity'], additionalProperties: false },
    },
    notes: nullableStr,
  }),
  propose_supplier_order_send: tool('propose_supplier_order_send', 'Propose d’envoyer une commande au fournisseur par email (to null = l’email du fournisseur), avec un message et une date de livraison souhaitée (AAAA-MM-JJ, facultative).', {
    order_id: { type: 'string' }, to: nullableStr, message: { type: 'string' }, delivery_date: nullableStr,
  }),
  propose_supplier_order_receive: tool('propose_supplier_order_receive', 'Propose de marquer une commande comme reçue : ses quantités entrent en stock.', { order_id: { type: 'string' } }),
  propose_event_orders: tool('propose_event_orders', 'Propose de créer les commandes fournisseurs (brouillons) depuis la liste de courses d’un événement, une par fournisseur.', { quote_id: { type: 'string' } }),
  list_invoices: tool('list_invoices', 'Factures de l’entreprise (d’un devis si quote_id ; statut : brouillon, emise, payee_partiellement, payee, annulee), avec le montant restant à payer.', {
    quote_id: nullableStr, status: { anyOf: [{ type: 'string', enum: ['brouillon', 'emise', 'payee_partiellement', 'payee', 'annulee'] }, { type: 'null' }] },
  }),
  propose_invoice_issue: tool('propose_invoice_issue', 'Propose d’émettre une facture en brouillon : elle reçoit son numéro et devient définitive (seul un avoir peut l’annuler).', {
    invoice_id: { type: 'string' },
  }),
  propose_invoice_payment: tool('propose_invoice_payment', 'Propose d’enregistrer un paiement reçu sur une facture émise.', {
    invoice_id: { type: 'string' }, amount: { type: 'number' }, paid_on: { type: 'string', description: 'AAAA-MM-JJ' },
    method: { type: 'string', enum: ['virement', 'cheque', 'especes', 'carte', 'autre'] }, note: nullableStr,
  }),
  list_brochures: tool('list_brochures', 'Brochures de l’entreprise (actives ou non).', {}),
  propose_brochure_send: tool('propose_brochure_send', 'Propose d’envoyer une brochure (active) par email, avec un message ; prospect_id si c’est pour un prospect (il passe « brochure envoyée »).', {
    brochure_id: { type: 'string' }, to: { type: 'string' }, message: nullableStr, prospect_id: nullableStr,
  }),
  propose_prospect_to_quote: tool('propose_prospect_to_quote', 'Propose de transformer la demande d’un prospect en devis (client retrouvé par email ou créé, devis « à faire » avec l’événement de la demande).', {
    prospect_id: { type: 'string' },
  }),
};

export const MORE_BY_AGENT: Partial<Record<AgentName, string[]>> = {
  stock: ['stock_levels', 'propose_stock_movement', 'list_suppliers', 'list_supplier_orders', 'propose_supplier_order', 'propose_supplier_order_send', 'propose_supplier_order_receive', 'propose_event_orders', 'list_events', 'propose_memory'],
  factures: ['list_invoices', 'propose_invoice_issue', 'propose_invoice_payment'],
  prospects: ['list_brochures', 'propose_brochure_send', 'propose_prospect_status', 'propose_prospect_to_quote'],
  clients: ['search_customers', 'get_customer', 'propose_customer', 'list_prospects', 'propose_prospect_status', 'propose_prospect_to_quote', 'propose_memory'],
};

const inCompany = (ctx: ToolContext) => sql`${customers.owner_user_id} in ${companyIdsOf(ctx.companyId)}`;

async function customerOf(ctx: ToolContext, id: unknown) {
  if (!isUuid(id)) fail('Client introuvable.');
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id as string), inCompany(ctx))).limit(1);
  return c ?? fail('Client introuvable.');
}

async function prospectOf(ctx: ToolContext, id: unknown) {
  if (!isUuid(id)) fail('Demande introuvable.');
  const [p] = await db.select().from(prospect_requests).where(and(eq(prospect_requests.id, id as string), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).limit(1);
  return p ?? fail('Demande introuvable.');
}

/** Un autre client de l'entreprise avec cet email ou ce SIRET (message prêt à montrer), ou null. */
export async function customerDuplicate(companyId: string, email: string | null, siret: string | null, exceptId: string | null): Promise<string | null> {
  const scope = sql`${customers.owner_user_id} in ${companyIdsOf(companyId)}`;
  if (email) {
    const [d] = await db.select({ id: customers.id }).from(customers).where(and(sql`lower(${customers.email}) = ${email.toLowerCase()}`, scope)).limit(2);
    if (d && d.id !== exceptId) return 'Un client avec cet email existe déjà : modifiez sa fiche plutôt que d’en créer une.';
  }
  if (siret) {
    const [d] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.siret_number, siret), scope)).limit(2);
    if (d && d.id !== exceptId) return 'Un client avec ce SIRET existe déjà.';
  }
  return null;
}

const CONFIRMED = ['valide', 'acompte', 'paye'];
/** Refus si le changement de statut ferait redescendre un devis confirmé (son événement disparaîtrait). */
export async function prospectStatusProblem(companyId: string, prospectId: string, status: string): Promise<string | null> {
  const [q] = await db.select({ status: quotes.status }).from(quotes).where(and(eq(quotes.prospect_id, prospectId), sql`${quotes.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  if (q && CONFIRMED.includes(q.status) && !CONFIRMED.includes(status)) return 'Son devis est confirmé (validé, acompte ou payé) : changez son statut depuis le devis, pas depuis le prospect.';
  return null;
}

/** Ce qui reste à payer sur une facture (TTC moins les paiements enregistrés). */
export async function invoiceRemaining(invoiceId: string): Promise<number> {
  const [r] = await db.select({
    total: customer_invoices.total_ttc,
    paid: sql<number>`coalesce((select sum(p.amount) from ${customer_invoice_payments} p where p.invoice_id = "customer_invoices"."id"), 0)`,
  }).from(customer_invoices).where(eq(customer_invoices.id, invoiceId)).limit(1);
  return r ? Math.round((Number(r.total) - Number(r.paid)) * 100) / 100 : 0;
}

/** Le devis déjà fait pour un prospect (dans l'entreprise), s'il existe. */
export async function quoteOfProspect(companyId: string, prospectId: string) {
  const [q] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.prospect_id, prospectId), sql`${quotes.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  return q ?? null;
}


/** Ingrédients visibles par l'entreprise : les siens et ceux du catalogue commun. */
const visibleIngredient = (ctx: ToolContext) => sql`(${ingredients.user_id} is null or ${ingredients.user_id} in ${companyIdsOf(ctx.companyId)})`;

export async function stockOf(companyId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: ingredient_stocks.ingredient_id, q: ingredient_stocks.quantity }).from(ingredient_stocks)
    .where(and(eq(ingredient_stocks.company_id, companyId), inArray(ingredient_stocks.ingredient_id, ids)));
  return new Map(rows.map((r) => [r.id, Number(r.q)]));
}

const orderScope = (ctx: ToolContext) => sql`${supplier_orders.user_id} in ${companyIdsOf(ctx.companyId)}`;
async function orderOf(ctx: ToolContext, id: unknown) {
  if (!isUuid(id)) fail('Commande introuvable.');
  const [o] = await db.select({ id: supplier_orders.id, status: supplier_orders.status, supplierId: supplier_orders.supplier_id, supplier: suppliers.name, email: suppliers.email, total: supplier_orders.total_amount })
    .from(supplier_orders).innerJoin(suppliers, eq(suppliers.id, supplier_orders.supplier_id))
    .where(and(eq(supplier_orders.id, id as string), orderScope(ctx))).limit(1);
  return o ?? fail('Commande introuvable.');
}

const MOVE_LABEL: Record<string, string> = { in: 'Entrée', out: 'Sortie', adjust: 'Inventaire' };

const INVOICE_KIND: Record<string, string> = { acompte: 'Acompte', solde: 'Solde', facture: 'Facture', avoir: 'Avoir' };
async function invoiceOf(ctx: ToolContext, id: unknown) {
  if (!isUuid(id)) fail('Facture introuvable.');
  const [inv] = await db.select().from(customer_invoices).where(and(eq(customer_invoices.id, id as string), eq(customer_invoices.owner_user_id, ctx.companyId))).limit(1);
  return inv ?? fail('Facture introuvable.');
}
const buyerName = (b: unknown) => (b && typeof b === 'object' && 'name' in b ? String((b as { name: unknown }).name ?? '') : '');

export const MORE_HANDLERS: Record<string, Handler> = {
  async get_customer(ctx, i) {
    const c = await customerOf(ctx, i.customer_id);
    const qs = await db.select({ id: quotes.id, number: quotes.quote_number, date: quotes.event_date, type: quotes.event_type, status: quotes.status, total: quotes.total_amount })
      .from(quotes).where(and(eq(quotes.customer_id, c.id), sql`${quotes.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).orderBy(desc(quotes.event_date)).limit(10);
    return {
      id: c.id, type: c.customer_type, first_name: c.first_name, last_name: c.last_name, company_name: c.company_name, contact: c.contact_person_name,
      email: c.email, phone: c.phone, address: c.address, siret: c.siret_number, notes: c.notes, quotes: qs,
    };
  },

  async propose_customer(ctx, i) {
    const val = (k: string, max = 200) => (i[k] == null ? null : str(i[k], max) || null);
    const fields = {
      type: i.type === 'entreprise' || i.type === 'particulier' ? i.type : null,
      firstName: val('first_name', 80), lastName: val('last_name', 80), companyName: val('company_name', 160), contactName: val('contact_person_name', 120),
      email: val('email')?.toLowerCase() ?? null, phone: val('phone', 40), address: val('address', 300),
      siret: val('siret', 20)?.replace(/\s/g, '') ?? null, note: val('note', 1000),
    };
    if (fields.email && !EMAIL.test(fields.email)) fail('Adresse email invalide.');
    if (fields.siret && !/^\d{14}$/.test(fields.siret)) fail('Le SIRET compte 14 chiffres.');
    const existing = i.customer_id ? await customerOf(ctx, i.customer_id) : null;
    if (!existing) {
      const type = fields.type ?? 'particulier';
      if (!fields.email) fail('L’email du client est obligatoire : demandez-le au traiteur.');
      if (type === 'particulier' && (!fields.firstName || !fields.lastName)) fail('Prénom et nom du client attendus.');
      if (type === 'entreprise' && (!fields.companyName || !fields.contactName)) fail('Raison sociale et nom du contact attendus pour une entreprise.');
      fields.type = type;
    }
    const dup = await customerDuplicate(ctx.companyId, fields.email, fields.siret, existing?.id ?? null);
    if (dup) fail(dup);
    const name = existing
      ? (existing.company_name || [existing.first_name, existing.last_name].filter(Boolean).join(' '))
      : (fields.type === 'entreprise' ? fields.companyName : `${fields.firstName} ${fields.lastName}`);
    const label: Record<string, string> = { firstName: 'Prénom', lastName: 'Nom', companyName: 'Raison sociale', contactName: 'Contact', email: 'Email', phone: 'Téléphone', address: 'Adresse', siret: 'SIRET', note: 'Note ajoutée' };
    const shown = Object.entries(fields).filter(([k, v]) => k !== 'type' && v).map(([k, v]) => ({ label: label[k], value: String(v) }));
    if (existing && !shown.length) fail('Rien à changer.');
    return propose(ctx, 'customer_upsert', { customerId: existing?.id ?? null, ...fields }, {
      title: existing ? `Modifier le client ${name}` : `Nouveau client : ${name}`,
      fields: [...(!existing ? [{ label: 'Type', value: fields.type === 'entreprise' ? 'Entreprise' : 'Particulier' }] : []), ...shown],
    });
  },

  async propose_prospect_status(ctx, i) {
    const p = await prospectOf(ctx, i.prospect_id);
    const status = str(i.status, 30);
    if (!(PROSPECT_STATUSES as readonly string[]).includes(status)) fail('Statut inconnu.');
    const problem = await prospectStatusProblem(ctx.companyId, p.id, status);
    if (problem) fail(problem);
    return propose(ctx, 'prospect_status', { prospectId: p.id, status }, {
      title: `Prospect ${p.first_name} ${p.last_name}`,
      fields: [{ label: 'Statut', value: `${STATUS_LABEL[p.status] ?? p.status} → ${STATUS_LABEL[status]}` }],
      note: 'Son devis, s’il en a un, prend le même statut.',
    });
  },

  async stock_levels(ctx, i) {
    const q = str(i.query, 80);
    const rows = await db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit, quantity: ingredient_stocks.quantity, min_alert: ingredient_stocks.min_alert })
      .from(ingredients)
      .leftJoin(ingredient_stocks, and(eq(ingredient_stocks.ingredient_id, ingredients.id), eq(ingredient_stocks.company_id, ctx.companyId)))
      .where(and(visibleIngredient(ctx), q ? ilike(ingredients.name, like(q)) : undefined,
        i.low_only === true ? sql`${ingredient_stocks.min_alert} > 0 and ${ingredient_stocks.quantity} <= ${ingredient_stocks.min_alert}` : (q ? undefined : sql`${ingredient_stocks.ingredient_id} is not null`)))
      .orderBy(ingredients.name).limit(30);
    return { results: rows.map((r) => ({ ...r, quantity: Number(r.quantity ?? 0), min_alert: Number(r.min_alert ?? 0), low: Number(r.min_alert ?? 0) > 0 && Number(r.quantity ?? 0) <= Number(r.min_alert ?? 0) })) };
  },

  async propose_stock_movement(ctx, i) {
    const raw = (Array.isArray(i.movements) ? i.movements : []).slice(0, 30) as Record<string, unknown>[];
    if (!raw.length) fail('Aucun mouvement.');
    const ids = [...new Set(raw.map((m) => String(m.ingredient_id ?? '')).filter(isUuid))];
    const found = ids.length ? await db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit }).from(ingredients).where(and(inArray(ingredients.id, ids), visibleIngredient(ctx))) : [];
    const byId = new Map(found.map((f) => [f.id, f]));
    const current = await stockOf(ctx.companyId, ids);
    const left = new Map(current);
    const moves = raw.map((m) => {
      const ing = byId.get(String(m.ingredient_id)) ?? fail('Ingrédient introuvable.');
      const type = m.type === 'in' || m.type === 'out' || m.type === 'adjust' ? m.type : fail('Type de mouvement inconnu.');
      const quantity = Number(m.quantity);
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000 || (type !== 'adjust' && quantity === 0)) fail(`Quantité invalide pour « ${ing.name} ».`);
      const have = left.get(ing.id) ?? 0;
      if (type === 'out' && quantity > have) fail(`Sortie impossible : il n’y a que ${have} ${ing.unit} de « ${ing.name} » en stock.`);
      left.set(ing.id, type === 'in' ? have + quantity : type === 'out' ? have - quantity : quantity);
      return { ingredientId: ing.id, name: ing.name, unit: ing.unit, type, quantity, reason: str(m.reason, 200) || null };
    });
    return propose(ctx, 'stock_movement', { moves }, {
      title: 'Mouvements de stock',
      fields: moves.map((m) => ({ label: MOVE_LABEL[m.type], value: `${m.name} : ${m.type === 'adjust' ? '→ ' : m.type === 'in' ? '+' : '−'}${m.quantity} ${m.unit}${m.reason ? ` (${m.reason})` : ''}` })),
    });
  },

  async list_suppliers(ctx, i) {
    const q = str(i.query, 80);
    const rows = await db.select({ id: suppliers.id, name: suppliers.name, email: suppliers.email, phone: suppliers.phone, contact: suppliers.contact_person })
      .from(suppliers)
      .where(and(sql`(${suppliers.owner_user_id} in ${companyIdsOf(ctx.companyId)} or ${suppliers.user_id} in ${companyIdsOf(ctx.companyId)})`, q ? ilike(suppliers.name, like(q)) : undefined))
      .orderBy(suppliers.name).limit(30);
    return { results: rows };
  },

  async list_supplier_orders(ctx, i) {
    const status = typeof i.status === 'string' ? i.status : null;
    const rows = await db.select({ id: supplier_orders.id, supplier: suppliers.name, status: supplier_orders.status, total: supplier_orders.total_amount, created_at: supplier_orders.created_at, ordered_at: supplier_orders.ordered_at })
      .from(supplier_orders).innerJoin(suppliers, eq(suppliers.id, supplier_orders.supplier_id))
      .where(and(orderScope(ctx), status ? eq(supplier_orders.status, status) : undefined))
      .orderBy(desc(supplier_orders.created_at)).limit(15);
    return { results: rows };
  },

  async propose_supplier_order(ctx, i) {
    if (!isUuid(i.supplier_id)) fail('Fournisseur introuvable.');
    const [sup] = await db.select().from(suppliers)
      .where(and(eq(suppliers.id, i.supplier_id as string), sql`(${suppliers.owner_user_id} in ${companyIdsOf(ctx.companyId)} or ${suppliers.user_id} in ${companyIdsOf(ctx.companyId)})`)).limit(1);
    if (!sup) fail('Fournisseur introuvable.');
    const raw = (Array.isArray(i.items) ? i.items : []).slice(0, 60) as Record<string, unknown>[];
    if (!raw.length) fail('Commande vide.');
    const ids = [...new Set(raw.map((m) => String(m.ingredient_id ?? '')).filter(isUuid))];
    const found = ids.length ? await db.select({ id: ingredients.id, name: ingredients.name, unit: ingredients.unit, price: ingredients.volume_unit_price }).from(ingredients).where(and(inArray(ingredients.id, ids), visibleIngredient(ctx))) : [];
    const byId = new Map(found.map((f) => [f.id, f]));
    const items = raw.map((m) => {
      const ing = byId.get(String(m.ingredient_id)) ?? fail('Ingrédient introuvable.');
      const quantity = Number(m.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) fail(`Quantité invalide pour « ${ing.name} ».`);
      return { ingredientId: ing.id, name: ing.name, unit: ing.unit, quantity, unitPrice: Number(ing.price ?? 0) };
    });
    const total = Math.round(items.reduce((s, x) => s + x.quantity * x.unitPrice, 0) * 100) / 100;
    return propose(ctx, 'supplier_order', { supplierId: sup!.id, items, notes: str(i.notes, 500) || null, total }, {
      title: `Commande à ${sup!.name}`,
      fields: [{ label: 'Fournisseur', value: sup!.name }, ...(i.notes ? [{ label: 'Notes', value: str(i.notes, 500) }] : [])],
      lines: items.map((x) => ({ label: x.name, detail: `${x.quantity} ${x.unit}${x.unitPrice ? ` × ${eur(x.unitPrice)}` : ''}`, amount: x.unitPrice ? eur(x.quantity * x.unitPrice) : '—' })),
      total: total ? `${eur(total)} HT (prix du catalogue)` : undefined,
      note: 'La commande est créée en brouillon : rien ne part au fournisseur sans un envoi.',
    });
  },

  async propose_supplier_order_send(ctx, i) {
    const o = await orderOf(ctx, i.order_id);
    if (!['draft', 'sent'].includes(o.status)) fail('Cette commande n’est plus à envoyer.');
    const to = (str(i.to, 200) || o.email || '').toLowerCase();
    if (!EMAIL.test(to)) fail('Adresse email du fournisseur manquante ou invalide : demandez-la au traiteur.');
    const message = str(i.message, 3000) || fail('Message attendu.');
    const date = typeof i.delivery_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.delivery_date) ? i.delivery_date : null;
    return propose(ctx, 'supplier_order_send', { orderId: o.id, to, message, deliveryDate: date }, {
      title: `Envoyer la commande à ${o.supplier}`,
      fields: [{ label: 'À', value: to }, ...(date ? [{ label: 'Livraison souhaitée', value: date }] : []), { label: 'Message', value: message }],
      note: 'Le fournisseur reçoit la commande par email quand vous validez.',
    });
  },

  async propose_supplier_order_receive(ctx, i) {
    const o = await orderOf(ctx, i.order_id);
    if (o.status === 'received') fail('Cette commande est déjà reçue.');
    if (o.status === 'cancelled') fail('Cette commande est annulée.');
    const items = await db.select({ name: ingredients.name, unit: ingredients.unit, quantity: supplier_order_items.quantity })
      .from(supplier_order_items).innerJoin(ingredients, eq(ingredients.id, supplier_order_items.ingredient_id)).where(eq(supplier_order_items.order_id, o.id));
    return propose(ctx, 'supplier_order_receive', { orderId: o.id }, {
      title: `Commande ${o.supplier} reçue`,
      fields: items.map((x) => ({ label: 'Entrée', value: `${x.name} : +${Number(x.quantity)} ${x.unit}` })),
      note: 'Ces quantités entrent en stock quand vous validez.',
    });
  },

  async propose_event_orders(ctx, i) {
    if (!isUuid(i.quote_id)) fail('Événement introuvable.');
    const [q] = await db.select({ id: quotes.id, client: quotes.client_name }).from(quotes).where(and(eq(quotes.id, i.quote_id as string), sql`${quotes.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).limit(1);
    if (!q) fail('Événement introuvable.');
    return propose(ctx, 'event_orders', { quoteId: q!.id }, {
      title: `Commandes pour ${q!.client}`,
      fields: [{ label: 'Action', value: 'Créer une commande par fournisseur depuis la liste de courses' }],
      note: 'Brouillons seulement ; les commandes automatiques déjà faites pour cet événement sont refaites.',
    });
  },

  async list_invoices(ctx, i) {
    const rows = await db.select({
      id: customer_invoices.id, number: customer_invoices.number, kind: customer_invoices.kind, status: customer_invoices.status, buyer: customer_invoices.buyer,
      total_ttc: customer_invoices.total_ttc, issue_date: customer_invoices.issue_date, due_date: customer_invoices.due_date, quote_id: customer_invoices.quote_id,
      paid: sql<number>`coalesce((select sum(p.amount) from ${customer_invoice_payments} p where p.invoice_id = "customer_invoices"."id"), 0)`,
    }).from(customer_invoices)
      .where(and(eq(customer_invoices.owner_user_id, ctx.companyId),
        isUuid(i.quote_id) ? eq(customer_invoices.quote_id, i.quote_id as string) : undefined,
        typeof i.status === 'string' ? eq(customer_invoices.status, i.status) : undefined))
      .orderBy(desc(customer_invoices.created_at)).limit(20);
    return { results: rows.map(({ buyer, ...r }) => ({ ...r, client: buyerName(buyer), total_ttc: Number(r.total_ttc), paid: Number(r.paid), remaining: Math.round((Number(r.total_ttc) - Number(r.paid)) * 100) / 100 })) };
  },

  async propose_invoice_issue(ctx, i) {
    const inv = await invoiceOf(ctx, i.invoice_id);
    if (inv.status !== 'brouillon') fail('Seule une facture en brouillon peut être émise.');
    return propose(ctx, 'invoice_issue', { invoiceId: inv.id }, {
      title: `Émettre : ${INVOICE_KIND[inv.kind] ?? inv.kind} · ${buyerName(inv.buyer)}`,
      fields: [{ label: 'Montant', value: eur(Number(inv.total_ttc)) + ' TTC' }],
      note: 'Émise, la facture reçoit son numéro et devient définitive : elle ne se modifie plus, seul un avoir peut l’annuler.',
    });
  },

  async propose_invoice_payment(ctx, i) {
    const inv = await invoiceOf(ctx, i.invoice_id);
    if (inv.status === 'brouillon' || inv.status === 'annulee' || inv.kind === 'avoir') fail('Un paiement s’enregistre sur une facture émise.');
    const amount = Math.round(Number(i.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) fail('Montant invalide.');
    const remaining = await invoiceRemaining(inv.id);
    if (amount > remaining + 0.005) fail(`Le reste à payer de cette facture est de ${eur(Math.max(0, remaining))}.`);
    const paidOn = str(i.paid_on, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || Number.isNaN(Date.parse(paidOn))) fail('Date de paiement attendue au format AAAA-MM-JJ.');
    const method = (Object.keys(PAYMENT_METHODS) as string[]).includes(String(i.method)) ? String(i.method) : 'autre';
    const note = str(i.note, 300) || null;
    return propose(ctx, 'invoice_payment', { invoiceId: inv.id, amount, paidOn, method, note }, {
      title: `Paiement reçu · ${inv.number ?? ''} ${buyerName(inv.buyer)}`.trim(),
      fields: [
        { label: 'Montant', value: eur(amount) }, { label: 'Le', value: paidOn },
        { label: 'Moyen', value: PAYMENT_METHODS[method as keyof typeof PAYMENT_METHODS] }, ...(note ? [{ label: 'Note', value: note }] : []),
      ],
    });
  },

  async list_brochures(ctx) {
    const rows = await db.select({ id: brochures.id, name: brochures.name, active: brochures.is_active, views: brochures.view_count })
      .from(brochures).where(sql`${brochures.owner_user_id} in ${companyIdsOf(ctx.companyId)}`).orderBy(desc(brochures.updated_at)).limit(20);
    return { results: rows };
  },

  async propose_brochure_send(ctx, i) {
    if (!isUuid(i.brochure_id)) fail('Brochure introuvable.');
    const [b] = await db.select().from(brochures).where(and(eq(brochures.id, i.brochure_id as string), sql`${brochures.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).limit(1);
    if (!b) fail('Brochure introuvable.');
    if (!b!.is_active) fail('Cette brochure est désactivée : réactivez son lien avant de l’envoyer.');
    const to = str(i.to, 200).toLowerCase();
    if (!EMAIL.test(to)) fail('Adresse email invalide.');
    const prospect = i.prospect_id ? await prospectOf(ctx, i.prospect_id) : null;
    const message = str(i.message, 3000) || null;
    return propose(ctx, 'brochure_send', { brochureId: b!.id, to, message, prospectId: prospect?.id ?? null }, {
      title: `Envoyer la brochure « ${b!.name} »`,
      fields: [{ label: 'À', value: to }, ...(message ? [{ label: 'Message', value: message }] : []), ...(prospect ? [{ label: 'Prospect', value: `${prospect.first_name} ${prospect.last_name} (passe « brochure envoyée »)` }] : [])],
    });
  },

  async propose_prospect_to_quote(ctx, i) {
    const p = await prospectOf(ctx, i.prospect_id);
    if (await quoteOfProspect(ctx.companyId, p.id)) fail('Cette demande a déjà son devis.');
    if (!p.event_date) fail('La demande n’a pas de date d’événement : demandez-la au traiteur, puis préparez le devis avec le spécialiste Devis.');
    return propose(ctx, 'prospect_to_quote', { prospectId: p.id }, {
      title: `Devis pour ${p.first_name} ${p.last_name}`,
      fields: [
        { label: 'Événement', value: `${p.event_type ?? 'Autre'} le ${p.event_date}` },
        { label: 'Couverts', value: String(p.guest_count ?? '—') },
        { label: 'Client', value: `${p.first_name} ${p.last_name} <${p.email}>` },
      ],
      note: 'Le devis est créé « à faire », sans lignes : complétez-le dans WeboWord ou demandez à Webo.',
    });
  },
};
