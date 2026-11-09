'use client';

// Travail à plusieurs dans l'éditeur : bandeau de validation avant envoi, versions (nommées ou automatiques, retour
// à l'une d'elles), commentaires entre collègues (sur une page ou sur l'ensemble).

import { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Clock, Loader2, MessageSquare, RotateCcw, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, iconBtnDanger, inputCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import type { ResolvedStudioPage, StudioPage } from '@/lib/brochureStudio';
import {
  addComment, decideReview, deleteComment, getReview, listComments, listVersions, requestReview, restoreVersion, saveVersion, setCommentResolved,
  type CommentView, type ReviewView, type VersionSummary,
} from '@/server/brochureCollab';
import { PageThumb } from './StudioPanels';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/** Où en est la validation, et les boutons qui vont avec. `version` change à chaque enregistrement (rafraîchir). */
export function ReviewBar({ brochureId, version }: { brochureId: string; version: string }) {
  const { notify } = useFeedback();
  const [review, setReview] = useState<ReviewView | null>(null);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<'request' | 'changes' | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { getReview(brochureId).then(setReview).catch(() => {}); }, [brochureId]);
  useEffect(load, [load, version]);
  if (!review) return null;
  const act = async (fn: () => Promise<{ error: string | null }>, ok: string) => {
    setBusy(true);
    const res = await fn().catch(() => ({ error: 'Vérifiez votre connexion.' }));
    setBusy(false);
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    notify(ok, { tone: 'success' });
    setOpen(null); setNote('');
    load();
  };
  const tone = review.status === 'approved' ? 'border-forest/30 bg-sage-100 text-forest' : review.status === 'pending' ? 'border-amber-300 bg-amber-50 text-amber-900'
    : review.status === 'changes' ? 'border-red-200 bg-red-50 text-red-900' : 'border-gray-200 bg-white text-gray-600';
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm', tone)} role="status">
      {review.status === 'approved' ? <CheckCircle2 className="h-4 w-4" /> : review.status === 'pending' ? <Clock className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      <span className="min-w-0 flex-1">
        {review.status === 'none' && 'Pas encore relue par un collègue.'}
        {review.status === 'pending' && <>Validation demandée par {review.requestedBy ?? 'un collègue'} le {when(review.at)}{review.note ? ` : « ${review.note} »` : ''}.</>}
        {review.status === 'approved' && <>Validée par {review.by ?? 'un collègue'} le {when(review.at)} : prête à l’envoi.</>}
        {review.status === 'changes' && <>Changements demandés par {review.by ?? 'un collègue'} : « {review.note} »</>}
      </span>
      {(review.status === 'none' || review.status === 'changes' || review.status === 'approved') && open !== 'request' && (
        <button type="button" onClick={() => setOpen('request')} className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-gray-800 shadow-sm">
          {review.status === 'approved' ? 'Redemander une validation' : 'Demander une validation'}
        </button>
      )}
      {review.canDecide && open === null && (
        <>
          <button type="button" disabled={busy} onClick={() => act(() => decideReview(brochureId, 'approved'), 'Brochure validée.')} className="rounded-lg bg-forest px-2.5 py-1 text-xs font-semibold text-white"><Check className="mr-1 inline h-3.5 w-3.5" />Valider</button>
          <button type="button" onClick={() => setOpen('changes')} className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-red-800 shadow-sm">Demander des changements</button>
        </>
      )}
      {open && (
        <div className="flex w-full flex-wrap gap-2">
          <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={cn(inputCls, 'flex-1 py-1.5')}
            placeholder={open === 'request' ? 'Un mot pour le collègue (facultatif)' : 'Ce qui est à changer'} />
          <button type="button" disabled={busy || (open === 'changes' && !note.trim())} className={btnPrimary}
            onClick={() => (open === 'request'
              ? act(() => requestReview(brochureId, note), 'Validation demandée : vos collègues sont prévenus.')
              : act(() => decideReview(brochureId, 'changes', note), 'Changements demandés.'))}>Envoyer</button>
          <button type="button" onClick={() => setOpen(null)} className={btnSecondary}>Annuler</button>
        </div>
      )}
    </div>
  );
}

