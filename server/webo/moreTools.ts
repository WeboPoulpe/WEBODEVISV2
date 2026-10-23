import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db';
import { customers, prospect_requests, quotes } from '@/db/schema';
import { companyIdsOf } from '../companyScope';
import { fail, isUuid, nullableStr, propose, str, tool, type AgentName, type Handler, type ToolContext } from './toolKit';

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
  propose_prospect_to_quote: tool('propose_prospect_to_quote', 'Propose de transformer la demande d’un prospect en devis (client retrouvé par email ou créé, devis « à faire » avec l’événement de la demande).', {
    prospect_id: { type: 'string' },
  }),
};

export const MORE_BY_AGENT: Partial<Record<AgentName, string[]>> = {
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

/** Le devis déjà fait pour un prospect (dans l'entreprise), s'il existe. */
export async function quoteOfProspect(companyId: string, prospectId: string) {
  const [q] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.prospect_id, prospectId), sql`${quotes.owner_user_id} in ${companyIdsOf(companyId)}`)).limit(1);
  return q ?? null;
}

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
    if (fields.email && fields.email !== existing?.email) {
      const [dup] = await db.select({ id: customers.id }).from(customers).where(and(sql`lower(${customers.email}) = ${fields.email}`, inCompany(ctx))).limit(1);
      if (dup && dup.id !== existing?.id) fail('Un client avec cet email existe déjà : modifiez sa fiche plutôt que d’en créer une.');
    }
    if (fields.siret && fields.siret !== existing?.siret_number) {
      const [dup] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.siret_number, fields.siret), inCompany(ctx))).limit(1);
      if (dup && dup.id !== existing?.id) fail('Un client avec ce SIRET existe déjà.');
    }
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
    return propose(ctx, 'prospect_status', { prospectId: p.id, status }, {
      title: `Prospect ${p.first_name} ${p.last_name}`,
      fields: [{ label: 'Statut', value: `${STATUS_LABEL[p.status] ?? p.status} → ${STATUS_LABEL[status]}` }],
      note: 'Son devis, s’il en a un, prend le même statut.',
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
