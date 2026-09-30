'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { setMissionCourseChecked, type MissionCourses } from '@/server/missions';
import { cn } from '@/lib/utils';

type Line = MissionCourses['lines'][number];

const amount = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export default function CoursesChecklist({ token, quoteId, initial }: { token: string; quoteId: string; initial: Line[] }) {
  const [lines, setLines] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const bySupplier = new Map<string, Line[]>();
    for (const l of lines) {
      const key = l.supplier ?? 'Sans fournisseur';
      bySupplier.set(key, [...(bySupplier.get(key) ?? []), l]);
    }
    return [...bySupplier.entries()].sort(([a], [b]) => Number(a === 'Sans fournisseur') - Number(b === 'Sans fournisseur'));
  }, [lines]);
  const taken = lines.filter((l) => l.checked).length;

  const toggle = async (line: Line) => {
    const checked = !line.checked;
    setError(null);
    setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, checked } : l)));
    const res = await setMissionCourseChecked(token, quoteId, line.id, checked).catch(() => ({ error: 'La coche n’a pas été enregistrée. Vérifiez votre connexion.' }));
    if (res.error) {
      setError(res.error);
      setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, checked: !checked } : l)));
    }
  };

  if (lines.length === 0) {
    return <p className="mt-8 rounded-2xl bg-white border border-gray-200 px-5 py-8 text-[15px] text-gray-600">La liste de courses de cet événement n’est pas encore prête.</p>;
  }

  return (
    <div className="mt-5">
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-page">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900 tabular-nums">{taken} sur {lines.length} articles pris</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 mt-2 overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(taken / lines.length) * 100}%` }} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-danger bg-white border border-danger/30 rounded-xl px-4 py-3 mb-3">{error}</p>}

      <div className="space-y-6 mt-2">
        {groups.map(([supplier, items]) => (
          <section key={supplier}>
            <h2 className="px-1 mb-2 text-[15px] font-semibold text-gray-900">{supplier}</h2>
            <ul className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
              {items.map((l) => (
                <li key={l.id}>
                  <button onClick={() => toggle(l)} role="checkbox" aria-checked={l.checked} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left">
                    <span aria-hidden className={cn('flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors', l.checked ? 'bg-primary border-primary text-white' : 'border-gray-300')}>
                      {l.checked && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cn('block font-medium', l.checked ? 'text-gray-400 line-through' : 'text-gray-900')}>{l.name}</span>
                      {l.notes && <span className="block text-sm text-gray-500">{l.notes}</span>}
                    </span>
                    <span className={cn('font-semibold tabular-nums whitespace-nowrap', l.checked ? 'text-gray-400' : 'text-gray-900')}>
                      {amount(l.quantity)} {l.unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
