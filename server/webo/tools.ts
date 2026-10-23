import 'server-only';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { customers, prestations, profiles, prospect_requests, quotes, webo_proposals } from '@/db/schema';
import { isPerGuestPrestation } from '@/lib/brochure';
import { quoteTotalTTC, quoteVatBreakdown } from '@/lib/quoteTotals';
import { applyQuoteUpdate, EDITABLE_STATUSES, type QuoteUpdateSpec } from '@/lib/webo/quoteUpdate';
import { defaultVatRate } from '@/lib/vat';
import { companyIdsOf } from '../companyScope';
import { getDashboard } from '../dashboard';
import { MAX_MEMORIES, MAX_MEMORY_TEXT, memoryCount } from './memoryStore';

// Outils des spécialistes de Webo. Les lectures ne voient que les données de l'entreprise. Les « propositions »
// vérifient tout (identifiants de l'entreprise, dates, nombres), reprennent les prix du catalogue, et n'écrivent qu'une
// ligne dans webo_proposals : l'écriture réelle n'a lieu qu'à la validation (server/webo/execute.ts).

export type AgentName = 'devis' | 'factures' | 'catalogue' | 'prospects' | 'journee' | 'aide';
export interface ToolContext { userId: string; companyId: string; conversationId: string; proposals: string[] }

export interface ProposalSummary {
  title: string;
  fields: { label: string; value: string }[];
  lines?: { label: string; detail: string; amount: string }[];
  total?: string;
  note?: string;
}

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Champs facultatifs : forme anyOf, documentée pour les outils stricts.
const nullableStr = { anyOf: [{ type: 'string' }, { type: 'null' }] } as const;
const nullableNum = { anyOf: [{ type: 'number' }, { type: 'null' }] } as const;

function tool(name: string, description: string, properties: Record<string, unknown>): Anthropic.Tool {
  return {
    name, description, strict: true,
    input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
  } as Anthropic.Tool;
}

