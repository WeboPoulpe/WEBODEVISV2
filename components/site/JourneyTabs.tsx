'use client';

import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Une affaire en trois étapes (demande, devis, événement), en onglets : une seule étape à l'écran,
// la frise en haut montre où l'on en est. Tous les panneaux restent dans la page (lecture et référencement),
// seul l'actif est affiché.

export type JourneyStep = {
  key: string;
  label: string;
  title: string;
  body: ReactNode;
  link: { href: string; label: string };
  preview: ReactNode;
};

export default function JourneyTabs({ steps }: { steps: JourneyStep[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? steps.length - 1 : (active + delta + steps.length) % steps.length;
    if (!delta && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Les étapes d’une affaire" onKeyDown={onKey} className="relative grid grid-cols-3 gap-2 sm:gap-4">
        {/* Le fil de la frise, rempli jusqu'à l'étape active */}
        <div aria-hidden className="absolute left-[16.6%] right-[16.6%] top-[22px] h-[3px] rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${(active / (steps.length - 1)) * 100}%` }} />
        </div>
        {steps.map((s, i) => {
          const on = i === active;
          const done = i < active;
          return (
            <button
              key={s.key}
              ref={(el) => { tabs.current[i] = el; }}
              id={`${base}-tab-${s.key}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={`${base}-panel-${s.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className="group relative flex flex-col items-center gap-3 rounded-2xl pb-2 text-center"
            >
              <span className={cn(
                'relative z-10 flex h-12 w-12 items-center justify-center rounded-full font-display text-lg font-bold transition-all duration-300',
                on ? 'bg-primary text-white scale-110 shadow-[0_10px_24px_-10px_rgb(var(--p-700)/0.8)]'
                  : done ? 'bg-primary-100 text-primary-800' : 'bg-white text-gray-500 ring-1 ring-gray-200 group-hover:ring-gray-300',
              )}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={cn('text-[15px] sm:text-base font-semibold transition-colors', on ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700')}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {steps.map((s, i) => (
        <div
          key={s.key}
          id={`${base}-panel-${s.key}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${s.key}`}
          hidden={i !== active}
          className={cn(i === active ? 'grid' : 'hidden', 'site-tab-panel mt-10 md:mt-14 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-16 gap-y-10 lg:items-center')}
        >
          <div>
            <h3 className="site-h2">{s.title}</h3>
            <div className="site-body text-gray-700 mt-6 max-w-[52ch] space-y-4">{s.body}</div>
            <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={s.link.href} className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{s.link.label}</Link>
              {i < steps.length - 1 && (
                <button type="button" onClick={() => setActive(i + 1)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-forest text-white text-[15px] font-semibold hover:bg-forest-soft transition-colors">
                  Étape suivante&nbsp;: {steps[i + 1].label.toLowerCase()} <span aria-hidden>→</span>
                </button>
              )}
            </p>
          </div>
          <div>{s.preview}</div>
        </div>
      ))}
    </div>
  );
}
