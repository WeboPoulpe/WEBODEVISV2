import 'server-only';
import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { customer_invoice_payments, customer_invoices, profiles, quotes } from '@/db/schema';
import type { ExportDocument, ExportPayment } from '@/lib/accountingExport';
import { invoiceTotals, type InvoiceKind, type InvoiceLine, type InvoiceStatus, type PaymentMethod, type RateTotal } from '@/lib/invoices';
import { companyOf } from './companyScope';
import { requireUser } from './session';

// Lecture pour l'export comptable : les factures et avoirs émis sur la période (date d'émission), et les
// paiements reçus sur la période (date du paiement), de l'entreprise de l'utilisateur connecté uniquement.
// Les brouillons ne sont jamais exportés. Un compte en consultation seule peut exporter.

const num = (v: unknown) => Number(v ?? 0);
const credited = alias(customer_invoices, 'credited');

export interface AccountingExportData {
  documents: ExportDocument[];
  payments: ExportPayment[];
  /** SIRET de l'entreprise (Paramètres), pour nommer le fichier FEC. */
  siret: string | null;
}

export async function accountingExportData(from: string, to: string): Promise<AccountingExportData> {
  const user = await requireUser();
  const mine = sql`${customer_invoices.owner_user_id} = ${companyOf(user.id)}`;

  const [rows, payRows, [company]] = await Promise.all([
    db.select({ inv: customer_invoices, quoteNumber: quotes.quote_number, creditedNumber: credited.number })
      .from(customer_invoices)
      .leftJoin(quotes, eq(quotes.id, customer_invoices.quote_id))
      .leftJoin(credited, eq(credited.id, customer_invoices.credited_invoice_id))
      .where(and(mine, ne(customer_invoices.status, 'brouillon'), gte(customer_invoices.issue_date, from), lte(customer_invoices.issue_date, to)))
      .orderBy(asc(customer_invoices.issue_date), asc(customer_invoices.number)),
    db.select({ pay: customer_invoice_payments, number: customer_invoices.number, buyer: customer_invoices.buyer })
      .from(customer_invoice_payments)
      .innerJoin(customer_invoices, eq(customer_invoices.id, customer_invoice_payments.invoice_id))
      .where(and(mine, ne(customer_invoices.status, 'brouillon'), gte(customer_invoice_payments.paid_on, from), lte(customer_invoice_payments.paid_on, to)))
      .orderBy(asc(customer_invoice_payments.paid_on), asc(customer_invoices.number)),
    db.select({ siret: profiles.siret, companySiret: profiles.company_siret }).from(profiles)
      .where(sql`${profiles.id} = ${companyOf(user.id)}`).limit(1),
  ]);

  // Encaissé à ce jour sur chaque facture exportée (tous paiements, même hors période).
  const ids = rows.map((r) => r.inv.id);
  const paidRows = ids.length
    ? await db.select({ id: customer_invoice_payments.invoice_id, paid: sql<string>`sum(${customer_invoice_payments.amount})` })
      .from(customer_invoice_payments).where(inArray(customer_invoice_payments.invoice_id, ids)).groupBy(customer_invoice_payments.invoice_id)
    : [];
  const paidOf = new Map(paidRows.map((p) => [p.id, num(p.paid)]));

  const documents: ExportDocument[] = rows.map(({ inv, quoteNumber, creditedNumber }) => {
    const breakdown = inv.vat_breakdown as RateTotal[] | null;
    return {
      number: inv.number!,
      kind: inv.kind as InvoiceKind,
      status: inv.status as InvoiceStatus,
      issue_date: inv.issue_date!,
      due_date: inv.due_date,
      buyer_name: (inv.buyer as { name?: string } | null)?.name || 'Client',
      total_ht: num(inv.total_ht),
      total_vat: num(inv.total_vat),
      total_ttc: num(inv.total_ttc),
      vat_breakdown: (breakdown?.length ? breakdown : invoiceTotals(inv.lines as InvoiceLine[]).byRate)
        .map((r) => ({ rate: num(r.rate), base: num(r.base), vat: num(r.vat) })),
      paid: paidOf.get(inv.id) ?? 0,
      credited_number: creditedNumber ?? null,
      quote_number: quoteNumber ?? null,
    };
  });

  const payments: ExportPayment[] = payRows.map(({ pay, number, buyer }) => ({
    paid_on: pay.paid_on,
    amount: num(pay.amount),
    method: pay.method as PaymentMethod,
    note: pay.note,
    invoice_number: number!,
    buyer_name: (buyer as { name?: string } | null)?.name || 'Client',
  }));

  return { documents, payments, siret: company?.siret || company?.companySiret || null };
}
