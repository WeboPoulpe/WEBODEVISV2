import type { Invoice } from '@/server/invoices';
import { INVOICE_KIND_LABELS, lineHT } from '@/lib/invoices';
import { frDate, invoiceMentions, sellerIdentityLine } from '@/lib/invoiceMentions';
import { vatLabel } from '@/lib/vat';
import { cn, formatCurrency } from '@/lib/utils';

// Document de facture façon feuille A4 : le même rendu à l'écran (aperçu, brouillon en cours d'édition)
// et à l'impression (app/(print)/factures/[id]/imprimer). Aucun état : il ne fait qu'afficher la facture reçue.
// Classe .invoice-document : c'est elle que la feuille d'impression garde visible.

export type InvoiceDocumentData = Pick<Invoice,
  'kind' | 'status' | 'number' | 'issue_date' | 'due_date' | 'service_date' | 'seller' | 'buyer' | 'lines'
  | 'total_ht' | 'total_vat' | 'total_ttc' | 'vat_breakdown' | 'notes' | 'quote_number' | 'credited_invoice_number' | 'paid'>;

/** « Facture d'acompte n° F-2026-0001 », ou « Brouillon de facture » tant qu'elle n'est pas émise. */
export function invoiceTitle(inv: Pick<Invoice, 'kind' | 'status' | 'number'>): string {
  if (inv.status === 'brouillon' || !inv.number) return inv.kind === 'avoir' ? 'Brouillon d’avoir' : 'Brouillon de facture';
  return `${INVOICE_KIND_LABELS[inv.kind]} n° ${inv.number}`;
}

const euros = (n: number) => formatCurrency(n);
const qty = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });

function Multiline({ text, className }: { text?: string | null; className?: string }) {
  if (!text?.trim()) return null;
  return <p className={cn('whitespace-pre-line', className)}>{text.trim()}</p>;
}

