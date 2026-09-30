'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, Phone, Trash2 } from 'lucide-react';
import { deleteSiteRequest, listSiteRequests, updateSiteRequest, type AdminSiteRequest, type SiteRequestStatus } from '@/server/admin';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { REQUEST_KIND, REQUEST_STATUS } from '../labels';

const when = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

type Filter = 'a_traiter' | 'traitees' | 'toutes';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'a_traiter', label: 'À traiter' },
  { key: 'traitees', label: 'Traitées' },
  { key: 'toutes', label: 'Toutes' },
];
const STATUSES: SiteRequestStatus[] = ['nouvelle', 'en_cours', 'traitee'];

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminSiteRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>('a_traiter');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => setRequests(await listSiteRequests()), []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (requests ?? []).filter((r) =>
    filter === 'toutes' || (filter === 'traitees' ? r.status === 'traitee' : r.status !== 'traitee')), [requests, filter]);
  const open = requests?.find((r) => r.id === openId) ?? null;
  const pending = (requests ?? []).filter((r) => r.status !== 'traitee').length;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Demandes</h1>
        <p className="text-sm text-gray-500 mt-0.5">{requests ? `${pending} à traiter, reçues par le formulaire du site` : ' '}</p>
      </div>

      <div className="flex p-1 mb-4 rounded-xl bg-gray-200/70 sm:w-fit" role="tablist" aria-label="Demandes affichées">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={cn('flex-1 sm:flex-none h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            {f.label}
          </button>
        ))}
      </div>

      {!requests ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-2/3" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900">{filter === 'a_traiter' ? 'Tout est traité' : 'Aucune demande'}</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Les demandes de devis et les messages envoyés depuis la page Contact du site arrivent ici, et dans votre boîte mail.</p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpenId(r.id)} className="w-full flex items-start gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50 transition-colors">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{r.name}{r.company ? `, ${r.company}` : ''}</span>
                    <span className={cn(pill, REQUEST_STATUS[r.status]?.cls)}>{REQUEST_STATUS[r.status]?.label ?? r.status}</span>
                  </span>
                  <span className="block text-sm text-gray-500 mt-0.5">{REQUEST_KIND[r.kind] ?? r.kind}</span>
                  <span className="block text-sm text-gray-700 line-clamp-2 mt-1">{r.message}</span>
                </span>
                <span className="text-sm text-gray-500 whitespace-nowrap">{day(r.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <RequestDialog key={open.id} request={open} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function RequestDialog({ request, onClose, onChanged }: { request: AdminSiteRequest; onClose: () => void; onChanged: () => Promise<void> }) {
  const [status, setStatus] = useState(request.status as SiteRequestStatus);
  const [notes, setNotes] = useState(request.admin_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subject = encodeURIComponent(request.kind === 'devis' ? 'Votre demande de devis WeboDevis' : 'Votre message à WeboDevis');

  const save = async () => {
    setBusy(true); setError(null);
    const res = await updateSiteRequest(request.id, { status, admin_notes: notes }).catch(() => ({ error: 'L’enregistrement a échoué. Réessayez.' }));
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    await onChanged();
    onClose();
  };
  const remove = async () => {
    if (!confirm('Supprimer définitivement cette demande ?')) return;
    await deleteSiteRequest(request.id);
    await onChanged();
    onClose();
  };

  return (
    <Modal
      title={REQUEST_KIND[request.kind] ?? 'Demande'}
      onClose={onClose}
      footer={<>
        <button onClick={remove} className={cn(btnGhost, 'mr-auto text-danger')} aria-label="Supprimer la demande"><Trash2 className="h-4 w-4" /></button>
        <button onClick={onClose} className={btnGhost}>Fermer</button>
        <button onClick={save} disabled={busy} className={btnPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer</button>
      </>}
    >
      <div className="space-y-5 pb-3">
        {error && <p role="alert" className={errorCls}>{error}</p>}
        <div>
          <p className="text-lg font-semibold text-gray-900">{request.name}</p>
          <p className="text-sm text-gray-500">
            {[request.company, request.team_size].filter(Boolean).join(', ')}{request.company || request.team_size ? '. ' : ''}Reçue le {when(request.created_at)}.
          </p>
        </div>
        <p className="text-[15px] text-gray-800 whitespace-pre-wrap rounded-2xl bg-gray-50 p-4">{request.message}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:${request.email}?subject=${subject}`} className={btnSecondary}><Mail className="h-4 w-4" />Répondre à {request.email}</a>
          {request.phone && <a href={`tel:${request.phone.replace(/\s/g, '')}`} className={btnSecondary}><Phone className="h-4 w-4" />{request.phone}</a>}
        </div>
        <div>
          <p className={labelCls}>Suivi</p>
          <div className="flex p-1 rounded-xl bg-gray-200/70" role="radiogroup" aria-label="Suivi de la demande">
            {STATUSES.map((s) => (
              <button key={s} role="radio" aria-checked={status === s} onClick={() => setStatus(s)}
                className={cn('flex-1 h-10 rounded-lg text-sm font-medium transition-colors', status === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
                {REQUEST_STATUS[s].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="req-notes" className={labelCls}>Notes internes</label>
          <textarea id="req-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce qui a été dit, ce qui a été proposé" className={cn(inputCls, 'h-auto py-3 resize-none')} />
        </div>
      </div>
    </Modal>
  );
}
