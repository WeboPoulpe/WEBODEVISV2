'use server';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customer_invoice_payments, customer_invoices, profiles, quotes } from '@/db/schema';
import { DEMO_BLOCKED, isDemoUser } from '@/lib/demo';
import {
  addDays, balanceLines, cents, creditLines, depositLines, invoiceTotals, linesFromQuote, paymentStatus,
  PAYMENT_METHODS, type InvoiceKind, type InvoiceLine, type InvoiceStatus, type PaymentMethod, type RateTotal,
} from '@/lib/invoices';
import { formulaPending } from '@/lib/quoteFormulas';
import { quoteColumns } from './formulaColumns';
import { requireUser, requireWriter } from './session';

// Factures clients. Tout passe par ces actions serveur (les tables ne sont pas exposées à /api/db) :
// chacune vérifie que la facture appartient à l'entreprise de l'utilisateur connecté.

export interface Party {
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  isCompany?: boolean;
}

export interface Seller extends Party {
  legalForm?: string | null;
  shareCapital?: string | null;
  rcs?: string | null;
  vatExempt?: boolean;
  iban?: string | null;
  bic?: string | null;
  logoUrl?: string | null;
}

export interface Payment { id: string; paid_on: string; amount: number; method: PaymentMethod; note: string | null }

export interface Invoice {
  id: string;
  quote_id: string | null;
  quote_number: string | null;
  kind: InvoiceKind;
  status: InvoiceStatus;
  number: string | null;
  credited_invoice_id: string | null;
  credited_invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  service_date: string | null;
  seller: Seller;
  buyer: Party;
  lines: InvoiceLine[];
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  vat_breakdown: RateTotal[];
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
  paid: number;
  payments: Payment[];
}

type Result<T = object> = ({ error: null } & T) | { error: string };

/** Entreprise de l'utilisateur : son compte parent s'il est rattaché, sinon lui-même. */
async function companyOf(uid: string): Promise<string> {
  const [me] = await db.select({ parent: profiles.parent_user_id }).from(profiles).where(eq(profiles.id, uid)).limit(1);
  return me?.parent ?? uid;
}

async function loadQuote(uid: string, quoteId: string) {
  const [quote] = await db.select(await quoteColumns()).from(quotes).where(and(
    eq(quotes.id, quoteId),
    sql`(${quotes.user_id} = ${uid} or ${quotes.owner_user_id} = ${uid} or ${quotes.owner_user_id} in (select cp.id from public.profiles cp where coalesce(cp.parent_user_id, cp.id) = (select coalesce(me.parent_user_id, me.id) from public.profiles me where me.id = ${uid}::uuid)))`,
  )).limit(1);
  return quote ?? null;
}

async function sellerSnapshot(company: string): Promise<{ seller: Seller; paymentDays: number; depositPercent: number }> {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, company)).limit(1);
  return {
    seller: {
      name: p?.company_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Votre entreprise',
      address: p?.company_address ?? null,
      email: p?.company_email || p?.email || null,
      phone: p?.company_phone ?? null,
      siret: p?.siret || p?.company_siret || null,
      vatNumber: p?.vat_exempt ? null : (p?.vat_number ?? null),
      vatExempt: !!p?.vat_exempt,
      legalForm: p?.legal_form ?? null,
      shareCapital: p?.share_capital ?? null,
      rcs: p?.rcs ?? null,
      iban: p?.company_iban ?? null,
      bic: p?.company_bic ?? null,
      logoUrl: p?.logo_url || p?.company_logo_url || null,
      isCompany: true,
    },
    paymentDays: p?.payment_terms_days ?? 30,
    depositPercent: Number(p?.deposit_percent ?? 30),
  };
}

function buyerFromQuote(q: typeof quotes.$inferSelect): Party {
  const isCompany = q.client_type === 'entreprise';
  const person = [q.client_first_name, q.client_last_name].filter(Boolean).join(' ').trim();
  return {
    name: (isCompany ? q.company_name : person) || q.client_name || 'Client',
    address: q.client_address ?? null,
    email: q.client_email ?? null,
    phone: q.client_phone ?? null,
    siret: isCompany ? (q.client_siret ?? null) : null,
    isCompany,
  };
}

const num = (v: unknown) => Number(v ?? 0);

