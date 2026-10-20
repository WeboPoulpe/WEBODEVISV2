'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFirstSteps, type FirstStepsData } from '@/server/onboarding';
import { cardCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Carte « Vos premiers pas » du tableau de bord : les sept étapes qui rendent le compte prêt,
// chacune avec un lien vers l'endroit où la faire. Elle disparaît quand tout est fait,
// ou sur cet appareil si la personne la masque.

const hiddenKey = (userId: string) => `webodevis:premiers-pas-masques:${userId}`;

export default function FirstSteps() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<FirstStepsData | null>(null);
  // Masquée tant que le choix enregistré sur l'appareil n'est pas lu (après le premier rendu).
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let wasHidden = false;
    try { wasHidden = window.localStorage.getItem(hiddenKey(userId)) === '1'; } catch { /* stockage indisponible : la carte reste visible */ }
    setHidden(wasHidden);
    if (wasHidden) return;
    let alive = true;
    getFirstSteps().then((d) => { if (alive) setData(d); }).catch(() => { /* la carte n'est qu'une aide : rien à afficher en cas d'échec */ });
    return () => { alive = false; };
  }, [userId]);

  if (hidden || !data || data.done >= data.total) return null;

  const hide = () => {
    setHidden(true);
    try { if (userId) window.localStorage.setItem(hiddenKey(userId), '1'); } catch { /* masquée pour cette visite seulement */ }
  };
  const next = data.steps.find((s) => !s.done)?.key;

  return (
    <section className={cn(cardCls, 'p-4 sm:p-5')} aria-labelledby="first-steps-title" data-testid="first-steps">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="first-steps-title" className="text-xl font-semibold text-gray-900">Vos premiers pas</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.done} sur {data.total} : il reste {data.total - data.done === 1 ? 'une étape' : `${data.total - data.done} étapes`} pour un compte prêt à l’emploi
          </p>
        </div>
        <button onClick={hide} className="flex-shrink-0 min-h-10 px-2 -mr-2 -mt-1 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors">
          Masquer
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.done} aria-label="Étapes faites">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((data.done / data.total) * 100)}%` }} />
      </div>

      <ol className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-x-4">
        {data.steps.map((s, i) => (
          <li key={s.key} data-step={s.key} data-done={s.done || undefined}>
            <Link href={s.href} className="flex items-center gap-3 py-2.5 min-h-14 rounded-xl group">
              <span aria-hidden className={cn(
                'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold tabular-nums',
                s.done ? 'bg-sage-100 text-sage' : s.key === next ? 'bg-primary text-white' : 'border border-gray-300 text-gray-500',
              )}>
                {s.done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className={cn('block text-[15px] font-medium transition-colors', s.done ? 'text-gray-500' : 'text-gray-900 group-hover:text-primary')}>
                  {s.label}{s.done && <span className="sr-only"> (fait)</span>}
                </span>
                {!s.done && <span className="block text-sm text-gray-500">{s.hint}</span>}
              </span>
              {!s.done && <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 group-hover:text-primary" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
