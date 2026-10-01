'use client';

import { useEffect, useState } from 'react';
import { perGuestFromRatio, quantityFor, ratioFromPerGuest } from '@/lib/equipment';
import { cn } from '@/lib/utils';

// Quantité par couvert saisie comme on la dit : « 1 nappe pour 8 couverts ». La valeur échangée reste le nombre
// par couvert (1 pour 8 = 0,125) ; un exemple montre ce que ça donne pour un nombre de couverts.

const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const small = 'h-11 w-16 px-2 text-center text-base rounded-xl border border-gray-200 bg-white text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';

export default function PerGuestInput({ value, onChange, unit, id, compact, example = 100 }: {
  /** Quantité par couvert (0,125 = 1 pour 8). */
  value: number;
  onChange: (perGuest: number) => void;
  unit?: string | null;
  /** Préfixe des identifiants des deux champs (le premier reçoit `id`, l'autre `${id}-per`). */
  id: string;
  /** Version ligne de liste : sans phrase d'exemple. */
  compact?: boolean;
  /** Nombre de couverts de l'exemple. */
  example?: number;
}) {
  const initial = ratioFromPerGuest(value);
  const [count, setCount] = useState(String(initial.count));
  const [per, setPer] = useState(String(initial.per));

  // Une valeur changée de l'extérieur (article choisi dans la liste de base) remplace la saisie.
  useEffect(() => {
    const current = perGuestFromRatio(num(count), num(per));
    if (Math.abs(current - value) > 1e-9) {
      const r = ratioFromPerGuest(value);
      setCount(String(r.count)); setPer(String(r.per));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (c: string, p: string) => {
    setCount(c); setPer(p);
    const q = perGuestFromRatio(num(c), num(p));
    if (q > 0) onChange(q);
  };

  const q = perGuestFromRatio(num(count), num(per));
  const u = unit || 'pièce';
  const total = quantityFor(q, example);

  return (
    <div>
      <div className={cn('flex items-center flex-wrap gap-x-2 gap-y-1', compact ? 'text-sm' : 'text-[15px]')}>
        <input id={id} inputMode="decimal" value={count} onChange={(e) => update(e.target.value, per)} aria-label="Quantité" className={cn(small, compact && 'h-10 w-12')} />
        <span className="text-gray-700">{u}{num(count) > 1 && !/[sxz]$/.test(u) ? 's' : ''} pour</span>
        <input id={`${id}-per`} inputMode="numeric" value={per} onChange={(e) => update(count, e.target.value)} aria-label="Nombre de couverts" className={cn(small, compact && 'h-10 w-12')} />
        <span className="text-gray-700">couvert{num(per) > 1 ? 's' : ''}</span>
      </div>
      {!compact && (
        <p className="text-sm text-gray-500 mt-1.5" aria-live="polite">
          {q > 0 ? `Pour ${example} couverts : ${total} ${u}${total > 1 && !/[sxz]$/.test(u) ? 's' : ''} (arrondi au-dessus).` : 'Indiquez une quantité et un nombre de couverts.'}
        </p>
      )}
    </div>
  );
}