function toInvoice(row: typeof customer_invoices.$inferSelect, extra: { payments: Payment[]; quoteNumber: string | null; creditedNumber: string | null }): Invoice {
  return {
    id: row.id,
    quote_id: row.quote_id,
    quote_number: extra.quoteNumber,
    kind: row.kind as InvoiceKind,
    status: row.status as InvoiceStatus,
    number: row.number,
    credited_invoice_id: row.credited_invoice_id,
    credited_invoice_number: extra.creditedNumber,
    issue_date: row.issue_date,
    due_date: row.due_date,
    service_date: row.service_date,
    seller: row.seller as Seller,
    buyer: row.buyer as Party,
    lines: row.lines as InvoiceLine[],
    total_ht: num(row.total_ht),
    total_vat: num(row.total_vat),
    total_ttc: num(row.total_ttc),
    vat_breakdown: row.vat_breakdown as RateTotal[],
    notes: row.notes,
    pdf_url: row.pdf_url,
    created_at: row.created_at,
    paid: cents(extra.payments.reduce((s, p) => s + p.amount, 0)),
    payments: extra.payments,
  };
}

async function hydrate(rows: (typeof customer_invoices.$inferSelect)[]): Promise<Invoice[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const quoteIds = [...new Set(rows.map((r) => r.quote_id).filter((x): x is string => !!x))];
  const creditedIds = [...new Set(rows.map((r) => r.credited_invoice_id).filter((x): x is string => !!x))];
  const [pays, qs, credited] = await Promise.all([
    db.select().from(customer_invoice_payments).where(inArray(customer_invoice_payments.invoice_id, ids)).orderBy(asc(customer_invoice_payments.paid_on)),
    quoteIds.length ? db.select({ id: quotes.id, n: quotes.quote_number }).from(quotes).where(inArray(quotes.id, quoteIds)) : [],
    creditedIds.length ? db.select({ id: customer_invoices.id, n: customer_invoices.number }).from(customer_invoices).where(inArray(customer_invoices.id, creditedIds)) : [],
  ]);
  return rows.map((r) => toInvoice(r, {
    payments: pays.filter((p) => p.invoice_id === r.id).map((p) => ({ id: p.id, paid_on: p.paid_on, amount: num(p.amount), method: p.method as PaymentMethod, note: p.note })),
    quoteNumber: qs.find((q) => q.id === r.quote_id)?.n ?? null,
    creditedNumber: credited.find((c) => c.id === r.credited_invoice_id)?.n ?? null,
  }));
}

async function ownedInvoiceRow(uid: string, id: string) {
  const company = await companyOf(uid);
  const [row] = await db.select().from(customer_invoices).where(and(eq(customer_invoices.id, id), eq(customer_invoices.owner_user_id, company))).limit(1);
  return row ?? null;
}

// ── Lecture ──────────────────────────────────────────────────────────────────

export async function listInvoices(opts: { quoteId?: string } = {}): Promise<Invoice[]> {
  const user = await requireUser();
  const company = await companyOf(user.id);
  const rows = await db.select().from(customer_invoices)
    .where(opts.quoteId ? and(eq(customer_invoices.owner_user_id, company), eq(customer_invoices.quote_id, opts.quoteId)) : eq(customer_invoices.owner_user_id, company))
    .orderBy(desc(customer_invoices.created_at));
  return hydrate(rows);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const user = await requireUser();
  const row = await ownedInvoiceRow(user.id, id);
  return row ? (await hydrate([row]))[0] : null;
}

/** Ce qu'il faut savoir pour proposer « Facturer » sur un devis : déjà facturé, acomptes, total. */
export async function quoteBillingSummary(quoteId: string): Promise<{ totalTTC: number; depositPercent: number; invoicedTTC: number; hasFinal: boolean; deposits: number } | null> {
  const user = await requireUser();
  const quote = await loadQuote(user.id, quoteId);
  if (!quote) return null;
  const company = await companyOf(user.id);
  const { depositPercent } = await sellerSnapshot(company);
  const invoices = (await listInvoices({ quoteId })).filter((i) => i.status !== 'brouillon' && i.status !== 'annulee' && i.kind !== 'avoir');
  return {
    totalTTC: invoiceTotals(linesFromQuote(quote)).ttc,
    depositPercent,
    invoicedTTC: cents(invoices.reduce((s, i) => s + i.total_ttc, 0)),
    hasFinal: invoices.some((i) => i.kind === 'solde' || i.kind === 'facture'),
    deposits: invoices.filter((i) => i.kind === 'acompte').length,
  };
}

// ── Brouillons ───────────────────────────────────────────────────────────────

