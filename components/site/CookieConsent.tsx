'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Mesure d'audience du site de présentation (Google Tag Manager), chargée seulement après l'accord du visiteur,
// comme le demande la CNIL. Refuser est aussi simple qu'accepter ; le choix est gardé 6 mois dans le navigateur,
// puis redemandé. Le lien « Cookies » du pied de page rouvre le bandeau (événement OPEN_EVENT).
// Le logiciel connecté n'est jamais concerné : ce composant n'est monté que dans SiteShell.

const GTM_ID = 'GTM-WQKDB2ST';
const STORAGE_KEY = 'webodevis:cookies';
const MAX_AGE_MS = 182 * 86400_000;
export const OPEN_EVENT = 'webodevis:cookies-open';

type Choice = 'accepte' | 'refuse';

function readChoice(): Choice | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { v?: Choice; at?: number };
    if ((saved.v !== 'accepte' && saved.v !== 'refuse') || !saved.at || Date.now() - saved.at > MAX_AGE_MS) return null;
    return saved.v;
  } catch {
    return null;
  }
}

function saveChoice(v: Choice) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v, at: Date.now() }));
  } catch {
    // Stockage indisponible (navigation privée) : le bandeau reviendra à la prochaine visite.
  }
}

type GtmWindow = Window & { dataLayer?: unknown[]; __webodevisGtm?: boolean };

function loadGtm() {
  const w = window as GtmWindow;
  if (w.__webodevisGtm) return;
  w.__webodevisGtm = true;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(s);
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const choice = readChoice();
    if (choice === 'accepte') loadGtm();
    else if (choice === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  const decide = (v: Choice) => {
    const wasLoaded = !!(window as GtmWindow).__webodevisGtm;
    saveChoice(v);
    setOpen(false);
    if (v === 'accepte') loadGtm();
    // Un accord retiré : on recharge pour que les scripts déjà chargés s'arrêtent.
    else if (wasLoaded) window.location.reload();
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookies de mesure d’audience"
      className="site-cookies fixed inset-x-3 z-50 sm:left-auto sm:right-4 sm:max-w-[420px] rounded-2xl bg-white text-gray-900 ring-1 ring-black/10 shadow-float p-5"
    >
      <p className="text-[15px] leading-relaxed text-gray-700">
        Nous aimerions mesurer la fréquentation du site pour l’améliorer. Ces cookies ne sont déposés qu’avec votre accord,
        et jamais dans le logiciel.{' '}
        <Link href="/confidentialite#cookies" className="underline underline-offset-4 hover:text-gray-900">En savoir plus</Link>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => decide('refuse')} className="h-11 rounded-xl border border-gray-300 bg-white text-[15px] font-semibold text-gray-900 hover:border-gray-400">
          Refuser
        </button>
        <button type="button" onClick={() => decide('accepte')} className="h-11 rounded-xl border border-gray-300 bg-white text-[15px] font-semibold text-gray-900 hover:border-gray-400">
          Accepter
        </button>
      </div>
    </div>
  );
}

/** Lien du pied de page qui rouvre le bandeau pour changer d'avis. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Cookies
    </button>
  );
}
