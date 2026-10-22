'use client';

// Envoyer une brochure par email (ou copier son lien). Depuis une demande de Prospects : l'adresse est remplie, et
// la demande passe à « Brochure envoyée ».

import { useEffect, useState } from 'react';
import { Copy, Loader2, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { listBrochures, sendBrochure, type BrochureSummary } from '@/server/brochures';

export default function SendBrochureModal({ brochureId, defaultTo = '', prospectId, onClose, onSent }: {
  /** Brochure à envoyer ; sans elle, le choix parmi les brochures actives. */
  brochureId?: string;
  defaultTo?: string;
  prospectId?: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { notify } = useFeedback();
  const [list, setList] = useState<BrochureSummary[] | null>(null);
  const [chosen, setChosen] = useState(brochureId ?? '');
  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState('Bonjour,\n\nVoici notre brochure : vous y trouverez nos prestations, et pouvez nous envoyer votre demande depuis sa dernière page.\n\nÀ bientôt,');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listBrochures().then((all) => {
      const active = all.filter((b) => b.is_active);
      setList(active);
      if (!brochureId && active[0]) setChosen(active[0].id);
    }).catch(() => setList([]));
  }, [brochureId]);

  const current = list?.find((b) => b.id === chosen);
  const copyLink = async () => {
    if (!current) return;
    const url = `${window.location.origin}/b/${current.share_token}`;
    try { await navigator.clipboard.writeText(url); notify('Lien copié.', { tone: 'success' }); } catch { notify(url); }
  };

  const send = async () => {
    if (!chosen) return;
    setBusy(true);
    const res = await sendBrochure({ brochureId: chosen, to, message, prospectId }).catch(() => ({ error: 'L’email n’a pas pu partir. Réessayez.' }));
    setBusy(false);
    if (res.error) { notify(res.error, { tone: 'error' }); return; }
    notify('Brochure envoyée.', { tone: 'success' });
    onSent?.();
    onClose();
  };

  return (
    <Modal title="Envoyer une brochure" onClose={onClose}
      footer={<>
        <button type="button" onClick={copyLink} disabled={!current} className={btnSecondary}><Copy className="h-4 w-4" /> Copier le lien</button>
        <button type="button" onClick={send} disabled={busy || !chosen || !to.trim()} className={btnPrimary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
        </button>
      </>}>
      {list === null ? (
        <div className="flex justify-center py-6 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-600">Aucune brochure active. Créez-en une, ou réactivez son lien, depuis la page Brochures.</p>
      ) : (
        <div className="space-y-3">
          {!brochureId && (
            <label className="block">
              <span className={labelCls}>Brochure</span>
              <select value={chosen} onChange={(e) => setChosen(e.target.value)} className={inputCls}>
                {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className={labelCls}>Destinataire</span>
            <input type="email" multiple value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@exemple.fr" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Message</span>
            <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}
    </Modal>
  );
}
