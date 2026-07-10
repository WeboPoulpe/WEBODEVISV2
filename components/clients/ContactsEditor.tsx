'use client';

import { Plus, Trash2, Star } from 'lucide-react';
import type { ContactDraft } from '@/lib/customerContacts';

const EMPTY: ContactDraft = { name: '', role: '', email: '', phone: '', notes: '', is_primary: false };

export default function ContactsEditor({
  value, onChange,
}: { value: ContactDraft[]; onChange: (next: ContactDraft[]) => void }) {
  const update = (i: number, patch: Partial<ContactDraft>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setPrimary = (i: number) =>
    onChange(value.map((c, idx) => ({ ...c, is_primary: idx === i })));
  const add = () => onChange([...value, { ...EMPTY, is_primary: value.length === 0 }]);
  const remove = (i: number) => {
    const next = value.filter((_, idx) => idx !== i);
    if (next.length > 0 && !next.some((c) => c.is_primary)) next[0].is_primary = true;
    onChange(next);
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9c27b0]/30 focus:border-[#9c27b0]';

  return (
    <div className="space-y-3">
      {value.map((c, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <button
              type="button" onClick={() => setPrimary(i)}
              className={`flex items-center gap-1 text-xs font-medium ${c.is_primary ? 'text-amber-600' : 'text-gray-400 hover:text-amber-600'}`}
              title="Contact principal"
            >
              <Star className={`h-3.5 w-3.5 ${c.is_primary ? 'fill-amber-500 text-amber-500' : ''}`} />
              {c.is_primary ? 'Principal' : 'Définir principal'}
            </button>
            <button type="button" onClick={() => remove(i)} className="p-1 text-gray-300 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className={input} placeholder="Nom *" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
            <input className={input} placeholder="Rôle (ex. Décideur)" value={c.role} onChange={(e) => update(i, { role: e.target.value })} />
            <input className={input} placeholder="Email" type="email" value={c.email} onChange={(e) => update(i, { email: e.target.value })} />
            <input className={input} placeholder="Téléphone" value={c.phone} onChange={(e) => update(i, { phone: e.target.value })} />
          </div>
          <input className={input} placeholder="Notes" value={c.notes} onChange={(e) => update(i, { notes: e.target.value })} />
        </div>
      ))}
      <button type="button" onClick={add}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#9c27b0] border border-dashed border-[#9c27b0]/40 rounded-lg hover:bg-purple-50">
        <Plus className="h-3.5 w-3.5" /> Ajouter un contact
      </button>
    </div>
  );
}