const TOOLS: Record<string, Anthropic.Tool> = {
  search_catalogue: tool('search_catalogue', 'Cherche des prestations du catalogue du traiteur (nom ou catégorie). Requête vide : les premières.', {
    query: { type: 'string' },
  }),
  search_customers: tool('search_customers', 'Cherche des clients existants (nom, prénom, email, entreprise).', { query: { type: 'string' } }),
  find_quotes: tool('find_quotes', 'Cherche des devis (nom du client ou numéro), les plus récents d’abord.', { query: { type: 'string' } }),
  get_quote: tool('get_quote', 'Détail d’un devis : client, événement, lignes, total.', { quote_id: { type: 'string' } }),
  list_prospects: tool('list_prospects', 'Les dernières demandes de prospects (statut facultatif, par exemple « nouveau »).', { status: nullableStr }),
  propose_quote: tool('propose_quote', 'Propose un nouveau devis au traiteur (il le validera). Client existant (customer_id) ou nouveau client (new_customer). Lignes : prestation_id du catalogue quand elle existe (son prix est repris), sinon nom seul ; quantity null = règle habituelle (couverts pour une prestation au couvert, sinon 1) ; unit_price seulement pour une ligne hors catalogue dont le traiteur a donné le prix.', {
    customer_id: nullableStr,
    new_customer: {
      anyOf: [{
        type: 'object',
        properties: { first_name: { type: 'string' }, last_name: { type: 'string' }, email: { type: 'string' }, phone: nullableStr },
        required: ['first_name', 'last_name', 'email', 'phone'], additionalProperties: false,
      }, { type: 'null' }],
    },
    client_name: { type: 'string' },
    event_type: { type: 'string' },
    event_date: { type: 'string', description: 'AAAA-MM-JJ' },
    guest_count: { type: 'integer' },
    event_location: nullableStr,
    remarks: nullableStr,
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { prestation_id: nullableStr, name: { type: 'string' }, quantity: nullableNum, unit_price: nullableNum },
        required: ['prestation_id', 'name', 'quantity', 'unit_price'], additionalProperties: false,
      },
    },
  }),
  propose_invoice: tool('propose_invoice', 'Propose un brouillon de facture depuis un devis : acompte (percent, défaut du traiteur si null), solde, ou facture totale.', {
    quote_id: { type: 'string' }, kind: { type: 'string', enum: ['acompte', 'solde', 'facture'] }, percent: nullableNum,
  }),
  propose_prestation: tool('propose_prestation', 'Propose une nouvelle prestation au catalogue.', {
    name: { type: 'string' }, unit_price: { type: 'number' }, category: nullableStr, description: nullableStr,
  }),
  propose_prestation_update: tool('propose_prestation_update', 'Propose de changer le prix et/ou la description d’une prestation existante.', {
    prestation_id: { type: 'string' }, unit_price: nullableNum, description: nullableStr,
  }),
  propose_quote_update: tool('propose_quote_update', 'Propose de modifier un devis existant (non validé) : couverts, date, lieu, lignes à ajouter (même forme que propose_quote), lignes à retirer (par leur nom). null ou liste vide = inchangé. Les quantités au couvert suivent le nouveau nombre de couverts.', {
    quote_id: { type: 'string' }, guest_count: { anyOf: [{ type: 'integer' }, { type: 'null' }] }, event_date: nullableStr, event_location: nullableStr,
    add_lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { prestation_id: nullableStr, name: { type: 'string' }, quantity: nullableNum, unit_price: nullableNum },
        required: ['prestation_id', 'name', 'quantity', 'unit_price'], additionalProperties: false,
      },
    },
    remove_lines: { type: 'array', items: { type: 'string' } },
  }),
  propose_quote_send: tool('propose_quote_send', 'Propose d’envoyer un devis au client par email (lien de consultation), avec un message d’accompagnement. Sert aussi aux relances.', {
    quote_id: { type: 'string' }, to: { type: 'string' }, message: { type: 'string' },
  }),
  stale_quotes: tool('stale_quotes', 'Devis envoyés sans réponse depuis au moins `days` jours (7 si null) : à relancer.', { days: nullableNum }),
  day_overview: tool('day_overview', 'La journée du traiteur : ce qu’il y a à faire (relances, acomptes, préparations…), les événements à venir et quelques chiffres.', {}),
  propose_memory: tool('propose_memory', 'Propose de retenir une habitude durable du traiteur (« acompte toujours à 40 % »), redonnée ensuite à chaque conversation. Une phrase courte.', {
    text: { type: 'string' },
  }),
  propose_prospect_reply: tool('propose_prospect_reply', 'Propose une réponse par email à une demande de prospect ; elle part quand le traiteur valide.', {
    prospect_id: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
  }),
};

const BY_AGENT: Record<AgentName, string[]> = {
  devis: ['search_catalogue', 'search_customers', 'find_quotes', 'get_quote', 'stale_quotes', 'propose_quote', 'propose_quote_update', 'propose_quote_send', 'propose_memory'],
  factures: ['find_quotes', 'get_quote', 'propose_invoice', 'propose_memory'],
  catalogue: ['search_catalogue', 'propose_prestation', 'propose_prestation_update', 'propose_memory'],
  prospects: ['list_prospects', 'search_catalogue', 'propose_prospect_reply', 'propose_memory'],
  journee: ['day_overview'],
  aide: [],
};

export const toolsFor = (agent: AgentName): Anthropic.Tool[] => BY_AGENT[agent].map((n) => TOOLS[n]);

class ToolError extends Error {}
const fail = (m: string): never => { throw new ToolError(m); };
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

async function catalogueById(ctx: ToolContext, ids: string[]) {
  if (ids.length === 0) return new Map<string, typeof prestations.$inferSelect>();
  const rows = await db.select().from(prestations).where(and(inArray(prestations.id, ids), sql`${prestations.user_id} in ${companyIdsOf(ctx.companyId)}`));
  return new Map(rows.map((r) => [r.id, r]));
}

