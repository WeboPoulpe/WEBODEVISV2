'use client';

import { useEffect, useRef, useState } from 'react';
import { CHECKED, CHECKLIST } from '@/lib/site/story';
import { cn } from '@/lib/utils';
import { useEntrance } from './useEntrance';

// Samedi : la checklist du chargement. Rendue déjà cochée ; quand on arrive dessus, elle se coche ligne à ligne.
export default function AutoChecklist({ className }: { className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const entrance = useEntrance(ref);
  const [ticked, setTicked] = useState(CHECKED);

  useEffect(() => {
    if (entrance === 'before') setTicked(0);
    if (entrance !== 'run') return;
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      setTicked(n);
      if (n >= CHECKED) window.clearInterval(timer);
    }, 600);
    return () => window.clearInterval(timer);
  }, [entrance]);

  return (
    <ul ref={ref} aria-label="Checklist du chargement" className={cn('rounded-[24px] bg-white px-6 py-2 ring-1 ring-black/5', className)}>
      {CHECKLIST.map((line, i) => {
        const done = i < ticked;
        return (
          <li key={line} data-done={done} className={cn('flex items-center gap-3.5 border-b border-gray-200 py-3.5 text-base transition-colors duration-300 last:border-b-0', done ? 'text-gray-500 line-through' : 'text-gray-900')}>
            <span aria-hidden className={cn('flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[7px] border-2 text-sm text-white transition-colors duration-300', done ? 'border-sage bg-sage' : 'border-gray-300')}>
              {done && '✓'}
            </span>
            <span>{line}</span>
            <span className="sr-only">{done ? ', fait' : ', à faire'}</span>
          </li>
        );
      })}
    </ul>
  );
}
