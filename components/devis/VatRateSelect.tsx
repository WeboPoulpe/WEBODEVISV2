'use client';

import { VAT_RATES, vatLabel } from '@/lib/vat';
import { lineVatRate } from '@/lib/quoteTotals';
import { cn } from '@/lib/utils';

// Petit sélecteur du taux de TVA d'une ligne de devis. Affiche par défaut le taux du
// devis ; choisir ce taux remet la ligne « au taux du devis » (onChange(null)), pour
// qu'elle suive ensuite tout changement du taux par défaut.
export default function VatRateSelect({ value, defaultRate, onChange, className }: {
  value?: number | null;
  defaultRate: number;
  onChange: (rate: number | null) => void;
  className?: string;
}) {
  const current = lineVatRate({ vatRate: value }, defaultRate);
  const rates = [...new Set<number>([...VAT_RATES, defaultRate, current])].sort((a, b) => b - a);
  return (
    <select
      value={String(current)}
      onChange={(e) => { const r = Number(e.target.value); onChange(r === defaultRate ? null : r); }}
      title="Taux de TVA de cette ligne"
      aria-label="Taux de TVA de cette ligne"
      className={cn(
        'text-[10px] border border-gray-200 rounded-md px-1 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
        current !== defaultRate ? 'text-primary font-semibold' : 'text-gray-500',
        className,
      )}
    >
      {rates.map((r) => (
        <option key={r} value={String(r)}>
          TVA {vatLabel(r)}{r === defaultRate ? ' (taux du devis)' : ''}
        </option>
      ))}
    </select>
  );
}
