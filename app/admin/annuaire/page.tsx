'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, ImageOff, Loader2 } from 'lucide-react';
import { decideListing, listAdminListings, type AdminListing, type ListingDecision } from '@/server/adminDirectory';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, btnSecondary, cardCls, errorCls, inputCls, labelCls, pill } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { LISTING_STATUS } from '../labels';
import { useFeedback } from '@/components/ui/Feedback';

const when = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

type Filter = 'a_valider' | 'publiees' | 'modifiees' | 'ecartees';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'a_valider', label: 'À valider' },
  { key: 'publiees', label: 'Publiées' },
  { key: 'modifiees', label: 'Modifiées depuis la validation' },
  { key: 'ecartees', label: 'Refusées et suspendues' },
];
const MATCH: Record<Filter, (l: AdminListing) => boolean> = {
  a_valider: (l) => l.status === 'en_attente',
  publiees: (l) => l.status === 'publiee',
  modifiees: (l) => l.status === 'publiee' && l.modifiedSinceValidation,
  ecartees: (l) => l.status === 'refusee' || l.status === 'suspendue',
};
const EMPTY: Record<Filter, string> = {
  a_valider: 'Aucune fiche à valider',
  publiees: 'Aucune fiche publiée',
  modifiees: 'Aucune fiche modifiée depuis sa validation',
  ecartees: 'Aucune fiche refusée ou suspendue',
};

const place = (l: AdminListing) => [l.city, l.postalCode].filter(Boolean).join(' ');

