'use client';

import { useState } from 'react';
import { euros } from '@/lib/pricing';
import { STORY, clampGuests, quoteLines, quoteTotalTtc } from '@/lib/site/story';
import { cn } from '@/lib/utils';

// Lundi, 9 h : le devis du mariage. On change le nombre de convives, le prix suit.
export default function QuoteStepper({ className }: { className?: string }) {
  const [guests, setGuests] = useState<number>(STORY.guests);
  const change = (delta: number) => setGuests((g) => clampGuests(g + delta));
  const btn = 'flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-xl font-semibold text-white hover:bg-primary-dark disabled:opacity-40 transition-colors';

  return (
    <div className={cn('rounded-[24px] bg-white p-6 shadow-[0_24px_48px_-28px_rgb(var(--n-900)/0.4)] ring-1 ring-black/5', className)}>
      <p className="text-sm text-gray-500">Devis, à essayer</p>
      <p className="font-display text-[22px] font-semibold text-gray-900">Mariage {STORY.couple}</p>

      <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-primary-50 p-2 pl-4">
        <span className="flex-1 text-[15px] text-gray-800">Convives</span>
        <button type="button" className={btn} onClick={() => change(-STORY.step)} disabled={guests <= STORY.minGuests} aria-label={`Retirer ${STORY.step} convives`}>−</button>
        <output className="min-w-[3ch] text-center text-xl font-bold text-gray-900 tabular-nums">{guests}</output>
        <button type="button" className={btn} onClick={() => change(STORY.step)} disabled={guests >= STORY.maxGuests} aria-label={`Ajouter ${STORY.step} convives`}>+</button>
      </div>

      <dl className="mt-3" aria-live="polite">
        {quoteLines(guests).map((l) => (
          <div key={l.label} className="flex items-baseline justify-between gap-3 border-t border-gray-200 py-2.5 text-[15px]">
            <dt className="text-gray-700">{l.label}</dt>
            <dd className="tabular-nums whitespace-nowrap text-gray-900">{euros(l.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-gray-200 pt-3 text-lg font-bold text-gray-900">
          <dt>Total TTC</dt>
          <dd className="tabular-nums whitespace-nowrap">{euros(quoteTotalTtc(guests))}</dd>
        </div>
      </dl>
    </div>
  );
}
