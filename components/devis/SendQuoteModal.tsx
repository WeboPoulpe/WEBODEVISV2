'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { sendQuoteToClient } from '@/server/quotes';
import { cn } from '@/lib/utils';

export interface SendableQuote {
  id: string;
  client_email: string | null;
  event_type: string | null;
  event_date: string | null;
}

/** Message proposé : l'événement, sa date et la signature de l'entreprise. */
export function defaultSendMessage(q: SendableQuote, companyName?: string | null) {
  const when = q.event_date ? ` du ${new Date(q.event_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
  return `Vous trouverez ci-dessous notre proposition pour votre ${(q.event_type || 'événement').toLowerCase()}${when}.\n\nNous restons à votre disposition pour en discuter ou l'ajuster.\n\n${companyName ?? ''}`.trim();
}

// Envoi du devis au client par email : un lien vers le devis en ligne, pas de pièce jointe.
export default function SendQuoteModal({ quote, companyName, onClose, onSent }: {
  quote: SendableQuote;
  companyName?: string | null;
  onClose: () => void;
  /** Appelé après l'envoi, avec le nouveau statut du devis s'il a changé. */
  onSent?: (result: { status?: string; to: string }) => void;
}) {
  const [to, setTo] = useState(quote.client_email ?? '');
  const [message, setMessage] = useState(() => defaultSendMessage(quote, companyName));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSending(true); setError(null);
    const res = await sendQuoteToClient({ quoteId: quote.id, to, message })
      .catch(() => ({ error: 'L’envoi a échoué. Réessayez dans un instant.' } as Awaited<ReturnType<typeof sendQuoteToClient>>));
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setDone(true);
    onSent?.({ status: res.status, to: to.trim().toLowerCase() });
  };

  return (
    <Modal
      title={done ? 'Devis envoyé' : 'Envoyer le devis au client'}
      onClose={onClose}
      footer={done
        ? <button onClick={onClose} className={btnPrimary}>Fermer</button>
        : <>
            <button onClick={onClose} className={btnGhost}>Annuler</button>
            <button onClick={submit} disabled={sending} className={btnPrimary}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer
            </button>
          </>}
    >
      {done ? (
        <p className="text-[15px] text-gray-700 pb-3">
          L’email est parti à <strong className="text-gray-900">{to}</strong>. Il contient un lien pour consulter le devis en ligne et l’enregistrer en PDF. Les réponses du client arriveront dans votre boîte.
        </p>
      ) : (
        <div className="space-y-4 pb-3">
          {error && <p role="alert" className={errorCls}>{error}</p>}
          <div>
            <label htmlFor="send-to" className={labelCls}>Email du client</label>
            <input id="send-to" type="email" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@exemple.fr" className={inputCls} />
          </div>
          <div>
            <label htmlFor="send-message" className={labelCls}>Message</label>
            <textarea id="send-message" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className={cn(inputCls, 'h-auto py-3 resize-none')} />
          </div>
          <p className="text-sm text-gray-500">Le client reçoit un lien vers le devis, pas de pièce jointe. À l’envoi, un devis encore à faire passe en « Devis envoyé ».</p>
        </div>
      )}
    </Modal>
  );
}
