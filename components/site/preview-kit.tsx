import { cn } from '@/lib/utils';

// Briques communes aux aperçus d'interface du site. Ce sont des images construites en code :
// mêmes formes que l'app, données inventées, aucune interaction.

export const previewCard = 'bg-white border border-gray-200 rounded-2xl';

const TONES = {
  terracotta: 'bg-primary-100 text-primary',
  sage: 'bg-sage-100 text-sage',
  neutral: 'bg-gray-100 text-gray-600',
  solid: 'bg-primary text-white',
} as const;

/** Étiquette en pastille, comme celles des devis et des événements dans l'app. */
export function Pill({ tone = 'terracotta', className, children }: { tone?: keyof typeof TONES; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Enveloppe d'un aperçu : annoncée comme une image aux lecteurs d'écran, avec sa description. */
export function Preview({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn('select-none', className)}>
      {children}
    </div>
  );
}
