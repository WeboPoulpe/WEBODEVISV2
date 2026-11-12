'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { EVENT_TYPES } from '@/lib/annuaire/eventTypes';
import { submitDirectoryRequest } from '@/server/directoryRequest';
import { useDirectoryHref } from './BaseContext';

// Formulaire de contact d'une fiche. La demande part au seul traiteur de la fiche (ses Prospects, et un e-mail) ;
// le visiteur reçoit un récapitulatif. Un champ caché (website) et l'heure d'ouverture du formulaire écartent les robots.

const today = () => new Date().toISOString().slice(0, 10);

export default function ContactForm({ slug, name, eventTypes }: { slug: string; name: string; eventTypes: string[] }) {
  const href = useDirectoryHref();
  const id = useId();
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const success = useRef<HTMLDivElement>(null);
  // Les types que propose ce traiteur d'abord, puis les autres.
  const types = [...eventTypes.filter((t) => (EVENT_TYPES as readonly string[]).includes(t)), ...EVENT_TYPES.filter((t) => !eventTypes.includes(t))];

  useEffect(() => setStartedAt(Date.now()), []);
  useEffect(() => { if (sentTo) success.current?.focus(); }, [sentTo]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '');
    setError(null);
    start(async () => {
      const r = await submitDirectoryRequest(slug, {
        firstName: v('firstName'), lastName: v('lastName'), email: v('email'), phone: v('phone'),
        eventType: v('eventType'), eventDate: v('eventDate'), guestCount: v('guestCount'), location: v('location'),
        message: v('message'), website: v('website'), startedAt,
      }).catch(() => ({ error: 'La demande n’est pas partie : vérifiez votre connexion, puis réessayez.' }));
      if (r.error) setError(r.error);
      else setSentTo(v('email').trim());
    });
  };

  if (sentTo) {
    return (
      <div ref={success} tabIndex={-1} role="status" className="cmt-success">
        <h3>Demande envoyée</h3>
        <p>{name} a bien reçu votre demande et vous répondra par e-mail ou par téléphone.</p>
        <p>Un récapitulatif vient de partir à {sentTo}.</p>
      </div>
    );
  }

  const f = (k: string) => `${id}-${k}`;
  return (
    <form className="cmt-form" onSubmit={onSubmit}>
      <div className="cmt-field">
        <label htmlFor={f('first')}>Prénom</label>
        <input id={f('first')} name="firstName" autoComplete="given-name" required maxLength={80} />
      </div>
      <div className="cmt-field">
        <label htmlFor={f('last')}>Nom</label>
        <input id={f('last')} name="lastName" autoComplete="family-name" required maxLength={80} />
      </div>
      <div className="cmt-field">
        <label htmlFor={f('email')}>E-mail</label>
        <input id={f('email')} name="email" type="email" autoComplete="email" required maxLength={200} />
      </div>
      <div className="cmt-field">
        <label htmlFor={f('phone')}>Téléphone <span>(facultatif)</span></label>
        <input id={f('phone')} name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </div>
      <div className="cmt-field">
        <label htmlFor={f('type')}>Type d’événement</label>
        <select id={f('type')} name="eventType" defaultValue="">
          <option value="">Choisir</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="cmt-field">
        <label htmlFor={f('date')}>Date <span>(facultatif)</span></label>
        <input id={f('date')} name="eventDate" type="date" min={startedAt ? today() : undefined} />
      </div>
      <div className="cmt-field">
        <label htmlFor={f('guests')}>Nombre d’invités <span>(facultatif)</span></label>
        <input id={f('guests')} name="guestCount" type="number" inputMode="numeric" min={1} max={99999} />
      </div>
      <div className="cmt-field">
        <label htmlFor={f('place')}>Lieu <span>(facultatif)</span></label>
        <input id={f('place')} name="location" autoComplete="address-level2" maxLength={300} placeholder="Ville ou salle de réception" />
      </div>
      <div className="cmt-field cmt-field--wide">
        <label htmlFor={f('message')}>Votre message</label>
        <textarea id={f('message')} name="message" maxLength={4000} placeholder="Le style de repas, vos envies, ce qui compte pour vous." />
      </div>
      {/* Pot de miel : invisible et hors du parcours au clavier ; seul un robot le remplit. */}
      <div className="cmt-trap" aria-hidden="true">
        <label htmlFor={f('website')}>Site web</label>
        <input id={f('website')} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error && <p role="alert" className="cmt-alert">{error}</p>}
      <div className="cmt-form__foot">
        <button type="submit" className="cmt-btn cmt-btn--primary cmt-btn--big" disabled={pending}>
          {pending ? 'Envoi en cours' : 'Envoyer ma demande'}
        </button>
        <p>
          Votre demande va à ce seul traiteur. Il vous répond directement, par e-mail ou par téléphone. Voir la page{' '}
          <Link href={href('/confidentialite')} className="cmt-link">Confidentialité</Link>.
        </p>
      </div>
    </form>
  );
}