export function VersionsModal({ brochureId, resolve, language, onRestored, onClose, prepare }: {
  brochureId: string;
  /** Avant de revenir à une version : enregistrer ce qui attend encore (sinon cela l'écraserait). */
  prepare?: () => Promise<void>;
  resolve: (p: StudioPage) => ResolvedStudioPage;
  language: 'fr' | 'en';
  onRestored: () => void;
  onClose: () => void;
}) {
  const { notify, confirm } = useFeedback();
  const [list, setList] = useState<VersionSummary[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { listVersions(brochureId).then((v) => setList(v ?? [])).catch(() => setList([])); }, [brochureId]);
  useEffect(load, [load]);
  return (
    <Modal title="Versions de la brochure" onClose={onClose} wide footer={<button type="button" onClick={onClose} className={btnSecondary}>Fermer</button>}>
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Nom de la version (« Avant le salon »…)" className={cn(inputCls, 'flex-1')} />
        <button type="button" disabled={busy || !label.trim()} className={btnPrimary} onClick={async () => {
          setBusy(true);
          const res = await saveVersion(brochureId, label).catch(() => ({ error: 'Non enregistrée.' }));
          setBusy(false);
          if (res.error) { notify(res.error, { tone: 'error' }); return; }
          setLabel(''); notify('Version enregistrée.', { tone: 'success' }); load();
        }}>Enregistrer la version actuelle</button>
      </div>
      <p className="mb-3 text-xs text-gray-500">Une version est aussi prise toute seule au plus toutes les 30 minutes de travail. Revenir à une version garde d’abord les pages actuelles.</p>
      {list === null ? <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        : list.length === 0 ? <p className="text-sm text-gray-600">Pas encore de version.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map((v) => (
              <li key={v.id} className="flex gap-3 rounded-xl border border-gray-200 p-2">
                <span className="w-14 flex-none overflow-hidden rounded ring-1 ring-gray-200">{v.cover && <PageThumb page={resolve(v.cover)} language={language} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{v.label ?? 'Version automatique'}</span>
                  <span className="block text-xs text-gray-500">{when(v.createdAt)} · {v.author} · {v.pages} page{v.pages > 1 ? 's' : ''}</span>
                  <button type="button" disabled={busy} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={async () => {
                    if (!(await confirm({ title: 'Revenir à cette version ?', message: 'Les pages actuelles sont gardées comme une version : vous pourrez y revenir.', confirmLabel: 'Revenir à cette version' }))) return;
                    setBusy(true);
                    await prepare?.();
                    const res = await restoreVersion(v.id).catch(() => ({ error: 'Non restaurée.' }));
                    setBusy(false);
                    if (res.error) { notify(res.error, { tone: 'error' }); return; }
                    notify('Version restaurée.', { tone: 'success' });
                    onRestored();
                  }}><RotateCcw className="h-3.5 w-3.5" /> Revenir à cette version</button>
                </span>
              </li>
            ))}
          </ul>
        )}
    </Modal>
  );
}

export function CommentsModal({ brochureId, pages, currentPageId, onCount, onClose }: {
  brochureId: string;
  /** Pages (identifiant, numéro) pour situer les commentaires. */
  pages: { id: string; label: string }[];
  currentPageId: string | null;
  onCount?: (open: number) => void;
  onClose: () => void;
}) {
  const { notify } = useFeedback();
  const [list, setList] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState('');
  const [onPage, setOnPage] = useState(!!currentPageId);
  const [showResolved, setShowResolved] = useState(false);
  const load = useCallback(() => {
    listComments(brochureId).then((c) => { setList(c ?? []); onCount?.((c ?? []).filter((x) => !x.resolved).length); }).catch(() => setList([]));
  }, [brochureId, onCount]);
  useEffect(load, [load]);
  const label = (id: string | null) => (id ? pages.find((p) => p.id === id)?.label ?? 'page retirée' : 'toute la brochure');
  const shown = (list ?? []).filter((c) => showResolved || !c.resolved);
  const run = async (p: Promise<{ error: string | null }>) => { const r = await p.catch(() => ({ error: 'Vérifiez votre connexion.' })); if (r.error) notify(r.error, { tone: 'error' }); load(); };
  return (
    <Modal title="Commentaires" onClose={onClose} wide footer={<button type="button" onClick={onClose} className={btnSecondary}>Fermer</button>}>
      <div className="space-y-2">
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Votre remarque pour l’équipe…" className={inputCls} />
        <div className="flex flex-wrap items-center gap-3">
          {currentPageId && (
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={onPage} onChange={(e) => setOnPage(e.target.checked)} /> Sur {label(currentPageId)}
            </label>
          )}
          <button type="button" disabled={!body.trim()} className={btnPrimary}
            onClick={async () => { await run(addComment(brochureId, { pageId: onPage ? currentPageId : null, body })); setBody(''); }}>Ajouter</button>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Voir les résolus
          </label>
        </div>
      </div>
      {list === null ? <p className="mt-4 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        : shown.length === 0 ? <p className="mt-4 text-sm text-gray-600">Aucun commentaire en cours.</p> : (
          <ul className="mt-4 space-y-2">
            {shown.map((c) => (
              <li key={c.id} className={cn('rounded-xl border border-gray-200 p-3', c.resolved && 'opacity-60')}>
                <p className="text-xs text-gray-500"><strong className="text-gray-800">{c.author}</strong> · {when(c.createdAt)} · {label(c.pageId)}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{c.body}</p>
                <div className="mt-2 flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={c.resolved} onChange={(e) => run(setCommentResolved(c.id, e.target.checked))} /> Résolu
                  </label>
                  {c.mine && <button type="button" className={cn(iconBtnDanger, 'ml-auto')} aria-label="Supprimer le commentaire" onClick={() => run(deleteComment(c.id))}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
    </Modal>
  );
}
