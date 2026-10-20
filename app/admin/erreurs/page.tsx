'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, RotateCcw } from 'lucide-react';
import { listErrorGroups, setErrorResolved, type AdminErrorGroup } from '@/server/admin';
import { btnGhost, cardCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// Journal d'erreurs maison : une ligne par erreur distincte (navigateur ou serveur), les erreurs en cours d'abord.

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminErrorsPage() {
  const [groups, setGroups] = useState<AdminErrorGroup[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => listErrorGroups().then(setGroups).catch(() => setGroups([])), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (g: AdminErrorGroup) => {
    setBusy(g.fingerprint);
    await setErrorResolved(g.fingerprint, !g.resolved_at).catch(() => {});
    setBusy(null);
    load();
  };

  const active = (groups ?? []).filter((g) => !g.resolved_at).length;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Erreurs</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {groups ? (active ? `${active} erreur${active > 1 ? 's' : ''} à regarder. ` : 'Aucune erreur en cours. ') : ''}
          Vous êtes prévenu par email à la première apparition de chacune.
        </p>
      </div>
      {!groups ? (
        <div className={cn(cardCls, 'h-40 animate-pulse')} />
      ) : groups.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
          <p className="font-semibold text-gray-900 mt-3">Rien à signaler</p>
          <p className="text-sm text-gray-500 mt-1">Aucune erreur n’a été enregistrée.</p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {groups.map((g) => (
            <li key={g.fingerprint} className={g.resolved_at ? 'opacity-60' : ''}>
              <div className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
                <button onClick={() => setOpen(open === g.fingerprint ? null : g.fingerprint)} className="flex-1 min-w-0 text-left" aria-expanded={open === g.fingerprint}>
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className={cn(pill, g.source === 'serveur' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700')}>{g.source === 'serveur' ? 'Serveur' : 'Navigateur'}</span>
                    <span className="text-xs text-gray-500 tabular-nums">{g.count} fois · dernière le {when(g.last_seen)}</span>
                    {g.resolved_at && <span className={cn(pill, 'bg-emerald-50 text-emerald-700')}>Résolue</span>}
                  </span>
                  <span className="block font-mono text-[13px] text-gray-900 mt-1.5 break-words">{g.message}</span>
                  <span className="block text-xs text-gray-500 mt-1 truncate">{[g.last_path, g.last_user].filter(Boolean).join(' · ')}</span>
                </button>
                <button onClick={() => toggle(g)} disabled={busy === g.fingerprint} className={cn(btnGhost, 'shrink-0')}>
                  {g.resolved_at ? <><RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">Rouvrir</span></> : <><CheckCircle2 className="h-4 w-4" /><span className="hidden sm:inline">Marquer résolue</span></>}
                </button>
                <ChevronDown className={cn('h-4 w-4 text-gray-400 mt-1 shrink-0 transition-transform', open === g.fingerprint && 'rotate-180')} aria-hidden />
              </div>
              {open === g.fingerprint && (
                <div className="px-4 sm:px-5 pb-4 space-y-2 text-xs text-gray-600">
                  <p>Première fois le {when(g.first_seen)}{g.digest ? ` · code ${g.digest}` : ''}</p>
                  {g.last_user_agent && <p className="break-words">{g.last_user_agent}</p>}
                  {g.stack && <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed">{g.stack}</pre>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
