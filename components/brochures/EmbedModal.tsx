'use client';

// Intégrer la brochure au site du traiteur : un code à coller (balise iframe). Le lecteur feuillette la brochure
// sans quitter le site, et envoie sa demande depuis la dernière page. Un lien « Site web » permet de compter à part
// les ouvertures et demandes venues du site.

import { useEffect, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { createBrochureLink, listBrochureLinks, type LinkSummary } from '@/server/brochureLinks';

export default function EmbedModal({ brochureId, name, onClose }: { brochureId: string; name: string; onClose: () => void }) {
  const { notify } = useFeedback();
  const [links, setLinks] = useState<LinkSummary[] | null>(null);
  const [token, setToken] = useState('');
  const [height, setHeight] = useState(760);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listBrochureLinks(brochureId).then((l) => {
      const list = (l ?? []).filter((x) => x.isActive && x.kind !== 'client');
      setLinks(list);
      setToken((list.find((x) => /site/i.test(x.label)) ?? list[0])?.token ?? '');
    }).catch(() => setLinks([]));
  }, [brochureId]);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const src = `${origin}/embed/b/${token}`;
  const code = `<iframe src="${src}" title="${name.replace(/"/g, '&quot;')}" style="width:100%;height:${height}px;max-height:100vh;border:0;border-radius:12px" loading="lazy" allow="fullscreen"></iframe>`;
  const copy = async () => { try { await navigator.clipboard.writeText(code); notify('Code copié : collez-le dans votre site.', { tone: 'success' }); } catch { notify(code); } };
  const siteLink = async () => {
    setBusy(true);
    const res = await createBrochureLink(brochureId, { kind: 'source', label: 'Site web' }).catch(() => ({ error: 'Non créé.' }));
    setBusy(false);
    if (res.error || !('token' in res) || !res.token) { notify(res.error ?? 'Non créé.', { tone: 'error' }); return; }
    setLinks((l) => [...(l ?? []), { id: res.id ?? '', token: res.token!, kind: 'source', label: 'Site web', greeting: null, expiresAt: null, hasCode: false, isActive: true, views: 0, viewedAt: null, requests: 0 }]);
    setToken(res.token);
  };
  return (
    <Modal title="Intégrer la brochure à votre site" onClose={onClose} wide
      footer={<><button type="button" onClick={onClose} className={btnSecondary}>Fermer</button><button type="button" onClick={copy} disabled={!token} className={btnPrimary}><Copy className="h-4 w-4" /> Copier le code</button></>}>
      {links === null ? <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p> : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Collez ce code dans une page de votre site (bloc « HTML » ou « code intégré » sur WordPress, Wix, Squarespace…). Sur téléphone, la brochure prend toute la largeur du cadre.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Lien utilisé</span>
              <select value={token} onChange={(e) => setToken(e.target.value)} className={inputCls}>
                {links.map((l) => <option key={l.token} value={l.token}>{l.label}</option>)}
              </select>
              {!links.some((l) => /site/i.test(l.label)) && (
                <button type="button" disabled={busy} onClick={siteLink} className="mt-1 text-xs font-medium text-primary">Créer un lien « Site web » pour compter à part les visites du site</button>
              )}
            </label>
            <label className="block">
              <span className={labelCls}>Hauteur du cadre (px)</span>
              <input type="number" min={400} max={1400} step={20} value={height} onChange={(e) => setHeight(Math.min(1400, Math.max(400, Number(e.target.value) || 760)))} className={inputCls} />
            </label>
          </div>
          <textarea readOnly rows={4} value={code} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} font-mono text-xs`} aria-label="Code à copier" />
          {token && (
            <div>
              <p className={labelCls}>Aperçu</p>
              <iframe src={`/embed/b/${token}`} title="Aperçu de la brochure intégrée" className="h-[420px] w-full rounded-xl border border-gray-200" loading="lazy" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