/** Prépare un brouillon depuis un devis : acompte (pourcentage ou montant), solde ou facture complète. */
export async function createInvoiceDraft(input: { quoteId: string; kind: Exclude<InvoiceKind, 'avoir'>; percent?: number; amountTTC?: number }): Promise<Result<{ id: string }>> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const quote = await loadQuote(user.id, input.quoteId);
  if (!quote) return { error: 'Devis introuvable.' };
  const company = await companyOf(user.id);
  const { seller, depositPercent } = await sellerSnapshot(company);

  // Devis à formules : on ne facture que la formule retenue, il faut donc la connaître.
  if (formulaPending(quote)) return { error: 'Ce devis propose plusieurs formules : indiquez d’abord celle que le client a retenue (panneau Prestations de l’éditeur).' };
  const quoteLines = linesFromQuote(quote);
  if (quoteLines.length === 0) return { error: 'Ce devis n’a aucune ligne à facturer.' };

  const previous = (await listInvoices({ quoteId: quote.id })).filter((i) => i.status !== 'brouillon' && i.status !== 'annulee' && i.kind !== 'avoir');
  if (previous.some((i) => i.kind === 'solde' || i.kind === 'facture')) return { error: 'Ce devis a déjà sa facture de solde. Pour la corriger, établissez un avoir.' };

  let lines: InvoiceLine[];
  if (input.kind === 'acompte') {
    const percent = input.amountTTC == null ? (input.percent ?? depositPercent) : undefined;
    if (percent != null && !(percent > 0 && percent < 100)) return { error: 'Le pourcentage d’acompte doit être compris entre 1 et 99 %.' };
    if (input.amountTTC != null && !(input.amountTTC > 0)) return { error: 'Indiquez un montant d’acompte.' };
    lines = depositLines(quoteLines, { percent, amountTTC: input.amountTTC, quoteNumber: quote.quote_number });
    const already = cents(previous.reduce((s, i) => s + i.total_ttc, 0));
    if (already + invoiceTotals(lines).ttc > invoiceTotals(quoteLines).ttc + 0.01) return { error: 'Avec cet acompte, le total facturé dépasserait le montant du devis.' };
  } else if (input.kind === 'solde') {
    lines = balanceLines(quoteLines, previous.filter((i) => i.kind === 'acompte').map((i) => ({ number: i.number!, byRate: i.vat_breakdown })));
  } else {
    if (previous.length > 0) return { error: 'Des acomptes ont déjà été facturés sur ce devis : faites une facture de solde.' };
    lines = quoteLines;
  }

  // Vendeur en franchise de TVA : aucune TVA facturée, toutes les lignes à 0 %.
  if (seller.vatExempt) lines = lines.map((l) => ({ ...l, vatRate: 0 }));
  const totals = invoiceTotals(lines);
  const [row] = await db.insert(customer_invoices).values({
    owner_user_id: company,
    created_by: user.id,
    quote_id: quote.id,
    kind: input.kind,
    service_date: quote.event_date,
    seller,
    buyer: buyerFromQuote(quote),
    lines,
    total_ht: totals.ht,
    total_vat: totals.vat,
    total_ttc: totals.ttc,
    vat_breakdown: totals.byRate,
  }).returning({ id: customer_invoices.id });
  return { error: null, id: row.id };
}

/** Avoir : annule une facture émise, en reprenant ses lignes en négatif. */
export async function createCreditNoteDraft(invoiceId: string): Promise<Result<{ id: string }>> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const row = await ownedInvoiceRow(user.id, invoiceId);
  if (!row) return { error: 'Facture introuvable.' };
  if (row.kind === 'avoir') return { error: 'Un avoir ne s’annule pas par un autre avoir.' };
  if (row.status === 'brouillon') return { error: 'Un brouillon se supprime simplement : il n’a pas besoin d’avoir.' };
  if (row.status === 'annulee') return { error: 'Cette facture est déjà annulée par un avoir.' };
  const [pending] = await db.select({ id: customer_invoices.id }).from(customer_invoices)
    .where(and(eq(customer_invoices.credited_invoice_id, row.id), eq(customer_invoices.status, 'brouillon'))).limit(1);
  if (pending) return { error: null, id: pending.id };

  const lines = creditLines(row.lines as InvoiceLine[], row.number!);
  const totals = invoiceTotals(lines);
  const [credit] = await db.insert(customer_invoices).values({
    owner_user_id: row.owner_user_id,
    created_by: user.id,
    quote_id: row.quote_id,
    kind: 'avoir',
    credited_invoice_id: row.id,
    service_date: row.service_date,
    seller: row.seller,
    buyer: row.buyer,
    lines,
    total_ht: totals.ht,
    total_vat: totals.vat,
    total_ttc: totals.ttc,
    vat_breakdown: totals.byRate,
  }).returning({ id: customer_invoices.id });
  return { error: null, id: credit.id };
}

