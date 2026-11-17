import { pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { originLabel } from '@/lib/origine';

/** « Instagram · bio » sur une demande ou un compte venu d'un lien Instagram ; rien sinon. */
export default function OriginPill({ origin }: { origin: string | null | undefined }) {
  if (!origin) return null;
  return <span className={cn(pill, 'bg-primary-50 text-primary-800')}>{originLabel(origin)}</span>;
}
