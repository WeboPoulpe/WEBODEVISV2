import { cn } from '@/lib/utils';
import { isConfirmed, isRejected, quoteStatusLabel } from '@/lib/quoteStatus';

/** Statut d'un devis : sauge s'il est confirmé, neutre s'il est refusé, terracotta clair s'il est en cours. */
export default function StatusPill({ status, className }: { status: string; className?: string }) {
  const tone = isConfirmed(status) ? 'bg-sage-100 text-sage' : isRejected(status) ? 'bg-gray-100 text-gray-600' : 'bg-primary-100 text-primary';
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', tone, className)}>
      {quoteStatusLabel(status)}
    </span>
  );
}