export default function InvoiceDocument({ invoice: inv, className }: { invoice: InvoiceDocumentData; className?: string }) {
  const { seller, buyer } = inv;
  const identity = sellerIdentityLine(seller);
  const mentions = invoiceMentions(inv);
  const remaining = Math.round((inv.total_ttc - inv.paid) * 100) / 100;
  const draft = inv.status === 'brouillon';

  return (
    <article className={cn('invoice-document relative bg-white text-[#1C2621] w-full max-w-[210mm] mx-auto px-5 py-6 sm:px-[14mm] sm:py-[14mm] text-[12.5px] leading-relaxed flex flex-col', className)}
      aria-label={invoiceTitle(inv)}>
      {draft && (
        <p className="absolute top-3 right-4 sm:right-[14mm] text-[11px] font-semibold uppercase tracking-wider text-primary">Brouillon, sans valeur de facture</p>
      )}

      {/* Vendeur et titre */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div className="min-w-0 space-y-0.5">
          {seller.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.logoUrl} alt={`Logo ${seller.name}`} className="max-h-16 max-w-[180px] object-contain mb-3" />
          )}
          <p className="text-[15px] font-semibold">{seller.name}</p>
          <Multiline text={seller.address} className="text-gray-700" />
          {(seller.phone || seller.email) && <p className="text-gray-700 break-words">{[seller.phone, seller.email].filter(Boolean).join(' · ')}</p>}
          {seller.siret && <p className="text-gray-700">SIRET {seller.siret}</p>}
          {!seller.vatExempt && seller.vatNumber && <p className="text-gray-700">N° TVA {seller.vatNumber}</p>}
        </div>
        <div className="sm:text-right sm:max-w-[48%]">
          <h1 className="font-display text-[22px] sm:text-[24px] font-bold leading-tight">{invoiceTitle(inv)}</h1>
          <dl className="mt-2 grid grid-cols-[auto_1fr] sm:inline-grid gap-x-3 gap-y-0.5 text-left">
            <dt className="text-gray-600">Date d’émission</dt><dd className="sm:text-right">{inv.issue_date ? frDate(inv.issue_date) : 'à l’émission'}</dd>
            {inv.kind !== 'avoir' && <><dt className="text-gray-600">Échéance</dt><dd className="sm:text-right">{inv.due_date ? frDate(inv.due_date) : 'à l’émission'}</dd></>}
            {inv.service_date && <><dt className="text-gray-600">Date de la prestation</dt><dd className="sm:text-right">{frDate(inv.service_date)}</dd></>}
          </dl>
        </div>
      </div>

      {/* Client et références */}
      <div className="mt-7 flex flex-col sm:flex-row sm:justify-between gap-5">
        <div className="text-gray-700 space-y-0.5 sm:order-2 sm:w-[48%] rounded-xl border border-gray-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Facturé à</p>
          <p className="text-[14px] font-semibold text-[#1C2621]">{buyer.name || 'Client'}</p>
          <Multiline text={buyer.address} />
          {buyer.email && <p className="break-words">{buyer.email}</p>}
          {buyer.isCompany && buyer.siret && <p>SIRET {buyer.siret}</p>}
          {buyer.isCompany && buyer.vatNumber && <p>N° TVA {buyer.vatNumber}</p>}
        </div>
        <div className="text-gray-700 space-y-0.5 sm:order-1 self-end sm:self-auto w-full sm:w-auto">
          {inv.quote_number && <p>Devis n° {inv.quote_number}</p>}
          {inv.kind === 'avoir' && inv.credited_invoice_number && <p className="font-semibold text-[#1C2621]">Annule la facture n° {inv.credited_invoice_number}</p>}
        </div>
      </div>

      {/* Lignes */}
      <table className="mt-7 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-[#1C2621] text-[11px] uppercase tracking-wider text-gray-600">
            <th className="py-2 pr-2 text-left font-semibold">Désignation</th>
            <th className="py-2 px-2 text-right font-semibold">Qté</th>
            <th className="hidden sm:table-cell py-2 px-2 text-right font-semibold">PU HT</th>
            <th className="hidden sm:table-cell py-2 px-2 text-right font-semibold">TVA</th>
            <th className="py-2 pl-2 text-right font-semibold">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-center text-gray-500">Aucune ligne</td></tr>
          )}
          {inv.lines.map((l, i) => (
            <tr key={i} className="border-b border-gray-200 align-top break-inside-avoid">
              <td className="py-2 pr-2">
                <p className="font-medium">{l.label}</p>
                <Multiline text={l.description} className="text-gray-600 text-[11.5px]" />
                <p className="sm:hidden text-gray-600 text-[11.5px]">{euros(l.unitPrice)} HT l’unité, TVA {vatLabel(l.vatRate)}</p>
              </td>
              <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{qty(l.quantity)}</td>
              <td className="hidden sm:table-cell py-2 px-2 text-right tabular-nums whitespace-nowrap">{euros(l.unitPrice)}</td>
              <td className="hidden sm:table-cell py-2 px-2 text-right tabular-nums whitespace-nowrap">{vatLabel(l.vatRate)}</td>
              <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">{euros(lineHT(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totaux */}
      <div className="mt-4 flex justify-end break-inside-avoid">
        <dl className="w-full sm:w-[62%] grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>Total HT</dt><dd className="text-right tabular-nums">{euros(inv.total_ht)}</dd>
          {!seller.vatExempt && inv.vat_breakdown.map((r) => (
            <div key={r.rate} className="contents">
              <dt className="text-gray-700">TVA {vatLabel(r.rate)} <span className="text-gray-500">sur {euros(r.base)}</span></dt>
              <dd className="text-right tabular-nums">{euros(r.vat)}</dd>
            </div>
          ))}
          {seller.vatExempt && <><dt className="text-gray-700">TVA</dt><dd className="text-right">non applicable</dd></>}
          <dt className="mt-1 pt-2 border-t-2 border-[#1C2621] font-semibold text-[14px]">Total TTC</dt>
          <dd className="mt-1 pt-2 border-t-2 border-[#1C2621] text-right font-display font-bold text-[17px] tabular-nums">{euros(inv.total_ttc)}</dd>
          {inv.paid > 0 && inv.kind !== 'avoir' && (
            <>
              <dt className="text-gray-700">Déjà réglé</dt><dd className="text-right tabular-nums">{euros(inv.paid)}</dd>
              <dt className="font-semibold">Reste à payer</dt><dd className="text-right font-semibold tabular-nums">{euros(Math.max(0, remaining))}</dd>
            </>
          )}
        </dl>
      </div>

      <Multiline text={inv.notes} className="mt-6 text-gray-700 break-inside-avoid" />

      {/* Mentions légales */}
      <footer className="mt-auto pt-8 break-inside-avoid">
        <div className="pt-3 border-t border-gray-300 text-[10.5px] leading-snug text-gray-600 space-y-0.5">
          {identity && <p className="font-medium text-gray-700">{seller.name} · {identity}</p>}
          {mentions.map((m) => <p key={m}>{m}</p>)}
        </div>
      </footer>
    </article>
  );
}
