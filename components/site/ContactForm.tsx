'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { submitSiteRequest, type SiteRequestInput } from '@/server/site';
import { cn } from '@/lib/utils';

// Formulaire de contact du site : une demande de devis pour le logiciel, ou un message.
// Second (et dernier) composant client du site, avec le menu. L'envoi passe par l'action serveur
// submitSiteRequest, qui valide et renvoie un message d'erreur à afficher tel quel.

type Kind = SiteRequestInput['kind'];

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: 'devis', label: 'Demander un devis', hint: 'Une proposition pour votre activité' },
  { value: 'message', label: 'Envoyer un message', hint: 'Une question, une remarque' },
];

const TEAM_SIZES = ['Je travaille seul', '2 à 5 personnes', '6 à 15 personnes', 'Plus de 15 personnes'];

const field =
  'w-full h-[52px] px-4 bg-white border border-gray-200 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100 transition-colors';
const labelCls = 'block text-[15px] font-medium text-gray-800 mb-2';
const optional = <span className="font-normal text-gray-500"> (facultatif)</span>;

export default function ContactForm({ initialKind }: { initialKind: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [values, setValues] = useState({ name: '', email: '', phone: '', company: '', teamSize: '', message: '', website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // Une fois le message parti, le lecteur d'écran et le clavier arrivent sur la confirmation.
  useEffect(() => { if (sent) doneRef.current?.focus(); }, [sent]);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    const result = await submitSiteRequest({
      kind,
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      company: values.company || undefined,
      teamSize: kind === 'devis' ? values.teamSize || undefined : undefined,
      message: values.message,
      website: values.website,
    }).catch(() => ({ error: 'L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez.' }));
    setSending(false);
    if (result.error) { setError(result.error); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <div role="status" className="rounded-[28px] bg-white border border-gray-200 p-6 sm:p-10">
        <span className="w-12 h-12 rounded-full bg-sage text-white flex items-center justify-center" aria-hidden>
          <Check className="h-6 w-6" strokeWidth={2.6} />
        </span>
        <h2 ref={doneRef} tabIndex={-1} className="site-h2 mt-6 outline-none">Message envoyé</h2>
        <p className="site-body text-gray-700 mt-4 max-w-[48ch]">
          {kind === 'devis' ? 'Votre demande de devis est bien arrivée.' : 'Votre message est bien arrivé.'} Nous vous répondons par email.
        </p>
        <p className="site-body text-gray-700 mt-3 max-w-[48ch]">
          Un accusé de réception vient de partir à l’adresse <strong className="font-semibold text-gray-900 break-all">{values.email.trim()}</strong>. S’il n’arrive pas, regardez dans les courriers indésirables.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative rounded-[28px] bg-white border border-gray-200 p-5 sm:p-8 lg:p-10">
      <fieldset>
        <legend className={labelCls}>Votre demande</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {KINDS.map((k) => (
            <label key={k.value} className={cn('relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-100',
              kind === k.value ? 'border-primary bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300')}>
              <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
              <span className={cn('flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center', kind === k.value ? 'border-primary' : 'border-gray-300')} aria-hidden>
                {kind === k.value && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </span>
              <span>
                <span className="block text-base font-semibold text-gray-900">{k.label}</span>
                <span className="block text-sm text-gray-600 mt-0.5">{k.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-7">
        <div>
          <label htmlFor="contact-nom" className={labelCls}>Nom</label>
          <input id="contact-nom" name="name" autoComplete="name" value={values.name} onChange={set('name')} className={field} />
        </div>
        <div>
          <label htmlFor="contact-email" className={labelCls}>Adresse email</label>
          <input id="contact-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set('email')} placeholder="vous@exemple.fr" className={field} />
        </div>
        <div>
          <label htmlFor="contact-telephone" className={labelCls}>Téléphone{optional}</label>
          <input id="contact-telephone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} className={field} />
        </div>
        <div>
          <label htmlFor="contact-entreprise" className={labelCls}>Entreprise{optional}</label>
          <input id="contact-entreprise" name="company" autoComplete="organization" value={values.company} onChange={set('company')} className={field} />
        </div>

        {kind === 'devis' && (
          <div className="sm:col-span-2">
            <label htmlFor="contact-equipe" className={labelCls}>Taille de votre équipe</label>
            <select id="contact-equipe" name="teamSize" value={values.teamSize} onChange={set('teamSize')} className={cn(field, 'pr-10')}>
              <option value="">Choisir</option>
              {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor="contact-message" className={labelCls}>{kind === 'devis' ? 'Votre activité et votre besoin' : 'Votre message'}</label>
          <textarea id="contact-message" name="message" rows={6} value={values.message} onChange={set('message')}
            placeholder={kind === 'devis' ? 'Le type d’événements que vous faites, leur nombre par an, ce que vous attendez du logiciel.' : ''}
            className={cn(field, 'h-auto py-3.5 leading-relaxed resize-y min-h-[150px]')} />
        </div>
      </div>

      {/* Champ piège : invisible et hors tabulation pour une personne ; un robot le remplit. */}
      <div aria-hidden className="absolute w-px h-px overflow-hidden opacity-0 pointer-events-none" style={{ left: '-9999px' }}>
        <label htmlFor="contact-site-web">Site web</label>
        <input id="contact-site-web" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </div>

      {error && <p role="alert" className="mt-6 text-[15px] text-danger bg-white border border-danger/30 rounded-2xl px-4 py-3">{error}</p>}

      <button type="submit" disabled={sending}
        className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 h-[54px] px-8 rounded-2xl bg-gray-900 text-white text-base font-semibold hover:bg-gray-800 disabled:opacity-60 transition-colors">
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Envoi…</> : kind === 'devis' ? 'Envoyer la demande' : 'Envoyer le message'}
      </button>
    </form>
  );
}
