'use client';

import { useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { errorCls } from '@/components/ui/kit';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ServiceLine {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category?: string;
  isPageBreak?: boolean;
  removed?: boolean;
}

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface MaterialItem { id: string; name: string; qty: number; unit: string; checked?: boolean }
export interface Supplier { id: string; name: string }

export interface EventQuote {
  id: string;
  client_name: string;
  event_type: string;
  event_date: string | null;
  event_location: string | null;
  guest_count: number | null;
  total_amount: number | null;
  status: string;
  services: ServiceLine[] | null;
  checklist: ChecklistItem[] | null;
  event_materials: MaterialItem[] | null;
  event_material_checks: string[] | null;
}

// ── Erreurs ───────────────────────────────────────────────────────────────────
type DbResult = { error: { message: string } | null };

/**
 * Suivi des erreurs d'enregistrement d'un onglet. `check` renvoie true si l'opération a réussi ;
 * sinon il affiche le message et l'appelant annule sa mise à jour d'écran.
 */
export function useActionError() {
  const [error, setError] = useState<string | null>(null);
  const check = useCallback((res: DbResult, message: string) => {
    if (res.error) { setError(message); return false; }
    setError(null);
    return true;
  }, []);
  return { error, setError, check };
}

export function ErrorBanner({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className={`${errorCls} flex items-start justify-between gap-3`}>
      <span>{message}</span>
      <button onClick={onClose} aria-label="Fermer le message" className="flex-shrink-0 text-danger/70 hover:text-danger"><X className="h-4 w-4" /></button>
    </div>
  );
}

// ── Présentation ──────────────────────────────────────────────────────────────
export function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-gray-600">{done} sur {total} {label}</span>
        <span className="font-semibold text-gray-900 tabular-nums">{pct} %</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 mt-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-sage transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center">
      <p className="font-medium text-gray-900">{title}</p>
      {hint && <p className="text-sm text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

/** Case à cocher large, confortable au doigt. */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
      className="h-6 w-6 rounded-md accent-sage cursor-pointer flex-shrink-0"
    />
  );
}

// ── Utilitaires ───────────────────────────────────────────────────────────────
export const money = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

/** Échappe un texte saisi par l'utilisateur avant de l'insérer dans une page à imprimer. */
export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Ouvre une page à imprimer dans un nouvel onglet. Renvoie false si le navigateur a bloqué l'ouverture. */
export function printDocument(title: string, body: string): boolean {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc(title)}</title>
    <style>@page{size:A4;margin:18mm}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    body{font-family:Georgia,serif;color:#1b1a17;margin:0;background:#fff}h1{font-size:18px;margin:0 0 4px}
    h2{font-size:14px;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #e6dfd3}
    table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;background:#f3eee6;padding:6px 8px}
    td{padding:6px 8px;border-bottom:1px solid #f0ebe2}.r{text-align:right}.muted{color:#78736a;font-size:11px}</style></head>
    <body><h1>${esc(title)}</h1>${body}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank');
  if (!win) { URL.revokeObjectURL(url); return false; }
  win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500); };
  return true;
}

const has = (category: string | undefined, keys: string[]) => !!category && keys.some((k) => category.toLowerCase().includes(k));
export const isMaterielLine = (l: ServiceLine) => has(l.category, ['matériel', 'materiel', 'vaisselle', 'équipement', 'equipement', 'location', 'technique']);
export const isPersonnelLine = (l: ServiceLine) => has(l.category, ['personnel', 'service', 'staff', 'extra', 'cuisinier', 'serveur']);
