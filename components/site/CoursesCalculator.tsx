'use client';

import { useId, useState } from 'react';
import { EXAMPLE_COURSES, courseTotal, frNumber } from '@/lib/site/coursesExample';
import { cn } from '@/lib/utils';

// Le calcul des courses, à manipuler : on choisit le nombre de couverts, les quantités suivent.
// `tone="dark"` sur le vert sapin de l'accueil, `tone="light"` dans un guide.

const MIN = 10;
const MAX = 300;
const PRESETS = [30, 80, 120, 200];

export default function CoursesCalculator({ tone = 'dark', initial = 120, className }: { tone?: 'dark' | 'light'; initial?: number; className?: string }) {
  const [guests, setGuests] = useState(initial);
  const id = useId();
  const dark = tone === 'dark';
  const [lead, ...rest] = EXAMPLE_COURSES;
  const pct = ((guests - MIN) / (MAX - MIN)) * 100;

  return (
    <div className={cn(dark ? 'text-white' : 'rounded-3xl border border-gray-200 bg-white p-6 sm:p-8', className)}>
      <p className="font-display">
        <span className="sr-only">{lead.per} grammes par personne, multipliés par {guests} couverts, font {courseTotal(lead.per, lead.unit, guests)}.</span>
        <span aria-hidden className={cn('site-figure block', dark ? 'text-white' : 'text-gray-900 site-figure-sm')}>{lead.per} g</span>
        <span aria-hidden className={cn('site-figure block tabular-nums', dark ? 'text-white/40' : 'text-gray-400 site-figure-sm')}>× {guests}</span>
        <span aria-hidden className={cn('site-figure block', dark ? 'text-primary-300' : 'text-primary site-figure-sm')}>{courseTotal(lead.per, lead.unit, guests)}</span>
      </p>
      <p className={cn('text-[15px] mt-5', dark ? 'text-white/55' : 'text-gray-500')}>{lead.name}, par convive. Données d’exemple.</p>

      <div className={cn('mt-8 rounded-3xl p-5 sm:p-6', dark ? 'bg-white/[0.07] ring-1 ring-white/10' : 'bg-page')}>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={id} className={cn('text-base font-semibold', dark ? 'text-white' : 'text-gray-900')}>Nombre de couverts</label>
          <output htmlFor={id} className={cn('font-display text-2xl font-bold tabular-nums', dark ? 'text-white' : 'text-gray-900')}>{frNumber(guests, 0)}</output>
        </div>
        <input
          id={id}
          type="range"
          min={MIN}
          max={MAX}
          step={5}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className={cn('site-range mt-4 w-full', dark && 'site-range-dark')}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGuests(n)}
              aria-pressed={guests === n}
              className={cn('h-9 px-3.5 rounded-full text-sm font-semibold transition-colors',
                guests === n
                  ? 'bg-primary text-white'
                  : dark ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300')}
            >
              {n} couverts
            </button>
          ))}
        </div>
        <ul className={cn('mt-6 divide-y', dark ? 'divide-white/10' : 'divide-gray-200')}>
          {rest.map((c) => (
            <li key={c.name} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 min-w-0 sm:flex sm:items-baseline sm:gap-3">
                <span className={cn('block sm:flex-1 text-[15px] leading-snug', dark ? 'text-white/80' : 'text-gray-700')}>{c.name}</span>
                <span className={cn('block text-sm tabular-nums', dark ? 'text-white/45' : 'text-gray-500')}>{c.per} {c.unit} / pers.</span>
              </span>
              <span className={cn('w-20 text-right font-display font-bold tabular-nums', dark ? 'text-white' : 'text-gray-900')}>{courseTotal(c.per, c.unit, guests)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
