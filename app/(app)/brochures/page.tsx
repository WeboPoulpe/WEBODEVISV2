'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Copy, CopyPlus, ExternalLink, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import SendBrochureModal from '@/components/brochures/SendBrochureModal';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, cardCls, errorCls, iconBtn, iconBtnDanger, inputCls, labelCls, pill } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { useUrlAction } from '@/lib/useUrlAction';
import { STYLE_LABELS } from '@/lib/brochure';
import { createBrochure, deleteBrochure, duplicateBrochure, listBrochures, type BrochureSummary } from '@/server/brochures';

// Brochures : le catalogue des prestations présenté comme un livre, envoyé par lien. Plusieurs brochures par
// entreprise (mariages, entreprises…), chacune dans l'un des trois styles.

const when = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export default function BrochuresPage() {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [items, setItems] = useState<BrochureSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  // Raccourci du menu : « Nouvelle brochure ».
  useUrlAction({ nouvelle: () => setCreating('') });

  const load = useCallback(() => {
    listBrochures().then(setItems).catch(() => setError('Les brochures n’ont pas pu être chargées. Rechargez la page.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!creating?.trim()) return;
    setBusy(true);
    const res = await createBrochure({ name: creating }).catch(() => ({ error: 'La brochure n’a pas pu être créée. Réessayez.', id: undefined }));
    setBusy(false);
    if (res.error || !res.id) { notify(res.error ?? 'La brochure n’a pas pu être créée.', { tone: 'error' }); return; }
    router.push(`/brochures/${res.id}`);
  };

  const copyLink = async (b: BrochureSummary) => {
    const url = `${window.location.origin}/b/${b.share_token}`;
    try { await navigator.clipboard.writeText(url); notify('Lien copié.', { tone: 'success' }); }
    catch { notify(url); }
  };

  const duplicate = async (b: BrochureSummary) => {
    const res = await duplicateBrochure(b.id);
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    load();
  };

  const remove = async (b: BrochureSummary) => {
    if (!(await confirm({
      title: `Supprimer « ${b.name} » ?`,
      message: 'Son lien cessera de marcher pour tous ceux qui l’ont reçu. Les prestations du catalogue ne changent pas.',
      danger: true,
    }))) return;
    const res = await deleteBrochure(b.id);
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    setItems((prev) => prev?.filter((x) => x.id !== b.id) ?? null);
  };

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Brochures</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Vos prestations présentées comme un livre qu’on feuillette. Envoyez le lien à un client, un prospect ou un lieu partenaire : la dernière page est un formulaire de demande.
          </p>
        </div>
        <button type="button" onClick={() => setCreating('')} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Nouvelle brochure
        </button>
      </div>

      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className={cn(cardCls, 'p-8 text-center')}>
          <BookOpen className="h-8 w-8 mx-auto text-gray-300" />
          <p className="mt-3 text-gray-700 font-medium">Aucune brochure pour l’instant</p>
          <p className="mt-1 text-sm text-gray-500">Créez-en une pour les mariages, une autre pour les entreprises…</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((b) => (
            <li key={b.id} className={cn(cardCls, 'overflow-hidden flex flex-col')}>
              <div className="aspect-[3/2] bg-[#E6DFD3] relative">
                {b.coverPhotoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.coverPhotoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  : <div className="absolute inset-0 bg-gradient-to-br from-[#d9c8ad] to-[#9c8a6c]" />}
                <span className="absolute left-3 bottom-3 right-3 text-white text-lg font-semibold drop-shadow">{b.name}</span>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span className={cn(pill, 'bg-sage-100 text-forest')}>{STYLE_LABELS[b.style] ?? b.style}</span>
                  {!b.is_active && <span className={cn(pill, 'bg-gray-100 text-gray-500')}>Lien désactivé</span>}
                  <span>{b.view_count} ouverture{b.view_count > 1 ? 's' : ''}{b.viewed_at ? `, la dernière le ${when(b.viewed_at)}` : ''}</span>
                </div>
                <div className="mt-auto flex items-center gap-1">
                  <Link href={`/brochures/${b.id}`} className={cn(btnSecondary, 'flex-1 justify-center')}>Ouvrir</Link>
                  <button type="button" onClick={() => setSending(b.id)} disabled={!b.is_active} className={iconBtn} aria-label="Envoyer" title={b.is_active ? 'Envoyer' : 'Lien désactivé'}><Send className="h-4 w-4" /></button>
                  <button type="button" onClick={() => copyLink(b)} className={iconBtn} aria-label="Copier le lien" title="Copier le lien"><Copy className="h-4 w-4" /></button>
                  <a href={`/b/${b.share_token}`} target="_blank" rel="noreferrer" className={iconBtn} aria-label="Voir comme le lecteur" title="Voir comme le lecteur"><ExternalLink className="h-4 w-4" /></a>
                  <button type="button" onClick={() => duplicate(b)} className={iconBtn} aria-label="Dupliquer" title="Dupliquer"><CopyPlus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => remove(b)} className={iconBtnDanger} aria-label="Supprimer" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sending && <SendBrochureModal brochureId={sending} onClose={() => setSending(null)} />}

      {creating !== null && (
        <Modal title="Nouvelle brochure" onClose={() => setCreating(null)}
          footer={<>
            <button type="button" onClick={() => setCreating(null)} className={btnSecondary}>Annuler</button>
            <button type="button" onClick={create} disabled={busy || !creating.trim()} className={btnPrimary}>Créer</button>
          </>}>
          <label htmlFor="brochure-name" className={labelCls}>Nom de la brochure</label>
          <input id="brochure-name" autoFocus value={creating} onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            placeholder="Mariages 2027" maxLength={120} className={inputCls} />
        </Modal>
      )}
    </div>
  );
}
