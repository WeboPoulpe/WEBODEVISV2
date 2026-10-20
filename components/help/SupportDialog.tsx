'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isDemoUser } from '@/lib/demo';
import { contactSupport, type SupportTopic } from '@/server/support';
import { btnPrimary, btnSecondary, errorCls, iconBtn, inputCls, labelCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

// « Écrire au support », ouvert depuis le centre d'aide. Posée au-dessus du centre d'aide (z-70),
// d'où une fenêtre propre plutôt que Modal (z-50, qui passerait dessous).

const TOPICS: { id: SupportTopic; label: string }[] = [
  { id: 'question', label: 'Question' },
  { id: 'probleme', label: 'Problème' },
  { id: 'suggestion', label: 'Suggestion' },
];

/** La page en cours et le navigateur, lus au moment de l'envoi (jamais au rendu). */
function browserContext() {
  const ua = navigator.userAgent;
  const name = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Autre';
  const device = /iPhone|iPad|Android/i.test(ua) ? (ua.match(/iPhone|iPad|Android[^;)]*/i)?.[0] ?? 'Mobile') : (ua.match(/Windows NT [\d.]+|Mac OS X [\d_]+|Linux/)?.[0]?.replace(/_/g, '.') ?? '');
  return {
    page: window.location.pathname + window.location.search,
    browser: `${name}, ${device ? `${device}, ` : ''}écran ${window.innerWidth}x${window.innerHeight} — ${ua}`,
  };
}

export default function SupportDialog({ onClose }: { onClose: () => void }) {
  const { user, actingAsAdmin } = useAuth();
  const [topic, setTopic] = useState<SupportTopic>('question');
  const [message, setMessage] = useState('');
  const [attach, setAttach] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const demo = isDemoUser(user?.id);
  const blocked = demo || actingAsAdmin;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // À l'ouverture, avec souris et clavier : le curseur dans le message. Pas sur téléphone, où le clavier
  // ouvert d'office cacherait le choix du sujet.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) ref.current?.querySelector<HTMLElement>('textarea, a, button[data-autofocus]')?.focus();
  }, []);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await contactSupport({ topic, message, context: attach ? browserContext() : null });
      if (res.error) setError(res.error);
      else setSent(true);
    } catch {
      setError('Le message n’est pas parti. Vérifiez votre connexion, puis réessayez.');
    }
    setSending(false);
  };

  return (
    <div ref={ref} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-float animate-sheet-up sm:animate-none">
        <div className="flex items-center justify-between gap-3 pl-5 pr-3 pt-4 pb-2 flex-shrink-0">
          <h2 id="support-title" className="text-lg font-semibold text-gray-900">Écrire au support</h2>
          <button onClick={onClose} className={iconBtn} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {sent ? (
            <div className="py-4 text-center" role="status">
              <span className="mx-auto w-12 h-12 rounded-full bg-sage-100 text-sage flex items-center justify-center"><Check className="h-6 w-6" /></span>
              <p className="font-semibold text-gray-900 mt-3">Message envoyé</p>
              <p className="text-sm text-gray-600 mt-1">Nous vous répondons par email{user?.email ? ` à ${user.email}` : ''}. Un accusé de réception vient de partir.</p>
            </div>
          ) : blocked ? (
            <p className="rounded-2xl bg-gray-50 px-4 py-4 text-[15px] text-gray-700">
              {demo
                ? <>Le support n’est pas ouvert depuis la démonstration. Pour une question, écrivez-nous depuis la <a href="/contact" className="font-medium text-primary underline">page Contact</a>.</>
                : 'Vous êtes dans le compte d’un client : seul son titulaire peut écrire au support.'}
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-[15px] text-gray-600">Une question, un souci, une idée : l’équipe WeboDevis vous répond par email.</p>
              <fieldset>
                <legend className={labelCls}>Sujet</legend>
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
                  {TOPICS.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={topic === t.id} onClick={() => setTopic(t.id)}
                      className={cn('h-11 rounded-xl text-sm font-medium border transition-colors',
                        topic === t.id ? 'bg-forest text-white border-forest' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300')}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="support-message" className={labelCls}>Message</label>
                <textarea id="support-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={4000}
                  placeholder={topic === 'probleme' ? 'Ce que vous faisiez, ce qui s’est passé, ce que vous attendiez.' : 'Écrivez votre message.'}
                  className={cn(inputCls, 'h-auto py-3 resize-y')} />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-primary flex-shrink-0" />
                <span className="text-sm text-gray-700">Joindre la page où je suis et les informations de mon navigateur</span>
              </label>
              {error && <p className={errorCls} role="alert">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 pt-3 border-t border-gray-200" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          {sent || blocked ? (
            <button onClick={onClose} className={btnSecondary} data-autofocus>Fermer</button>
          ) : (
            <>
              <button onClick={onClose} className={btnSecondary}>Annuler</button>
              <button onClick={send} disabled={sending || message.trim().length < 10} className={btnPrimary}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}Envoyer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
