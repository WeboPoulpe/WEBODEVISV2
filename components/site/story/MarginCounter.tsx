'use client';

import { useEffect, useRef, useState } from 'react';
import { euros } from '@/lib/pricing';
import { MARGIN } from '@/lib/site/story';
import { cn } from '@/lib/utils';
import { useEntrance } from './useEntrance';

const DURATION = 1400;

// Lundi suivant : la marge du mariage, en très grand. Rendue à sa valeur ; elle monte quand on arrive dessus.
export default function MarginCounter({ className }: { className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const entrance = useEntrance(ref);
  const [value, setValue] = useState(MARGIN);

  useEffect(() => {
    if (entrance === 'before') setValue(0);
    if (entrance !== 'run') return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setValue(Math.round(MARGIN * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [entrance]);

  return (
    <p ref={ref} className={cn('font-display font-semibold leading-none text-sage tabular-nums', className)}>
      <span aria-hidden>{euros(value)}</span>
      <span className="sr-only">{euros(MARGIN)}</span>
    </p>
  );
}
