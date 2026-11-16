'use client';

// La formule d'abonnement (une seule : au mois) et le bouton « S'abonner » (vers Stripe Checkout). Montants : lib/pricing.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MONTHLY_HT, euros, subscribeSummary, ttc } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { startCheckout } from '@/server/billingActions';

interface PlanCardsProps {
  /** Seul le titulaire voit le bouton de paiement. */
  canSubscribe: boolean;
  testMode: boolean;
  /** Premier abonnement : la mise en service s'ajoute au premier paiement. */
  setupDue: boolean;
  /** Bouton plein largeur, comme sur les écrans de connexion. */
  buttonClassName: string;
}

export default function PlanCards({ canSubscribe, testMode, setupDue, buttonClassName }: PlanCardsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    const res = await startCheckout('mensuel').catch(() => ({ error: 'Le paiement n’a pas pu être ouvert. Réessayez dans un instant.', url: undefined }));
    if (res.error || !res.url) {
      setError(res.error ?? 'Le paiement n’a pas pu être ouvert. Réessayez dans un instant.');
      setBusy(false);
      return;
    }
    window.location.href = res.url;
  };

  return (
    <div>
      {testMode && (
        <p className="mb-3 inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800">
          Mode test
        </p>
      )}
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
        <span className="block text-sm font-semibold text-gray-900">Abonnement WeboDevis</span>
        <span className="mt-1 block whitespace-nowrap text-lg font-bold text-gray-900 tabular-nums">{euros(MONTHLY_HT)} HT / mois</span>
        <span className="mt-0.5 block text-sm text-gray-500">{euros(ttc(MONTHLY_HT))} TTC · sans engagement</span>
      </div>
      <p className="mt-4 text-sm text-gray-600">{subscribeSummary(setupDue)}</p>
      {canSubscribe && (
        <>
          {error && <p role="alert" className="mt-4 rounded-2xl border border-danger/30 bg-white px-4 py-3 text-sm text-danger">{error}</p>}
          <button type="button" onClick={subscribe} disabled={busy} className={cn(buttonClassName, 'mt-5')}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}S’abonner
          </button>
          <p className="mt-3 text-xs text-gray-500">Paiement sécurisé par Stripe.</p>
        </>
      )}
    </div>
  );
}
