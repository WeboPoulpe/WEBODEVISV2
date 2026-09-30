'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { btnPrimary, iconBtn, iconBtnDanger, inputCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { Check, EmptyState, ErrorBanner, Progress, useActionError, type ChecklistItem, type EventQuote } from './shared';

export default function ChecklistTab({ quote, onChange }: { quote: EventQuote; onChange: (items: ChecklistItem[]) => void }) {
  const items = quote.checklist ?? [];
  const [text, setText] = useState('');
  const { error, setError, check } = useActionError();

  // L'écran est mis à jour tout de suite ; si l'enregistrement échoue, on revient à l'état précédent.
  const save = async (next: ChecklistItem[]) => {
    const previous = items;
    onChange(next);
    const res = await createClient().from('quotes').update({ checklist: next }).eq('id', quote.id);
    if (!check(res, 'La checklist n’a pas pu être enregistrée. Vérifiez votre connexion et réessayez.')) onChange(previous);
  };

  const add = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    save([...items, { id: crypto.randomUUID(), text: value, done: false }]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  };

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une tâche" aria-label="Nouvelle tâche" className={inputCls} />
        <button type="submit" disabled={!text.trim()} className={cn(btnPrimary, 'h-12')}>
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">Ajouter</span>
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="Aucune tâche pour l’instant" hint="Notez ce qu’il reste à faire avant le jour J : commandes, confirmations, mise en place." />
      ) : (
        <>
          <Progress done={items.filter((i) => i.done).length} total={items.length} label={items.length > 1 ? 'tâches faites' : 'tâche faite'} />
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-2xl bg-gray-50">
                <Check checked={item.done} onChange={(done) => save(items.map((i) => (i.id === item.id ? { ...i, done } : i)))} label={item.text} />
                <span className={cn('flex-1 min-w-0 py-2 text-[15px] break-words', item.done ? 'line-through text-gray-400' : 'text-gray-900')}>{item.text}</span>
                <button onClick={() => move(index, -1)} disabled={index === 0} className={iconBtn} aria-label="Monter"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(index, 1)} disabled={index === items.length - 1} className={iconBtn} aria-label="Descendre"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => save(items.filter((i) => i.id !== item.id))} className={iconBtnDanger} aria-label={`Supprimer ${item.text}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
