'use client';

// Envoyer une brochure par email à un ou plusieurs clients (ou copier son lien). Chaque client choisi dans le fichier
// reçoit son propre lien personnalisé. Depuis une demande de Prospects : le destinataire est rempli, et la demande
// passe à « Brochure envoyée ».

import { useEffect, useState } from 'react';
import { Copy, Loader2, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, inputCls, labelCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { listBrochures, sendBrochure, type BrochureSummary } from '@/server/brochures';
import { mergeRecipients, type BrochureRecipient } from '@/lib/brochureRecipients';
import { MAX_BROCHURE_RECIPIENTS } from '@/lib/emailList';
import RecipientPicker from './RecipientPicker';

export default function SendBrochureModal({ brochureId, defaultTo = '', defaultName = '', prospectId, onClose, onSent }: {
  /** Brochure à envoyer ; sans elle, le choix parmi les brochures actives. */
  brochureId?: string;
  /** Nom du client, pour un lien personnalisé (« Pour le mariage de… »). */
  defaultName?: string;
  defaultTo?: string;
  prospectId?: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const { notify } = useFeedback();
  const [list, setList] = useState<BrochureSummary[] | null>(null);
  const [brochure, setBrochure] = useState(brochureId ?? '');
  // Depuis Prospects : la personne de la demande, déjà choisie.
  const [chosen, setChosen] = useState<BrochureRecipient[]>(defaultTo && defaultName ? [{ email: defaultTo, name: defaultName }] : []);
  const [typed, setTyped] = useState(defaultTo && !defaultName ? defaultTo : '');
  const [message, setMessage] = useState('Bonjour,\n\nVoici notre brochure : vous y trouverez nos prestations, et pouvez nous envoyer votre demande depuis sa dernière page.\n\nÀ bientôt,');
  const [busy, setBusy] = useState(false);
  // Lien personnalisé : propre à chaque client choisi, avec son message d'accueil et ses chiffres.
  const [personal, setPersonal] = useState(true);
  const [greeting, setGreeting] = useState('Pour {{client}}');
  const merged = mergeRecipients(personal ? chosen : chosen.map(({ email, customerId }) => ({ email, customerId })), typed);

  useEffect(() => {
    listBrochures().then((all) => {
      const active = all.filter((b) => b.is_active);
      setList(active);
      if (!brochureId && active[0]) setBrochure(active[0].id);
    }).catch(() => setList([]));
  }, [brochureId]);

  const current = list?.find((b) => b.id === brochure);
  const copyLink = async () => {
    if (!current) return;
    const url = `${window.location.origin}/b/${current.share_token}`;
    try { await navigator.clipboard.writeText(url); notify('Lien copié.', { tone: 'success' }); } catch { notify(url); }
  };

  const send = async () => {
    if (!brochure) return;
    if (merged.invalid.length) { notify(`Adresse non valide : ${merged.invalid.join(', ')}.`, { tone: 'error' }); return; }
    setBusy(true);
    const res: { error: string | null; sent?: number } = await sendBrochure({
      brochureId: brochure, recipients: merged.list, message, prospectId, greeting: personal ? greeting : null,
    }).catch(() => ({ error: 'L’email n’a pas pu partir. Réessayez.' }));
    setBusy(false);
    if (res.error && !res.sent) { notify(res.error, { tone: 'error' }); return; }
    if (res.error) notify(`Envoyée à ${res.sent} destinataire${res.sent! > 1 ? 's' : ''}. ${res.error}`, { tone: 'error' });
    else notify(`Brochure envoyée à ${res.sent} destinataire${res.sent! > 1 ? 's' : ''}.`, { tone: 'success' });
    onSent?.();
    onClose();
  };

  return (
    <Modal title="Envoyer une brochure" onClose={onClose}
      footer={<>
        <button type="button" onClick={copyLink} disabled={!current} className={btnSecondary}><Copy className="h-4 w-4" /> Copier le lien</button>
        <button type="button" onClick={send} disabled={busy || !brochure || merged.list.length === 0} className={btnPrimary}>
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
              <select value={brochure} onChange={(e) => setBrochure(e.target.value)} className={inputCls}>
                {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <div>
            <span className={labelCls}>Destinataires</span>
            <RecipientPicker chosen={chosen} onChosen={setChosen} typed={typed} onTyped={setTyped} max={MAX_BROCHURE_RECIPIENTS} />
          </div>
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
              <span>Un lien personnalisé pour chaque client choisi<span className="block text-xs text-gray-500">Chacun a son propre lien, avec un message d’accueil et ses chiffres (ouvertures, demande). Les autres adresses reçoivent le lien de la brochure. Écrivez {'{{client}}'} dans un texte du Studio pour y mettre son nom.</span></span>
            </label>
            {personal && (
              <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">Message d’accueil ({'{{client}}'} devient le nom du client)</span>
                <input value={greeting} onChange={(e) => setGreeting(e.target.value)} maxLength={140} placeholder="Pour {{client}}" className={inputCls} /></label>
            )}
          </div>
          <label className="block">
            <span className={labelCls}>Message</span>
            <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} />
          </label>
        </div>
      )}
    </Modal>
  );
}
