export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getInvoice, type Invoice } from '@/server/invoices';
import InvoiceDocument from '@/components/factures/InvoiceDocument';
import InvoicePrintToolbar from '@/components/factures/InvoicePrintToolbar';

// Facture imprimable : le document seul, au format A4. Le bouton « Imprimer / PDF » de la fiche ouvre cette page.

export const metadata: Metadata = { title: 'Facture – WeboDevis', robots: { index: false } };

// La feuille globale masque tout à l'impression (body * invisible, @page sans marge) : on rend le document visible
// et on lui donne ses propres marges.
const CSS = `
  html, body { background: #EFEBE3; }
  .invoice-sheet { box-shadow: 0 1px 3px rgba(28,38,33,.12); }
  @media print {
    html, body { background: #fff !important; }
    .invoice-document, .invoice-document * { visibility: visible !important; }
    .invoice-document { position: absolute !important; top: 0; left: 0; width: 210mm !important; max-width: none !important; min-height: 297mm; padding: 14mm !important; }
  }
  @media screen and (min-width: 640px) { .invoice-sheet { min-height: 297mm; margin-bottom: 32px; } }
`;

export default async function ImprimerFacturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let invoice: Invoice | null = null;
  try {
    invoice = await getInvoice(id);
  } catch {
    invoice = null;
  }
  if (!invoice) notFound();

  return (
    <>
      <style>{CSS}</style>
      <InvoicePrintToolbar invoiceId={invoice.id} />
      <InvoiceDocument invoice={invoice} className="invoice-sheet" />
    </>
  );
}
