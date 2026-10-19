// Export des factures en CSV pour Excel (version française) : séparateur « ; », décimales à virgule,
// dates JJ/MM/AAAA, et une marque BOM UTF-8 en tête pour que les accents s'affichent correctement.

import type { Invoice } from '@/server/invoices';
import { INVOICE_KIND_LABELS } from './invoices';
import { frDate } from './invoiceMentions';

type CsvInvoice = Pick<Invoice, 'number' | 'kind' | 'status' | 'issue_date' | 'due_date' | 'buyer' | 'total_ht' | 'total_vat' | 'total_ttc' | 'paid'>;

const amount = (n: number) => n.toFixed(2).replace('.', ',');
const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function invoicesCsv(invoices: readonly CsvInvoice[], statusLabel: (i: CsvInvoice) => string): string {
  const head = ['N°', 'Type', 'Date', 'Échéance', 'Client', 'HT', 'TVA', 'TTC', 'Payé', 'Statut'];
  const rows = invoices.map((i) => [
    i.number ?? 'Brouillon',
    INVOICE_KIND_LABELS[i.kind],
    frDate(i.issue_date),
    frDate(i.due_date),
    i.buyer?.name ?? '',
    amount(i.total_ht),
    amount(i.total_vat),
    amount(i.total_ttc),
    amount(i.paid),
    statusLabel(i),
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
