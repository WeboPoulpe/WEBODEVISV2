'use client';

import { useEffect, useState } from 'react';
import { listAuditLog, type AuditEntry } from '@/server/admin';
import { cardCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Journal des actions sensibles : entrées dans les comptes clients, rôles, désactivations, suppressions.

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const TONE: Record<string, string> = {
  entree_compte_client: 'bg-amber-50 text-amber-800',
  compte_purge: 'bg-red-50 text-red-700',
  suppression_demandee: 'bg-red-50 text-red-700',
  compte_supprime: 'bg-red-50 text-red-700',
  compte_desactive: 'bg-gray-100 text-gray-700',
  role_modifie: 'bg-amber-50 text-amber-800',
};

export default function AdminJournalPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listAuditLog().then(setEntries).catch(() => setError('Le journal n’a pas pu être chargé.')); }, []);

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Journal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Les actions sensibles faites dans l’administration et sur les comptes, les plus récentes d’abord.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!entries && !error ? (
        <div className={cn(cardCls, 'h-40 animate-pulse')} />
      ) : entries && entries.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center text-sm text-gray-500')}>Aucune action enregistrée pour l’instant.</div>
      ) : entries && (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {entries.map((e) => (
            <li key={e.id} className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <span className="sm:w-44 shrink-0 text-xs text-gray-500 tabular-nums">{when(e.created_at)}</span>
              <span className="flex-1 min-w-0">
                <span className={cn(pill, TONE[e.action] ?? 'bg-gray-100 text-gray-700')}>{e.label}</span>
                <span className="block text-sm text-gray-700 mt-1 truncate">
                  {e.actor ?? (e.details?.automatique ? 'Tâche automatique' : 'Compte supprimé')}
                  {e.target && e.target !== e.actor ? <> → <span className="font-medium">{e.target}</span></> : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
