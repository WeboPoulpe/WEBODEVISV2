import { ALLERGEN_LABELS, ALLERGENS, sortAllergens } from '@/lib/allergens';
import { cn } from '@/lib/utils';

// Liste compacte des allergènes, en lecture seule (dans une liste d'ingrédients, une ligne de prestation…).
// « suggested » : bordure en pointillé, ce n'est qu'une suggestion d'après le nom.

const DETAILS = Object.fromEntries(ALLERGENS.map((a) => [a.key, a.detail])) as Record<string, string>;

export default function AllergenBadges({ keys, suggested, max, className }: {
  keys: readonly string[];
  suggested?: boolean;
  /** Au-delà, un « +n » résume le reste. */
  max?: number;
  className?: string;
}) {
  const list = sortAllergens(keys);
  if (!list.length) return null;
  const shown = max != null && list.length > max ? list.slice(0, max) : list;
  const rest = list.length - shown.length;
  const badge = cn(
    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border',
    suggested ? 'border-dashed border-primary-400 text-primary-800 bg-white' : 'border-primary-100 bg-primary-50 text-primary-800',
  );
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)} aria-label={`Allergènes${suggested ? ' suggérés' : ''} : ${list.map((k) => ALLERGEN_LABELS[k]).join(', ')}`}>
      {shown.map((k) => (
        <span key={k} className={badge} aria-hidden title={[ALLERGEN_LABELS[k], DETAILS[k], suggested ? 'suggéré d’après le nom' : ''].filter(Boolean).join(', ')}>
          {ALLERGEN_LABELS[k]}
        </span>
      ))}
      {rest > 0 && (
        <span className={cn(badge, 'border-gray-200 bg-white text-gray-600')} aria-hidden title={list.slice(shown.length).map((k) => ALLERGEN_LABELS[k]).join(', ')}>
          +{rest}
        </span>
      )}
    </span>
  );
}
