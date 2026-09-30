'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { cardCls, errorCls } from '@/components/ui/kit';

// Mode courses : la liste de l'événement en grandes lignes à cocher, pour le magasin ou le marché.
interface Line {
  id: string;
  quantity: number;
  unit: string | null;
  checked: boolean;
  notes: string | null;
  ingredient: { id: string; name: string; category: string | null; image_url: string | null; unit: string | null } | null;
}

const OTHER = 'Divers';

export default function CoursesPage() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('quotes').select('client_name').eq('id', id).maybeSingle(),
      supabase.from('event_ingredients')
        .select('id, quantity, unit, checked, notes, ingredient:ingredients(id, name, category, image_url, unit)')
        .eq('quote_id', id).order('created_at'),
    ]).then(([quote, items]) => {
      if (items.error) setError('La liste n’a pas pu être chargée. Rechargez la page.');
      setTitle(quote.data?.client_name ?? '');
      setLines((items.data ?? []) as Line[]);
      setLoading(false);
    });
  }, [id]);

  const toggle = async (line: Line) => {
    const checked = !line.checked;
    setLines((list) => list.map((l) => (l.id === line.id ? { ...l, checked } : l)));
    const res = await createClient().from('event_ingredients').update({ checked }).eq('id', line.id);
    if (res.error) {
      setLines((list) => list.map((l) => (l.id === line.id ? { ...l, checked: !checked } : l)));
      setError('La case n’a pas pu être enregistrée. Vérifiez votre connexion.');
    } else {
      setError(null);
    }
  };

  const categories = useMemo(() => [...new Set(lines.map((l) => l.ingredient?.category ?? OTHER))].sort((a, b) => a.localeCompare(b, 'fr')), [lines]);
  const groups = useMemo(() => {
    const map = new Map<string, Line[]>();
    for (const l of lines) {
      const key = l.ingredient?.category ?? OTHER;
      if (category && key !== category) continue;
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'));
  }, [lines, category]);

  const done = lines.filter((l) => l.checked).length;
  const pct = lines.length ? Math.round((done / lines.length) * 100) : 0;
  const chip = (active: boolean) => cn('flex-shrink-0 h-9 px-4 rounded-full text-sm font-medium transition-colors',
    active ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700');

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 text-gray-400 animate-spin" /></div>;
  }

  return (
    <div className="px-4 md:px-6 pb-8 max-w-[720px]">
      <Link href={`/evenements/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />Retour à l’événement
      </Link>

      {/* Titre et avancement, toujours visibles pendant les courses */}
      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 pt-3 pb-3 bg-page">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold text-gray-900 leading-tight">Courses</h1>
            {title && <p className="text-sm text-gray-600 truncate">{title}</p>}
          </div>
          <p className="font-display text-2xl font-bold text-gray-900 tabular-nums whitespace-nowrap">{done}<span className="text-gray-400"> / {lines.length}</span></p>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 mt-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-sage transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none mt-3 -mx-4 md:-mx-6 px-4 md:px-6">
            <button onClick={() => setCategory(null)} className={chip(category === null)}>Tout</button>
            {categories.map((c) => <button key={c} onClick={() => setCategory(c === category ? null : c)} className={chip(category === c)}>{c}</button>)}
          </div>
        )}
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-3')}>{error}</p>}

      {lines.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-10 text-center')}>
          <p className="font-semibold text-gray-900">La liste de courses est vide</p>
          <p className="text-sm text-gray-600 mt-1">Calculez-la ou ajoutez des ingrédients depuis l’onglet Courses de l’événement.</p>
          <Link href={`/evenements/${id}`} className="inline-block mt-4 text-sm font-medium text-primary hover:underline">Ouvrir l’événement</Link>
        </div>
      ) : (
        <div className="space-y-6 mt-2">
          {groups.map(([name, items]) => (
            <section key={name}>
              <h2 className="flex items-baseline justify-between px-1 mb-2">
                <span className="text-base font-semibold text-gray-900">{name}</span>
                <span className="text-sm text-gray-500 tabular-nums">{items.filter((l) => l.checked).length} / {items.length}</span>
              </h2>
              <ul className="space-y-2">
                {items.map((line) => (
                  <li key={line.id}>
                    <button
                      onClick={() => toggle(line)}
                      aria-pressed={line.checked}
                      className={cn('w-full flex items-center gap-4 p-3 rounded-2xl border text-left transition-colors active:scale-[0.99]',
                        line.checked ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200')}
                    >
                      {line.ingredient?.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.ingredient.image_url} alt="" className={cn('h-14 w-14 rounded-xl object-cover flex-shrink-0', line.checked && 'opacity-40')} />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className={cn('block text-[17px] font-semibold leading-snug', line.checked ? 'line-through text-gray-400' : 'text-gray-900')}>
                          {line.ingredient?.name ?? 'Ingrédient supprimé'}
                        </span>
                        <span className={cn('block text-[15px] tabular-nums', line.checked ? 'text-gray-400' : 'text-gray-700')}>
                          {line.quantity} {line.unit ?? line.ingredient?.unit ?? ''}{line.notes ? `, ${line.notes}` : ''}
                        </span>
                      </span>
                      <span className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                        line.checked ? 'bg-sage text-white' : 'border-2 border-gray-300')}>
                        {line.checked && <Check className="h-5 w-5" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {done === lines.length && <p className="text-center text-[15px] font-medium text-sage">Tout est pris.</p>}
        </div>
      )}
    </div>
  );
}
