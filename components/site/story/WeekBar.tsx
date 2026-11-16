'use client';

import { useEffect, useRef, useState } from 'react';
import { DAYS } from '@/lib/site/story';
import { cn } from '@/lib/utils';
import { container } from '@/components/site/ui';

// La semaine, toujours sous les yeux : la barre reste collée sous l'en-tête et suit le défilement.
// Sans script, ce sont de simples liens d'ancre vers chaque jour.
export default function WeekBar() {
  const [active, setActive] = useState<string>(DAYS[0].id);
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
    }, { rootMargin: '-45% 0px -50% 0px' });
    for (const d of DAYS) {
      const el = document.getElementById(d.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Sur téléphone, la barre défile toute seule pour garder le jour en cours visible, sans bouger la page.
  useEffect(() => {
    const bar = list.current;
    const item = bar?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!bar || !item) return;
    bar.scrollTo({ left: item.offsetLeft - bar.clientWidth / 2 + item.clientWidth / 2, behavior: 'smooth' });
  }, [active]);

  return (
    <nav aria-label="La semaine de Julien" className="story-weekbar sticky z-30 border-b border-gray-200 bg-page/90 backdrop-blur">
      <div className={container}>
        <ol ref={list} className="story-weekbar-list relative -mx-5 flex gap-1.5 overflow-x-auto px-5 py-2.5 sm:mx-0 sm:px-0">
          {DAYS.map((d) => {
            const on = d.id === active;
            return (
              <li key={d.id} className="flex-shrink-0">
                <a
                  href={`#${d.id}`}
                  aria-current={on ? 'true' : undefined}
                  className={cn('inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors', on ? 'bg-forest font-semibold text-white' : 'text-gray-600 hover:text-gray-900')}
                >
                  {d.label}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
