'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Send, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { btnGhost, btnPrimary, errorCls, inputCls, labelCls } from '@/components/ui/kit';
import { quoteRecipientSuggestions, sendQuoteToClient, type RecipientSuggestion, type SendQuoteResult } from '@/server/quotes';
import { MAX_RECIPIENTS, isValidEmail, normalizeEmail, splitEmails } from '@/lib/emailList';
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

/** Séparateurs qui valident l'adresse en cours de saisie. */
const SEPARATORS = ['Enter', ',', ';', ' '];

// Envoi du devis au client par email : un lien vers le devis en ligne, pas de pièce jointe.
// Plusieurs destinataires possibles : chacun reçoit son propre email, avec le même lien.
export default function SendQuoteModal({ quote, companyName, onClose, onSent }: {
  quote: SendableQuote;
  companyName?: string | null;
  onClose: () => void;
  /** Appelé après l'envoi : nouveau statut s'il a changé, adresses servies, email du client enregistré sur le devis. */
  onSent?: (result: { status?: string; to: string[]; clientEmail?: string | null }) => void;
}) {
  const [recipients, setRecipients] = useState<string[]>(() => (quote.client_email ? splitEmails(quote.client_email) : []));
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [copyToMe, setCopyToMe] = useState(false);
  const [message, setMessage] = useState(() => defaultSendMessage(quote, companyName));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendQuoteResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    quoteRecipientSuggestions(quote.id)
      .then((res) => { if (!cancelled) { setSuggestions(res.suggestions); setAccountEmail(res.accountEmail); } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [quote.id]);

  const invalid = recipients.filter((e) => !isValidEmail(e));

  /** Ajoute des adresses à la liste (sans doublon) ; renvoie la liste obtenue. */
  const addEmails = (emails: string[]) => {
    const next = [...recipients];
    for (const e of emails.map(normalizeEmail)) if (e && !next.includes(e)) next.push(e);
    setRecipients(next);
    setError(null);
    return next;
  };
  /** Valide le texte en cours de saisie. */
  const commitDraft = () => {
    if (!draft.trim()) return recipients;
    const next = addEmails(splitEmails(draft));
    setDraft('');
    return next;
  };
  const remove = (email: string) => setRecipients((list) => list.filter((e) => e !== email));
  /** Une adresse mal tapée revient dans le champ pour être corrigée. */
  const edit = (email: string) => {
    remove(email);
    setDraft(email);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (SEPARATORS.includes(e.key) && draft.trim()) { e.preventDefault(); commitDraft(); return; }
    if (e.key === 'Enter') e.preventDefault();
    if (e.key === 'Backspace' && !draft && recipients.length) edit(recipients[recipients.length - 1]);
  };
  // Clavier de téléphone : la touche n'est pas toujours connue, on découpe dès qu'un séparateur apparaît.
  const onChange = (value: string) => {
    if (/[\s,;]/.test(value)) {
      const parts = value.split(/[\s,;]+/);
      const last = /[\s,;]$/.test(value) ? '' : parts.pop() ?? '';
      addEmails(parts.flatMap(splitEmails));
      setDraft(last);
    } else setDraft(value);
  };
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\s,;<]/.test(text.trim())) return;
    e.preventDefault();
    addEmails(splitEmails(draft + ' ' + text));
    setDraft('');
  };

  const submit = async () => {
    const list = commitDraft();
    const bad = list.filter((e) => !isValidEmail(e));
    if (list.length === 0) { setError('Indiquez l’adresse email du client.'); inputRef.current?.focus(); return; }
    if (bad.length) { setError(bad.length === 1 ? `L’adresse « ${bad[0]} » n’est pas valide. Corrigez-la ou retirez-la.` : `Ces adresses ne sont pas valides : ${bad.join(', ')}. Corrigez-les ou retirez-les.`); return; }
    if (list.length > MAX_RECIPIENTS) { setError(`Un devis part à ${MAX_RECIPIENTS} adresses au plus. Retirez-en ${list.length - MAX_RECIPIENTS}.`); return; }
    setSending(true); setError(null);
    const res = await sendQuoteToClient({ quoteId: quote.id, to: list, message, copyToMe })
      .catch((): SendQuoteResult => ({ error: 'L’envoi a échoué. Réessayez dans un instant.' }));
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setResult(res);
    onSent?.({ status: res.status, to: res.sent ?? list, clientEmail: res.clientEmail });
  };

  const others = suggestions.filter((s) => !recipients.includes(s.email));
  const sent = result?.sent ?? [];
  const failed = result?.failed ?? [];

  return (
    <Modal
      title={result ? 'Devis envoyé' : 'Envoyer le devis au client'}
      onClose={onClose}
      footer={result
        ? <button onClick={onClose} className={btnPrimary}>Fermer</button>
        : <>
            <button onClick={onClose} className={btnGhost}>Annuler</button>
            {/* Pas de perte de focus au clic : l'adresse en cours de saisie ne devient pas une pastille
                (ce qui déplacerait le bouton sous le pointeur) ; l'envoi la reprend lui-même. */}
            <button onClick={submit} onMouseDown={(e) => e.preventDefault()} disabled={sending} className={btnPrimary}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer
            </button>
          </>}
    >
      {result ? (
        <div className="space-y-3 pb-3 text-[15px] text-gray-700">
          {sent.length === 1 ? (
            <p>L’email est parti à <strong className="text-gray-900">{sent[0]}</strong>.</p>
          ) : (
            <>
              <p>L’email est parti à {sent.length} adresses :</p>
              <ul aria-label="Adresses servies" className="space-y-1">
                {sent.map((e) => <li key={e} className="font-semibold text-gray-900 break-all">{e}</li>)}
              </ul>
            </>
          )}
          {failed.length > 0 && (
            <p role="alert" className={errorCls}>
              L’envoi a échoué pour {failed.length === 1 ? 'cette adresse' : 'ces adresses'} : <strong>{failed.join(', ')}</strong>. Vérifiez-{failed.length === 1 ? 'la' : 'les'} puis renvoyez le devis à {failed.length === 1 ? 'cette personne' : 'ces personnes'}.
            </p>
          )}
          {result.copySent === true && <p>Une copie vous a été envoyée.</p>}
          {result.copySent === false && <p className="text-danger">La copie à votre adresse n’a pas pu partir.</p>}
          <p>{sent.length === 1 ? 'Il contient' : 'Chacun reçoit son propre email, avec'} un lien pour consulter le devis en ligne et l’enregistrer en PDF. Les réponses arriveront dans votre boîte.</p>
        </div>
      ) : (
        <div className="space-y-4 pb-3">
          {error && <p role="alert" className={errorCls}>{error}</p>}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="send-to" className={labelCls}>Destinataires</label>
              {recipients.length > 1 && <span className={cn('text-sm mb-2', recipients.length > MAX_RECIPIENTS ? 'text-danger' : 'text-gray-500')}>{recipients.length} / {MAX_RECIPIENTS}</span>}
            </div>
            <div
              onClick={(e) => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}
              className={cn('flex flex-wrap items-center gap-1.5 min-h-12 p-1.5 bg-white border rounded-xl focus-within:ring-4 transition-colors',
                invalid.length ? 'border-danger/60 focus-within:ring-danger/10' : 'border-gray-200 focus-within:border-primary-400 focus-within:ring-primary-100')}
            >
              {recipients.map((email) => {
                const ok = isValidEmail(email);
                return (
                  <span key={email} data-recipient={email}
                    className={cn('inline-flex items-center max-w-full h-10 pl-3 rounded-lg text-[15px]', ok ? 'bg-sage-100 text-forest' : 'bg-white border border-danger text-danger')}>
                    {ok
                      ? <span className="truncate">{email}</span>
                      : <button type="button" onClick={() => edit(email)} className="truncate h-10 text-left" title="Corriger cette adresse">{email}<span className="sr-only"> : adresse non valide, cliquez pour la corriger</span></button>}
                    <button type="button" onClick={() => remove(email)} aria-label={`Retirer ${email}`} className="inline-flex items-center justify-center w-10 h-10 flex-shrink-0 rounded-lg hover:bg-black/5">
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                );
              })}
              <input
                ref={inputRef} id="send-to" type="text" inputMode="email" autoComplete="off" autoCapitalize="off" spellCheck={false}
                value={draft} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} onBlur={commitDraft}
                placeholder={recipients.length ? 'Ajouter une adresse' : 'client@exemple.fr'}
                aria-describedby="send-to-help"
                className="flex-1 min-w-[12rem] h-10 px-2.5 bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <p id="send-to-help" className="mt-1.5 text-sm text-gray-500">
              {invalid.length
                ? <span className="text-danger">{invalid.length === 1 ? `« ${invalid[0]} » n’est pas une adresse valide. Touchez-la pour la corriger, ou retirez-la.` : `${invalid.length} adresses ne sont pas valides. Touchez-les pour les corriger, ou retirez-les.`}</span>
                : 'Pour envoyer à plusieurs personnes, tapez une adresse puis Entrée, ou collez une liste.'}
            </p>
          </div>

          {others.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Autres adresses de ce client</p>
              <div className="flex flex-wrap gap-2">
                {others.map((s) => (
                  <button key={s.email} type="button" onClick={() => addEmails([s.email])} aria-label={`Ajouter ${s.email}`}
                    className="inline-flex items-center gap-2 max-w-full min-h-10 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-left text-sm hover:border-gray-300">
                    <Plus className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    <span className="min-w-0">
                      <span className="block text-gray-900 break-all">{s.email}</span>
                      <span className="block text-gray-500">{s.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="send-message" className={labelCls}>Message</label>
            <textarea id="send-message" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className={cn(inputCls, 'h-auto py-3 resize-none')} />
          </div>

          {accountEmail && (
            <label onMouseDown={(e) => e.preventDefault()} className="flex items-center gap-3 min-h-10 cursor-pointer text-[15px] text-gray-700">
              <input type="checkbox" checked={copyToMe} onChange={(e) => setCopyToMe(e.target.checked)} className="w-5 h-5 rounded accent-[rgb(var(--p-600))]" />
              <span>M’envoyer une copie <span className="text-gray-500 break-all">({accountEmail})</span></span>
            </label>
          )}

          <p className="text-sm text-gray-500">Chaque destinataire reçoit son propre email avec un lien vers le devis, pas de pièce jointe : personne ne voit les adresses des autres. À l’envoi, un devis encore à faire passe en « Devis envoyé ».</p>
        </div>
      )}
    </Modal>
  );
}
