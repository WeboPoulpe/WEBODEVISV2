'use client';

// Piocher des prestations du catalogue pour la brochure : recherche, groupées par catégorie, cases à cocher.

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, inputCls } from '@/components/ui/kit';
import type { CatalogPrestation } from '@/lib/brochure';

export const categoryLabel = (c: string | null) => (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Autres prestations');

export default function PrestationPicker({ catalog, already, onAdd, onClose }: {
  catalog: CatalogPrestation[];
  /** Prestations déjà dans la brochure (cochées et grisées). */
  already: Set<string>;
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, CatalogPrestation[]>();
    for (const p of catalog) {
      if (q && !p.name.toLowerCase().includes(q)) continue;
      const key = categoryLabel(p.category);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [catalog, search]);

  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <Modal title="Ajouter des prestations" onClose={onClose} wide
      footer={<>
        <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
        <button type="button" onClick={() => onAdd([...picked])} disabled={picked.size === 0} className={btnPrimary}>Ajouter ({picked.size})</button>
      </>}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une prestation" aria-label="Rechercher une prestation" className={inputCls} />
      <div className="mt-3 max-h-[55vh] overflow-y-auto space-y-4">
        {groups.length === 0 && <p className="text-sm text-gray-500">Aucune prestation ne correspond.</p>}
        {groups.map(([label, items]) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</p>
            <ul className="space-y-1">
              {items.map((p) => {
                const inside = already.has(p.id);
                return (
                  <li key={p.id}>
                    <label className={`flex items-center gap-3 rounded-xl px-3 py-2 ${inside ? 'text-gray-400' : 'hover:bg-gray-50 cursor-pointer'}`}>
                      <input type="checkbox" className="h-4 w-4 accent-primary" disabled={inside} checked={inside || picked.has(p.id)} onChange={() => toggle(p.id)} />
                      <span className="flex-1">{p.name}{inside && ' (déjà dans la brochure)'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
