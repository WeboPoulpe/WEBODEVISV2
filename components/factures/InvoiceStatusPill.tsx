import { cn } from '@/lib/utils';
import { INVOICE_STATUS_LABELS, type InvoiceKind, type InvoiceStatus } from '@/lib/invoices';

const TONES: Record<InvoiceStatus, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  emise: 'bg-primary-100 text-primary',
  payee_partiellement: 'bg-amber-50 text-amber-700',
  payee: 'bg-sage-100 text-sage',
  annulee: 'bg-gray-100 text-gray-500',
};

/** Libellé du statut : un avoir émis n'est pas « à encaisser », il est simplement « Émis ». */
export function invoiceStatusLabel(kind: InvoiceKind, status: InvoiceStatus): string {
  if (kind === 'avoir' && status !== 'brouillon') return 'Émis';
  return INVOICE_STATUS_LABELS[status] ?? status;
}

export default function InvoiceStatusPill({ kind, status, className }: { kind: InvoiceKind; status: InvoiceStatus; className?: string }) {
  const tone = kind === 'avoir' && status !== 'brouillon' ? 'bg-forest/10 text-forest' : TONES[status];
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', tone, className)}>
      {invoiceStatusLabel(kind, status)}
    </span>
  );
}