/** Modifie un brouillon : lignes, client, date de prestation, notes. */
export async function updateInvoiceDraft(id: string, patch: { lines?: InvoiceLine[]; buyer?: Party; serviceDate?: string | null; notes?: string | null }): Promise<Result> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const row = await ownedInvoiceRow(user.id, id);
  if (!row) return { error: 'Facture introuvable.' };
  if (row.status !== 'brouillon') return { error: 'Une facture émise ne se modifie plus : établissez un avoir.' };

  const set: Partial<typeof customer_invoices.$inferInsert> = { updated_at: new Date().toISOString() };
  if (patch.lines) {
    const lines = patch.lines
      .map((l) => ({ label: String(l.label ?? '').trim().slice(0, 300), description: l.description?.toString().slice(0, 1000) || null, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), vatRate: Number(l.vatRate) }))
      .filter((l) => l.label);
    if (lines.some((l) => !Number.isFinite(l.quantity) || !Number.isFinite(l.unitPrice) || !Number.isFinite(l.vatRate) || l.vatRate < 0 || l.vatRate > 30)) {
      return { error: 'Vérifiez les quantités, les prix et les taux de TVA.' };
    }
    const totals = invoiceTotals(lines);
    Object.assign(set, { lines, total_ht: totals.ht, total_vat: totals.vat, total_ttc: totals.ttc, vat_breakdown: totals.byRate });
  }
  if (patch.buyer) {
    if (!patch.buyer.name?.trim()) return { error: 'Indiquez le nom du client.' };
    set.buyer = { ...patch.buyer, name: patch.buyer.name.trim() };
  }
  if (patch.serviceDate !== undefined) set.service_date = patch.serviceDate || null;
  if (patch.notes !== undefined) set.notes = patch.notes?.trim().slice(0, 2000) || null;
  await db.update(customer_invoices).set(set).where(eq(customer_invoices.id, id));
  return { error: null };
}

export async function deleteInvoiceDraft(id: string): Promise<Result> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const row = await ownedInvoiceRow(user.id, id);
  if (!row) return { error: 'Facture introuvable.' };
  if (row.status !== 'brouillon') return { error: 'Une facture émise ne se supprime pas : établissez un avoir.' };
  await db.delete(customer_invoices).where(eq(customer_invoices.id, id));
  return { error: null };
}

// ── Émission ─────────────────────────────────────────────────────────────────

/**
 * Émet un brouillon : numéro attribué (sans trou, dans la même transaction), vendeur recopié tel qu'il est
 * aujourd'hui, date d'émission et échéance. Ensuite la facture ne bouge plus.
 */
export async function issueInvoice(id: string): Promise<Result<{ number: string }>> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const row = await ownedInvoiceRow(user.id, id);
  if (!row) return { error: 'Facture introuvable.' };
  if (row.status !== 'brouillon') return { error: 'Cette facture est déjà émise.' };
  const lines = row.lines as InvoiceLine[];
  if (lines.length === 0) return { error: 'La facture n’a aucune ligne.' };
  const buyer = row.buyer as Party;
  if (!buyer.name?.trim()) return { error: 'Indiquez le nom du client avant d’émettre la facture.' };
  if (buyer.isCompany && !buyer.address?.trim()) return { error: 'Pour un client professionnel, l’adresse est obligatoire sur la facture.' };

  const { seller, paymentDays } = await sellerSnapshot(row.owner_user_id);
  if (!seller.siret) return { error: 'Renseignez votre SIRET dans Paramètres avant d’émettre une facture.' };
  if (!seller.address) return { error: 'Renseignez l’adresse de votre entreprise dans Paramètres avant d’émettre une facture.' };
  if (!seller.vatExempt && !seller.vatNumber) return { error: 'Renseignez votre n° de TVA intracommunautaire (ou la franchise de TVA) dans Paramètres avant d’émettre une facture.' };

  const today = new Date().toISOString().slice(0, 10);
  // Franchise de TVA déclarée depuis le brouillon : les lignes passent à 0 %.
  const finalLines = seller.vatExempt ? lines.map((l) => ({ ...l, vatRate: 0 })) : lines;
  const totals = invoiceTotals(finalLines);
  const number = await db.transaction(async (tx) => {
    const [{ n }] = (await tx.execute<{ n: string }>(sql`select public.next_document_number(${row.owner_user_id}::uuid, ${row.kind === 'avoir' ? 'credit' : 'invoice'}) as n`)).rows;
    await tx.update(customer_invoices).set({
      status: 'emise',
      number: n,
      seller,
      lines: finalLines,
      issue_date: today,
      due_date: row.kind === 'avoir' ? null : addDays(today, paymentDays),
      total_ht: totals.ht,
      total_vat: totals.vat,
      total_ttc: totals.ttc,
      vat_breakdown: totals.byRate,
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).where(and(eq(customer_invoices.id, id), eq(customer_invoices.status, 'brouillon')));
    // L'avoir annule la facture d'origine.
    if (row.kind === 'avoir' && row.credited_invoice_id) {
      await tx.update(customer_invoices).set({ status: 'annulee', updated_at: new Date().toISOString() }).where(eq(customer_invoices.id, row.credited_invoice_id));
    }
    return n;
  });
  return { error: null, number };
}

