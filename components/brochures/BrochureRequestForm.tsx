'use client';

// Formulaire de la dernière page de la brochure : mêmes champs que le formulaire de prospection, en français ou en
// anglais selon la brochure. Après l'envoi, un remerciement le remplace.

import { useState } from 'react';
import { submitBrochureRequest, type BrochureRequestFields } from '@/server/brochureRequests';

const TEXT = {
  fr: {
    first: 'Prénom', last: 'Nom', email: 'Email', phone: 'Téléphone', event: 'Type d’événement', date: 'Date', guests: 'Invités',
    place: 'Lieu', message: 'Votre message', send: 'Envoyer ma demande', sending: 'Envoi…', thanks: 'Merci, votre demande est envoyée.',
    thanksMore: 'Vous allez recevoir un email de confirmation. Nous revenons vers vous rapidement.', choose: 'Choisir…',
    events: ['Mariage', 'Anniversaire', 'Cocktail', 'Séminaire', 'Gala', 'Communion', 'Baptême', 'Autre'],
  },
  en: {
    first: 'First name', last: 'Last name', email: 'Email', phone: 'Phone', event: 'Type of event', date: 'Date', guests: 'Guests',
    place: 'Venue', message: 'Your message', send: 'Send my request', sending: 'Sending…', thanks: 'Thank you, your request has been sent.',
    thanksMore: 'You will receive a confirmation email. We will get back to you shortly.', choose: 'Choose…',
    events: ['Wedding', 'Birthday', 'Cocktail party', 'Seminar', 'Gala', 'Communion', 'Christening', 'Other'],
  },
};

const field = 'w-full rounded-lg border border-black/15 bg-white/80 px-2.5 py-1.5 text-[13px] text-[#1C2621] outline-none focus:border-[#B4502D]';
const lab = 'block text-[11px] uppercase tracking-wider text-[#5b5b55] mb-0.5';

export default function BrochureRequestForm({ token, language }: { token: string; language: 'fr' | 'en' }) {
  const t = TEXT[language];
  const [f, setF] = useState<BrochureRequestFields>({ first_name: '', last_name: '', email: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof BrochureRequestFields, v: string) => setF((x) => ({ ...x, [k]: v }));

  if (state === 'sent') {
    return (
      <div role="status" className="text-[#1C2621]">
        <p className="text-lg font-semibold">{t.thanks}</p>
        <p className="mt-2 text-sm text-[#5b5b55]">{t.thanksMore}</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState('sending'); setError(null);
        const res = await submitBrochureRequest(token, { ...f, guest_count: Number(f.guest_count) || undefined })
          .catch(() => ({ error: language === 'en' ? 'Your request could not be sent. Please try again.' : 'La demande n’a pas pu être envoyée. Réessayez.' }));
        if (res.error) { setError(res.error); setState('idle'); return; }
        setState('sent');
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label><span className={lab}>{t.first}</span><input required value={f.first_name} onChange={(e) => set('first_name', e.target.value)} className={field} autoComplete="given-name" /></label>
        <label><span className={lab}>{t.last}</span><input required value={f.last_name} onChange={(e) => set('last_name', e.target.value)} className={field} autoComplete="family-name" /></label>
      </div>
      <label className="block"><span className={lab}>{t.email}</span><input required type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={field} autoComplete="email" /></label>
      <label className="block"><span className={lab}>{t.phone}</span><input type="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={field} autoComplete="tel" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className={lab}>{t.event}</span>
          <select value={f.event_type ?? ''} onChange={(e) => set('event_type', e.target.value)} className={field}>
            <option value="">{t.choose}</option>
            {t.events.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </label>
        <label><span className={lab}>{t.date}</span><input type="date" value={f.event_date ?? ''} onChange={(e) => set('event_date', e.target.value)} className={field} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label><span className={lab}>{t.guests}</span><input type="number" min={1} inputMode="numeric" value={f.guest_count ?? ''} onChange={(e) => set('guest_count', e.target.value)} className={field} /></label>
        <label><span className={lab}>{t.place}</span><input value={f.service_address ?? ''} onChange={(e) => set('service_address', e.target.value)} className={field} /></label>
      </div>
      <label className="block"><span className={lab}>{t.message}</span><textarea rows={3} value={f.message ?? ''} onChange={(e) => set('message', e.target.value)} className={field} /></label>
      {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}
      <button type="submit" disabled={state === 'sending'}
        className="w-full rounded-lg bg-[#B4502D] px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-60">
        {state === 'sending' ? t.sending : t.send}
      </button>
    </form>
  );
}
