'use client';

import { useEffect, useState } from 'react';
import { getAdminSettings, getBillingEnforcedAdmin, setBillingEnforcedAdmin, setSignupOpen } from '@/server/admin';
import { cardCls, errorCls } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

export default function AdminSettingsPage() {
  const [signupOpen, setOpen] = useState<boolean | null>(null);
  const [enforced, setEnforced] = useState<boolean | null>(null);
  const [testMode, setTestMode] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSettings().then((s) => setOpen(s.signup_open));
    getBillingEnforcedAdmin().then((b) => { setEnforced(b.on); setTestMode(b.testMode); })
      .catch(() => setError('Le réglage « Abonnement obligatoire » n’a pas pu être lu. Rechargez la page.'));
  }, []);

  const toggleEnforced = async () => {
    if (enforced === null) return;
    const next = !enforced;
    setEnforced(next); setError(null);
    const res = await setBillingEnforcedAdmin(next).catch(() => ({ error: 'Le réglage n’a pas été enregistré. Réessayez.' }));
    if (res.error) { setEnforced(!next); setError(res.error); }
  };

  const toggle = async () => {
    if (signupOpen === null) return;
    const next = !signupOpen;
    setOpen(next); setError(null);
    const res = await setSignupOpen(next).catch(() => ({ error: 'Le réglage n’a pas été enregistré. Réessayez.' }));
    if (res.error) { setOpen(!next); setError(res.error); }
  };

  return (
    <div className="px-4 md:px-6 pb-8 max-w-3xl">
      <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight mb-5">Réglages</h1>
      {error && <p role="alert" className={cn(errorCls, 'mb-4')}>{error}</p>}

      <section className={cn(cardCls, 'p-5')}>
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inscriptions ouvertes</h2>
            <p className="text-[15px] text-gray-600 mt-1">
              Ouvertes : tout le monde peut créer un compte depuis la page d’inscription, et le site affiche « Créer un compte ».
              Fermées : seuls les administrateurs créent des comptes, depuis la page Comptes.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={!!signupOpen} aria-label="Inscriptions ouvertes" disabled={signupOpen === null} onClick={toggle}
            className={cn('relative w-12 h-7 rounded-full flex-shrink-0 mt-1 transition-colors disabled:opacity-40', signupOpen ? 'bg-primary' : 'bg-gray-300')}>
            <span className={cn('absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform', signupOpen && 'translate-x-5')} />
          </button>
        </div>
      </section>

      <section className={cn(cardCls, 'p-5 mt-4')}>
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Abonnement obligatoire</h2>
            <p className="text-[15px] text-gray-600 mt-1">
              Éteint : tout le monde a l’accès complet, comme aujourd’hui. Allumé : un compte sans abonnement actif (ni accès offert) ne fait plus que consulter et exporter ses données.
            </p>
            {testMode !== null && (
              <p className="text-sm text-gray-500 mt-2">Stripe est en mode {testMode ? 'test' : 'live'}.</p>
            )}
          </div>
          <button type="button" role="switch" aria-checked={!!enforced} aria-label="Abonnement obligatoire" disabled={enforced === null} onClick={toggleEnforced}
            className={cn('relative w-12 h-7 rounded-full flex-shrink-0 mt-1 transition-colors disabled:opacity-40', enforced ? 'bg-primary' : 'bg-gray-300')}>
            <span className={cn('absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform', enforced && 'translate-x-5')} />
          </button>
        </div>
      </section>
    </div>
  );
}