async function quoteOf(ctx: ToolContext, id: unknown) {
  if (!isUuid(id)) fail('Devis introuvable.');
  const [q] = await db.select().from(quotes).where(and(eq(quotes.id, id as string), sql`${quotes.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).limit(1);
  return q ?? fail('Devis introuvable.');
}

async function propose(ctx: ToolContext, kind: string, payload: unknown, summary: ProposalSummary) {
  const [row] = await db.insert(webo_proposals).values({
    conversation_id: ctx.conversationId, company_id: ctx.companyId, user_id: ctx.userId, kind, payload, summary,
  }).returning({ id: webo_proposals.id });
  ctx.proposals.push(row.id);
  return { proposal_id: row.id, summary, note: 'Proposition affichée au traiteur : elle ne sera faite que s’il la valide.' };
}

async function vatRateOf(companyId: string): Promise<number> {
  const [p] = await db.select({ v: profiles.default_vat_rate }).from(profiles).where(eq(profiles.id, companyId)).limit(1);
  return defaultVatRate(p ? { default_vat_rate: p.v } : null);
}


export type QuoteLine = { name: string; quantity: number; unitPrice: number; fromCatalogue: boolean } & Record<string, unknown>;

/** Lignes de devis demandées par Webo : prestations du catalogue (prix du catalogue, quantité habituelle) ou hors catalogue. */
async function buildLines(ctx: ToolContext, input: unknown, guests: number): Promise<QuoteLine[]> {
  const rawLines = (Array.isArray(input) ? input : []).slice(0, 40) as Record<string, unknown>[];
  const ids = rawLines.map((l) => l.prestation_id).filter(isUuid);
  const catalogue = await catalogueById(ctx, ids);
  // Ligne sans identifiant au nom exact d'une prestation (reprise d'un ancien devis) : c'est elle, au prix du catalogue.
  const names = rawLines.filter((l) => !l.prestation_id).map((l) => str(l.name, 120).toLowerCase()).filter(Boolean);
  const byName = new Map<string, typeof prestations.$inferSelect>();
  if (names.length) {
    const rows = await db.select().from(prestations).where(and(sql`${prestations.user_id} in ${companyIdsOf(ctx.companyId)}`, inArray(sql`lower(${prestations.name})`, names)));
    for (const r of rows) byName.set(r.name.toLowerCase(), r);
  }
  for (const l of rawLines) {
    const match = !l.prestation_id ? byName.get(str(l.name, 120).toLowerCase()) : undefined;
    if (match) { l.prestation_id = match.id; catalogue.set(match.id, match); }
  }
  return rawLines.map((l) => {
    if (l.prestation_id) {
      const p = catalogue.get(String(l.prestation_id)) ?? fail(`Prestation « ${str(l.name, 80)} » introuvable dans votre catalogue.`);
      const unitPrice = Number(p.unit_price);
      const quantity = l.quantity != null && Number(l.quantity) > 0 ? Number(l.quantity)
        : isPerGuestPrestation({ ...p, unit_price: unitPrice }) ? guests : 1;
      return {
        name: p.name, description: p.description ?? undefined, quantity, unitPrice, category: p.category ?? undefined,
        ...(p.child_unit_price != null ? { childUnitPrice: Number(p.child_unit_price) } : {}),
        ...(p.gastro_card_html ? { gastroCardHtml: p.gastro_card_html } : {}), ...(p.gastro_card_html_en ? { gastroCardHtmlEn: p.gastro_card_html_en } : {}),
        fromCatalogue: true,
      };
    }
    const name = str(l.name, 120) || fail('Ligne sans nom.');
    const quantity = l.quantity != null && Number(l.quantity) > 0 ? Number(l.quantity) : 1;
    const unitPrice = l.unit_price != null && Number(l.unit_price) >= 0 ? Number(l.unit_price) : 0;
    return { name, quantity, unitPrice, isCustom: true, fromCatalogue: false };
  });
}

type Handler = (ctx: ToolContext, input: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<string, Handler> = {
  async search_catalogue(ctx, i) {
    const q = str(i.query, 100);
    const rows = await db.select({ id: prestations.id, name: prestations.name, unit_price: prestations.unit_price, category: prestations.category, child_unit_price: prestations.child_unit_price })
      .from(prestations)
      .where(and(sql`${prestations.user_id} in ${companyIdsOf(ctx.companyId)}`, q ? or(ilike(prestations.name, like(q)), ilike(prestations.category, like(q))) : undefined))
      .orderBy(prestations.name).limit(15);
    return { results: rows.map((r) => ({ ...r, unit_price: Number(r.unit_price), per_guest: isPerGuestPrestation({ ...r, unit_price: Number(r.unit_price) }) })) };
  },

  async search_customers(ctx, i) {
    const q = str(i.query, 100);
    const rows = await db.select({ id: customers.id, first_name: customers.first_name, last_name: customers.last_name, email: customers.email, company_name: customers.company_name, type: customers.customer_type })
      .from(customers)
      .where(and(sql`${customers.owner_user_id} in ${companyIdsOf(ctx.companyId)}`, q ? or(ilike(customers.first_name, like(q)), ilike(customers.last_name, like(q)), ilike(customers.email, like(q)), ilike(customers.company_name, like(q))) : undefined))
      .limit(8);
    return { results: rows };
  },

  async find_quotes(ctx, i) {
    const q = str(i.query, 100);
    const rows = await db.select({ id: quotes.id, number: quotes.quote_number, client: quotes.client_name, event_date: quotes.event_date, event_type: quotes.event_type, guests: quotes.guest_count, status: quotes.status, total_amount: quotes.total_amount, vat_rate: quotes.vat_rate, services: quotes.services, formulas: quotes.formulas, chosen_formula_id: quotes.chosen_formula_id })
      .from(quotes)
      .where(and(sql`${quotes.owner_user_id} in ${companyIdsOf(ctx.companyId)}`, q ? or(
        ilike(quotes.client_name, like(q)), ilike(quotes.quote_number, like(q)), ilike(quotes.event_type, like(q)),
        ...(/^\d{4}$/.test(q) ? [sql`to_char(${quotes.event_date}, 'YYYY') = ${q}`] : []),
      ) : undefined))
      .orderBy(desc(quotes.created_at)).limit(8);
    return { results: rows.map(({ services, formulas, chosen_formula_id, vat_rate, total_amount, ...r }) => ({
      ...r, total_ttc: quoteTotalTTC({ total_amount, vat_rate, guest_count: r.guests, services, formulas, chosen_formula_id }),
    })) };
  },

  async get_quote(ctx, i) {
    const q = await quoteOf(ctx, i.quote_id);
    const lines = (Array.isArray(q.services) ? q.services : []) as { name?: string; quantity?: number; unitPrice?: number; isOption?: boolean }[];
    return {
      id: q.id, number: q.quote_number, client: q.client_name, event_type: q.event_type, event_date: q.event_date, guests: q.guest_count, status: q.status,
      lines: lines.map((l) => ({ name: l.name, quantity: l.quantity, unit_price: l.unitPrice, option: !!l.isOption })),
      total_ttc: quoteTotalTTC({ ...q, services: q.services }),
    };
  },

  async list_prospects(ctx, i) {
    const status = str(i.status, 30);
    const rows = await db.select({ id: prospect_requests.id, first_name: prospect_requests.first_name, last_name: prospect_requests.last_name, email: prospect_requests.email, event_type: prospect_requests.event_type, event_date: prospect_requests.event_date, guests: prospect_requests.guest_count, message: prospect_requests.message, status: prospect_requests.status, created_at: prospect_requests.created_at })
      .from(prospect_requests)
      .where(and(sql`${prospect_requests.owner_user_id} in ${companyIdsOf(ctx.companyId)}`, status ? eq(prospect_requests.status, status) : undefined))
      .orderBy(desc(prospect_requests.created_at)).limit(10);
    return { results: rows.map((r) => ({ ...r, message: r.message?.slice(0, 600) ?? null })) };
  },

  async propose_quote(ctx, i) {
    const date = str(i.event_date, 10);
    // La date doit exister (pas de 30 février) : elle doit se relire à l'identique.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) fail('Date de l’événement attendue au format AAAA-MM-JJ, et qui existe.');
    const guests = Number(i.guest_count);
    if (!Number.isInteger(guests) || guests < 1 || guests > 5000) fail('Nombre de couverts entre 1 et 5 000.');
    const eventType = str(i.event_type, 60) || 'Autre';
    let customerId: string | null = null;
    let newCustomer: { first_name: string; last_name: string; email: string; phone: string | null } | null = null;
    let clientName = str(i.client_name, 120);
    if (i.customer_id) {
      if (!isUuid(i.customer_id)) fail('Client introuvable.');
      const [c] = await db.select().from(customers).where(and(eq(customers.id, i.customer_id as string), sql`${customers.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).limit(1);
      if (!c) fail('Client introuvable.');
      customerId = c.id;
      clientName ||= c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ');
    } else if (i.new_customer && typeof i.new_customer === 'object') {
      const n = i.new_customer as Record<string, unknown>;
      const email = str(n.email, 200).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Email du nouveau client invalide : demandez-le au traiteur.');
      newCustomer = { first_name: str(n.first_name, 80), last_name: str(n.last_name, 80), email, phone: str(n.phone, 40) || null };
      if (!newCustomer.first_name || !newCustomer.last_name) fail('Prénom et nom du nouveau client attendus.');
      clientName ||= `${newCustomer.first_name} ${newCustomer.last_name}`;
    }
    if (!clientName) fail('Nom du client attendu.');
    const lines = await buildLines(ctx, i.lines, guests);
    const vat = await vatRateOf(ctx.companyId);
    const totals = quoteVatBreakdown(lines, vat, guests, 0);
    const payload = { customerId, newCustomer, clientName, eventType, eventDate: date, guests, eventLocation: str(i.event_location, 200) || null, remarks: str(i.remarks, 2000) || null, vatRate: vat, lines };
    const [y, m, d] = date.split('-');
    return propose(ctx, 'quote', payload, {
      title: 'Nouveau devis',
      fields: [
        { label: 'Client', value: clientName + (newCustomer ? ` (nouveau client, ${newCustomer.email}${newCustomer.phone ? `, ${newCustomer.phone}` : ''})` : '') },
        { label: 'Événement', value: `${eventType} le ${d}/${m}/${y}` },
        { label: 'Couverts', value: String(guests) },
        ...(payload.eventLocation ? [{ label: 'Lieu', value: payload.eventLocation }] : []),
        // Tout ce qui sera écrit dans le devis est montré avant validation.
        ...(payload.remarks ? [{ label: 'Remarques', value: payload.remarks }] : []),
      ],
      lines: lines.map((l) => ({ label: l.name, detail: `${l.quantity} × ${eur(l.unitPrice)}${l.fromCatalogue ? '' : l.unitPrice ? ' (hors catalogue)' : ' (à chiffrer)'}`, amount: eur(l.quantity * l.unitPrice) })),
      total: `${eur(totals.ht)} HT · ${eur(totals.ttc)} TTC`,
      note: 'Le devis est créé en brouillon (« Devis à faire ») ; vous le relisez et l’envoyez vous-même.',
    });
  },

  async propose_invoice(ctx, i) {
    const q = await quoteOf(ctx, i.quote_id);
    const kind = i.kind === 'solde' || i.kind === 'facture' ? i.kind : 'acompte';
    const percent = i.percent == null ? null : Number(i.percent);
    if (percent != null && (!Number.isFinite(percent) || percent <= 0 || percent > 100)) fail('Pourcentage entre 1 et 100.');
    const total = quoteTotalTTC({ ...q, services: q.services }) ?? 0;
    const label = kind === 'acompte' ? `Acompte${percent ? ` de ${percent} %` : ' (pourcentage habituel)'}` : kind === 'solde' ? 'Solde' : 'Facture totale';
    return propose(ctx, 'invoice', { quoteId: q.id, kind, percent }, {
      title: 'Brouillon de facture',
      fields: [
        { label: 'Devis', value: `${q.quote_number ?? 'sans numéro'} · ${q.client_name}` },
        { label: 'Type', value: label },
        { label: 'Total du devis', value: eur(total) },
        ...(kind === 'acompte' && percent ? [{ label: 'Montant', value: eur(Math.round(total * percent) / 100) }] : []),
      ],
      note: 'La facture reste en brouillon : vous l’émettez vous-même depuis Factures.',
    });
  },

  async propose_prestation(ctx, i) {
    const name = str(i.name, 120) || fail('Nom de la prestation attendu.');
    const price = Number(i.unit_price);
    if (!Number.isFinite(price) || price < 0 || price > 100_000) fail('Prix invalide.');
    const description = str(i.description, 2000) || null;
    return propose(ctx, 'prestation', { name, unitPrice: price, category: str(i.category, 60) || null, description }, {
      title: 'Nouvelle prestation',
      fields: [
        { label: 'Nom', value: name }, { label: 'Prix', value: eur(price) },
        ...(i.category ? [{ label: 'Catégorie', value: str(i.category, 60) }] : []),
        ...(description ? [{ label: 'Description', value: description }] : []),
      ],
    });
  },

  async propose_prestation_update(ctx, i) {
    if (!isUuid(i.prestation_id)) fail('Prestation introuvable.');
    const p = (await catalogueById(ctx, [i.prestation_id as string])).get(i.prestation_id as string) ?? fail('Prestation introuvable.');
    const price = i.unit_price == null ? null : Number(i.unit_price);
    if (price != null && (!Number.isFinite(price) || price < 0 || price > 100_000)) fail('Prix invalide.');
    const description = str(i.description, 2000) || null;
    if (price == null && !description) fail('Rien à changer.');
    return propose(ctx, 'prestation_update', { prestationId: p.id, unitPrice: price, description }, {
      title: `Modifier « ${p.name} »`,
      fields: [
        ...(price != null ? [{ label: 'Prix', value: `${eur(Number(p.unit_price))} → ${eur(price)}` }] : []),
        ...(description ? [{ label: 'Nouvelle description', value: description }] : []),
      ],
    });
  },

  async propose_quote_update(ctx, i) {
    const q = await quoteOf(ctx, i.quote_id);
    if (!EDITABLE_STATUSES.includes(q.status)) fail('Ce devis est validé, payé ou refusé : il ne se modifie plus.');
    const guests = i.guest_count == null ? null : Number(i.guest_count);
    if (guests != null && (!Number.isInteger(guests) || guests < 1 || guests > 5000)) fail('Nombre de couverts entre 1 et 5 000.');
    const date = i.event_date ? str(i.event_date, 10) : null;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) fail('Date attendue au format AAAA-MM-JJ, et qui existe.');
    const remove = (Array.isArray(i.remove_lines) ? i.remove_lines : []).map((n) => str(n, 120)).filter(Boolean);
    const current = (Array.isArray(q.services) ? q.services : []) as { name?: string }[];
    for (const n of remove) if (!current.some((l) => (l.name ?? '').toLowerCase() === n.toLowerCase())) fail(`Aucune ligne « ${n} » dans ce devis.`);
    const add = await buildLines(ctx, i.add_lines, guests ?? q.guest_count);
    const spec: QuoteUpdateSpec = { quoteId: q.id, guestCount: guests, eventDate: date, eventLocation: str(i.event_location, 200) || null, add, remove };
    if (spec.guestCount == null && !spec.eventDate && !spec.eventLocation && !add.length && !remove.length) fail('Rien à changer.');
    const next = applyQuoteUpdate({ services: q.services, guestCount: q.guest_count }, spec);
    const vat = Number(q.vat_rate ?? 20);
    const before = quoteVatBreakdown((Array.isArray(q.services) ? q.services : []) as never[], vat, q.guest_count, 0).ttc;
    const after = quoteVatBreakdown(next.services as never[], vat, next.guestCount, 0).ttc;
    return propose(ctx, 'quote_update', spec, {
      title: `Modifier le devis ${q.quote_number ?? ''}`.trim(),
      fields: [
        { label: 'Client', value: q.client_name },
        ...(guests != null ? [{ label: 'Couverts', value: `${q.guest_count} → ${guests}` }] : []),
        ...(date ? [{ label: 'Date', value: `${q.event_date} → ${date}` }] : []),
        ...(spec.eventLocation ? [{ label: 'Lieu', value: spec.eventLocation }] : []),
        ...(remove.length ? [{ label: 'Retirées', value: remove.join(', ') }] : []),
      ],
      lines: add.map((l) => ({ label: `+ ${l.name}`, detail: `${l.quantity} × ${eur(l.unitPrice)}`, amount: eur(l.quantity * l.unitPrice) })),
      total: `${eur(before)} → ${eur(after)} TTC`,
      note: 'Si le devis est déjà mis en forme, son document est remis à jour après validation.',
    });
  },

  async propose_quote_send(ctx, i) {
    const q = await quoteOf(ctx, i.quote_id);
    const to = str(i.to, 200).toLowerCase();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) fail('Adresse email invalide.');
    const message = str(i.message, 4000) || fail('Message attendu.');
    return propose(ctx, 'quote_send', { quoteId: q.id, to, message }, {
      title: `Envoyer le devis ${q.quote_number ?? ''}`.trim(),
      fields: [{ label: 'Client', value: q.client_name }, { label: 'À', value: to }, { label: 'Message', value: message }],
      note: 'Le client reçoit un email avec le lien vers son devis quand vous validez.',
    });
  },

  async stale_quotes(ctx, i) {
    const days = i.days == null ? 7 : Math.min(90, Math.max(1, Math.round(Number(i.days)) || 7));
    const rows = await db.select({ id: quotes.id, number: quotes.quote_number, client: quotes.client_name, email: quotes.client_email, sent_at: quotes.sent_at, event_date: quotes.event_date })
      .from(quotes)
      .where(and(sql`${quotes.owner_user_id} in ${companyIdsOf(ctx.companyId)}`, eq(quotes.status, 'devis_envoye'),
        sql`${quotes.sent_at} < now() - make_interval(days => ${days})`))
      .orderBy(quotes.sent_at).limit(10);
    return { days, results: rows };
  },

  async day_overview() {
    const d = await getDashboard();
    return {
      today: d.today,
      to_do: d.todo.slice(0, 15).map((t) => ({ what: t.title, detail: t.detail, when: t.when })),
      upcoming_events: d.upcoming.slice(0, 10).map((e) => ({ client: e.client, type: e.eventType, date: e.date, guests: e.guests, missing: e.missing })),
      pending_quotes: d.summary.pendingCount,
    };
  },

  async propose_memory(ctx, i) {
    const text = str(i.text, 1000);
    if (!text) fail('Habitude vide.');
    if (text.length > MAX_MEMORY_TEXT) fail(`Une habitude tient en ${MAX_MEMORY_TEXT} caractères au plus.`);
    if (await memoryCount(ctx.companyId) >= MAX_MEMORIES) fail(`Webo retient ${MAX_MEMORIES} habitudes au plus : le traiteur doit en effacer une dans Paramètres.`);
    return propose(ctx, 'memory', { text }, { title: 'Retenir une habitude', fields: [{ label: 'Habitude', value: text }], note: 'Webo s’en souviendra dans vos prochaines conversations. Vous la retrouvez dans Paramètres.' });
  },

  async propose_prospect_reply(ctx, i) {
    if (!isUuid(i.prospect_id)) fail('Demande introuvable.');
    const [p] = await db.select().from(prospect_requests).where(and(eq(prospect_requests.id, i.prospect_id as string), sql`${prospect_requests.owner_user_id} in ${companyIdsOf(ctx.companyId)}`)).limit(1);
    if (!p) fail('Demande introuvable.');
    const subject = str(i.subject, 200) || fail('Objet attendu.');
    const body = str(i.body, 6000) || fail('Texte attendu.');
    return propose(ctx, 'prospect_reply', { prospectId: p.id, to: p.email, subject, body }, {
      title: 'Réponse à un prospect',
      fields: [{ label: 'À', value: `${p.first_name} ${p.last_name} <${p.email}>` }, { label: 'Objet', value: subject }, { label: 'Message', value: body }],
      note: 'L’email part quand vous validez.',
    });
  },
};

/** Exécute un outil ; le résultat est le texte (JSON) rendu au modèle. Une erreur attendue devient { error }. */
export async function runTool(ctx: ToolContext, name: string, input: unknown): Promise<string> {
  const handler = HANDLERS[name];
  if (!handler) return JSON.stringify({ error: `Outil inconnu : ${name}` });
  try {
    return JSON.stringify(await handler(ctx, (input && typeof input === 'object' ? input : {}) as Record<string, unknown>));
  } catch (e) {
    if (e instanceof ToolError) return JSON.stringify({ error: e.message });
    // Erreur inattendue (base, donnée illisible) : rendue au modèle comme une erreur, la réponse continue.
    console.error('[webo] outil', name, e);
    return JSON.stringify({ error: 'Cette recherche n’a pas pu être faite.' });
  }
}
