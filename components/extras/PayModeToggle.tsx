'use client';

// Choix de la rémunération d'un extra : à l'heure (taux horaire) ou au forfait (montant fixe par mission).

import { cn } from '@/lib/utils';
import type { MissionPay } from '@/lib/staffCost';

export type PayMode = MissionPay['mode'];

const OPTIONS: { value: PayMode; label: string }[] = [
  { value: 'heure', label: 'À l’heure' },
  { value: 'forfait', label: 'Au forfait' },
];

export default function PayModeToggle({ value, onChange, label, className }: {
  value: PayMode;
  onChange: (mode: PayMode) => void;
  /** Nom du groupe pour les lecteurs d'écran : « Rémunération de Julie ». */
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl bg-gray-100 p-0.5', className)}>
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn(
            'min-h-9 px-3 rounded-[10px] text-sm transition-colors',
            value === o.value ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-600 hover:text-gray-900',
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