// ── Encaissements ────────────────────────────────────────────────────────────

/** Met à jour le statut de la facture, et celui du devis quand l'acompte ou le solde est réglé. */
async function syncAfterPayment(invoiceId: string, uid: string) {
  const [row] = await db.select().from(customer_invoices).where(eq(customer_invoices.id, invoiceId)).limit(1);
  if (!row || row.status === 'brouillon' || row.status === 'annulee' || row.kind === 'avoir') return;
  const [{ paid }] = await db.select({ paid: sql<string>`coalesce(sum(${customer_invoice_payments.amount}), 0)` })
    .from(customer_invoice_payments).where(eq(customer_invoice_payments.invoice_id, invoiceId));
  const status = paymentStatus(num(row.total_ttc), num(paid));
  if (status !== row.status) await db.update(customer_invoices).set({ status, updated_at: new Date().toISOString() }).where(eq(customer_invoices.id, invoiceId));
  if (status !== 'payee' || !row.quote_id) return;
  // Acompte réglé : le devis passe en « Acompte reçu » ; solde ou facture complète réglés : « Payé ».
  const next = row.kind === 'acompte' ? 'acompte' : 'paye';
  const from = row.kind === 'acompte' ? ['valide', 'devis_final', 'devis_envoye'] : ['valide', 'acompte', 'devis_final', 'devis_envoye'];
  const quoteId = row.quote_id;
  await db.transaction(async (tx) => {
    // L'historique des statuts (déclencheur) enregistre qui a fait le changement.
    await tx.execute(sql`select set_config('app.user_id', ${uid}, true)`);
    await tx.update(quotes).set({ status: next, updated_at: new Date().toISOString() })
      .where(and(eq(quotes.id, quoteId), inArray(quotes.status, from)));
  });
}

export async function recordPayment(invoiceId: string, input: { paidOn: string; amount: number; method: PaymentMethod; note?: string | null }): Promise<Result> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const row = await ownedInvoiceRow(user.id, invoiceId);
  if (!row) return { error: 'Facture introuvable.' };
  if (row.kind === 'avoir' || row.status === 'brouillon' || row.status === 'annulee') return { error: 'On n’enregistre un paiement que sur une facture émise.' };
  const amount = cents(Number(input.amount));
  if (!(amount > 0)) return { error: 'Indiquez le montant reçu.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) return { error: 'Indiquez la date du paiement.' };
  const method = input.method in PAYMENT_METHODS ? input.method : 'autre';
  await db.insert(customer_invoice_payments).values({ invoice_id: row.id, paid_on: input.paidOn, amount, method, note: input.note?.trim().slice(0, 300) || null, created_by: user.id });
  await syncAfterPayment(row.id, user.id);
  return { error: null };
}

export async function deletePayment(paymentId: string): Promise<Result> {
  const user = await requireWriter();
  if (isDemoUser(user.id)) return { error: DEMO_BLOCKED };
  const [p] = await db.select({ invoice_id: customer_invoice_payments.invoice_id }).from(customer_invoice_payments).where(eq(customer_invoice_payments.id, paymentId)).limit(1);
  if (!p || !(await ownedInvoiceRow(user.id, p.invoice_id))) return { error: 'Paiement introuvable.' };
  await db.delete(customer_invoice_payments).where(eq(customer_invoice_payments.id, paymentId));
  await syncAfterPayment(p.invoice_id, user.id);
  return { error: null };
}