export default function AdminDirectoryPage() {
  const [listings, setListings] = useState<AdminListing[] | null>(null);
  const [filter, setFilter] = useState<Filter>('a_valider');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => setListings(await listAdminListings()), []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (listings ?? []).filter(MATCH[filter]), [listings, filter]);
  const open = listings?.find((l) => l.companyId === openId) ?? null;
  const pending = (listings ?? []).filter(MATCH.a_valider).length;

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="mb-5">
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Annuaire</h1>
        <p className="text-sm text-gray-500 mt-0.5">{listings ? `${pending} à valider, fiches de Choisir Mon Traiteur` : ' '}</p>
      </div>

      <div className="flex p-1 mb-4 rounded-xl bg-gray-200/70 overflow-x-auto scrollbar-none md:w-fit" role="tablist" aria-label="Fiches affichées">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={cn('flex-shrink-0 h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
            {f.label}
          </button>
        ))}
      </div>

      {!listings ? (
        <div className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse space-y-2"><div className="h-4 bg-gray-100 rounded w-1/3" /><div className="h-3 bg-gray-100 rounded w-2/3" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(cardCls, 'px-6 py-14 text-center')}>
          <p className="font-semibold text-gray-900">{EMPTY[filter]}</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Les fiches envoyées par les traiteurs depuis « Ma fiche » arrivent ici quand le contrôle automatique a un doute.</p>
        </div>
      ) : (
        <ul className={cn(cardCls, 'divide-y divide-gray-100 overflow-hidden')}>
          {filtered.map((l) => (
            <li key={l.companyId}>
              <button onClick={() => setOpenId(l.companyId)} className="w-full flex items-start gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50 transition-colors">
                <Cover url={l.coverUrl} className="h-16 w-16 sm:h-20 sm:w-20" />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 truncate">{l.displayName}</span>
                    <span className={cn(pill, LISTING_STATUS[l.status]?.cls)}>{LISTING_STATUS[l.status]?.label ?? l.status}</span>
                    {l.modifiedSinceValidation && <span className={cn(pill, 'bg-primary-50 text-primary-700')}>Modifiée</span>}
                  </span>
                  <span className="block text-sm text-gray-500 mt-0.5">{place(l) || 'Ville non renseignée'}{l.siret ? ` · SIRET ${l.siret}` : ''}</span>
                  <Check l={l} compact />
                </span>
                <span className="text-sm text-gray-500 whitespace-nowrap">{day(l.submittedAt ?? l.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <ListingDialog key={open.companyId} listing={open} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function Cover({ url, className }: { url: string | null; className: string }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" className={cn(className, 'flex-shrink-0 rounded-xl object-cover bg-gray-100')} />
    : <span className={cn(className, 'flex-shrink-0 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center')} aria-label="Pas de photo"><ImageOff className="h-5 w-5" /></span>;
}

/** Ce que le contrôle automatique a trouvé : la dénomination officielle, le code d'activité et la raison du doute. */
function Check({ l, compact }: { l: AdminListing; compact?: boolean }) {
  const c = l.check;
  if (!c) return <span className="block text-sm text-gray-500 mt-1">Pas encore de contrôle automatique.</span>;
  return (
    <span className={cn('block mt-1 space-y-0.5', compact && 'text-sm')}>
      <span className="block text-gray-700">{c.legalName ? `Dénomination trouvée : ${c.legalName}` : 'Aucune entreprise trouvée'}{c.activity ? ` · activité ${c.activity}` : ''}</span>
      <span className={cn('block', c.ok ? 'text-sage' : 'text-primary-700')}>{c.ok ? 'Contrôle réussi, sans doute.' : `Doute : ${c.reason ?? 'à vérifier'}`}</span>
    </span>
  );
}

const ACTIONS: Record<ListingDecision, { label: string; reason: boolean; confirm: string }> = {
  valider: { label: 'Valider et publier', reason: false, confirm: 'Publier cette fiche dans l’annuaire ?' },
  refuser: { label: 'Refuser', reason: true, confirm: 'Refuser cette fiche ?' },
  suspendre: { label: 'Suspendre', reason: true, confirm: 'Retirer cette fiche de l’annuaire ?' },
  republier: { label: 'Republier', reason: false, confirm: 'Remettre cette fiche en ligne ?' },
};
const AVAILABLE: Record<string, ListingDecision[]> = {
  en_attente: ['valider', 'refuser'],
  publiee: ['suspendre'],
  suspendue: ['republier'],
  refusee: ['republier'],
};

function ListingDialog({ listing: l, onClose, onChanged }: { listing: AdminListing; onClose: () => void; onChanged: () => Promise<void> }) {
  const { confirm, notify } = useFeedback();
  const [asking, setAsking] = useState<ListingDecision | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: ListingDecision) => {
    const a = ACTIONS[decision];
    if (a.reason && asking !== decision) { setAsking(decision); setError(null); return; }
    if (!(await confirm({ title: a.confirm, message: 'Le traiteur sera prévenu par e-mail.', confirmLabel: a.label, danger: decision === 'suspendre' }))) return;
    setBusy(true); setError(null);
    const res = await decideListing(l.companyId, decision, reason).catch(() => ({ error: 'La décision n’a pas pu être enregistrée. Réessayez.' }));
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    notify('Décision enregistrée, le traiteur est prévenu.');
    await onChanged();
    onClose();
  };

  const actions = AVAILABLE[l.status] ?? [];
  return (
    <Modal
      title={l.displayName}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className={cn(btnGhost, 'mr-auto')}>Fermer</button>
        {actions.map((d) => (
          <button key={d} onClick={() => decide(d)} disabled={busy}
            className={d === 'valider' || d === 'republier' ? btnPrimary : btnSecondary}>
            {busy && asking === d && <Loader2 className="h-4 w-4 animate-spin" />}{asking === d && ACTIONS[d].reason ? 'Confirmer : ' : ''}{ACTIONS[d].label}
          </button>
        ))}
      </>}
    >
      <div className="space-y-5 pb-3">
        {error && <p role="alert" className={errorCls}>{error}</p>}
        <div className="flex items-start gap-4">
          <Cover url={l.coverUrl} className="h-24 w-24" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 flex-wrap">
              <span className={cn(pill, LISTING_STATUS[l.status]?.cls)}>{LISTING_STATUS[l.status]?.label ?? l.status}</span>
              {l.modifiedSinceValidation && <span className={cn(pill, 'bg-primary-50 text-primary-700')}>Modifiée depuis la validation</span>}
            </p>
            <p className="text-sm text-gray-500 mt-1.5">{place(l) || 'Ville non renseignée'}</p>
            <p className="text-sm text-gray-500">{l.photoCount} photo{l.photoCount > 1 ? 's' : ''}{l.ownerEmail ? ` · ${l.ownerEmail}` : ''}</p>
          </div>
        </div>

        <dl className="grid gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] text-[15px]">
          <dt className="text-sm text-gray-500">SIRET</dt><dd className="text-gray-900">{l.siret ?? 'Non renseigné'}</dd>
          <dt className="text-sm text-gray-500">Contrôle</dt><dd><Check l={l} /></dd>
          {l.check && <><dt className="text-sm text-gray-500">Contrôlé le</dt><dd className="text-gray-900">{when(l.check.checkedAt)}</dd></>}
          {l.submittedAt && <><dt className="text-sm text-gray-500">Envoyée le</dt><dd className="text-gray-900">{when(l.submittedAt)}</dd></>}
          {l.publishedAt && <><dt className="text-sm text-gray-500">Publiée le</dt><dd className="text-gray-900">{when(l.publishedAt)}</dd></>}
          <dt className="text-sm text-gray-500">Modifiée le</dt><dd className="text-gray-900">{when(l.updatedAt)}</dd>
          {l.refusedReason && <><dt className="text-sm text-gray-500">Motif</dt><dd className="text-gray-900 whitespace-pre-wrap break-words">{l.refusedReason}</dd></>}
        </dl>

        {l.status === 'publiee' && (
          <a href={`/annuaire/traiteur/${l.slug}`} target="_blank" rel="noreferrer" className={btnSecondary}>
            <ExternalLink className="h-4 w-4" />Voir la fiche
          </a>
        )}

        {asking && ACTIONS[asking].reason && (
          <div>
            <label htmlFor="listing-reason" className={labelCls}>Motif, transmis au traiteur</label>
            <textarea id="listing-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
              placeholder={asking === 'refuser' ? 'Ce qu’il doit corriger pour être publié' : 'Pourquoi la fiche est retirée'} className={cn(inputCls, 'h-auto py-3 resize-none')} />
          </div>
        )}
      </div>
    </Modal>
  );
}
