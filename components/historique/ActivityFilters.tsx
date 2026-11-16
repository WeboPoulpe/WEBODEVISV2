'use client';

// Filtres de l'historique : période, personne, élément, action, recherche, tri.

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ACTION_LABELS, ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, ENTITY_LABELS } from '@/lib/activity';
import { btnSecondary, inputCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

export type Period = 'today' | '7' | '30' | 'all' | 'custom';
export interface FilterState {
  period: Period;
  from: string;
  to: string;
  actor: string;
  entity: string;
  action: string;
  q: string;
  order: 'desc' | 'asc';
}

const selectCls = cn(inputCls, 'py-2');

export default function ActivityFilters({ value, onChange, people }: {
  value: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  people: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  // Recherche : appliquée après une courte pause de frappe.
  const [q, setQ] = useState(value.q);
  useEffect(() => setQ(value.q), [value.q]);
  useEffect(() => {
    if (q === value.q) return;
    const t = setTimeout(() => onChange({ q }), 300);
    return () => clearTimeout(t);
  }, [q, value.q, onChange]);
  const active = [value.period !== '30', value.actor, value.entity, value.action].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (client, devis, personne…)"
          aria-label="Rechercher dans l’historique" className={cn(inputCls, 'flex-1')} />
        <button type="button" onClick={() => setOpen((o) => !o)} className={cn(btnSecondary, 'md:hidden')} aria-expanded={open}>
          <SlidersHorizontal className="h-4 w-4" /> Filtrer{active ? ` (${active})` : ''}
        </button>
      </div>
      <div className={cn('grid gap-2 sm:grid-cols-2 md:grid-cols-5', !open && 'hidden md:grid')}>
        <label className="block"><span className="sr-only">Période</span>
          <select value={value.period} onChange={(e) => onChange({ period: e.target.value as Period })} className={selectCls}>
            <option value="today">Aujourd’hui</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="all">Tout</option>
            <option value="custom">Dates choisies</option>
          </select>
        </label>
        <label className="block"><span className="sr-only">Personne</span>
          <select value={value.actor} onChange={(e) => onChange({ actor: e.target.value })} className={selectCls}>
            <option value="">Toutes les personnes</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value="client">Client et automatique</option>
          </select>
        </label>
        <label className="block"><span className="sr-only">Élément</span>
          <select value={value.entity} onChange={(e) => onChange({ entity: e.target.value })} className={selectCls}>
            <option value="">Tous les éléments</option>
            {ACTIVITY_ENTITIES.map((k) => <option key={k} value={k}>{ENTITY_LABELS[k].one}</option>)}
          </select>
        </label>
        <label className="block"><span className="sr-only">Action</span>
          <select value={value.action} onChange={(e) => onChange({ action: e.target.value })} className={selectCls}>
            <option value="">Toutes les actions</option>
            {ACTIVITY_ACTIONS.map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="block"><span className="sr-only">Tri</span>
          <select value={value.order} onChange={(e) => onChange({ order: e.target.value as 'desc' | 'asc' })} className={selectCls}>
            <option value="desc">Plus récent d’abord</option>
            <option value="asc">Plus ancien d’abord</option>
          </select>
        </label>
        {value.period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Du</span>
              <input type="date" value={value.from} onChange={(e) => onChange({ from: e.target.value })} className={selectCls} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Au</span>
              <input type="date" value={value.to} onChange={(e) => onChange({ to: e.target.value })} className={selectCls} /></label>
          </div>
        )}
      </div>
    </div>
  );
}
