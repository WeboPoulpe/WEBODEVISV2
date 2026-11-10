'use client';

// Les deux formules d'abonnement et le bouton « S'abonner » (vers Stripe Checkout). Les prix ne s'affichent que dans
// l'app, jamais sur le site public.

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Plan } from '@/lib/stripe';
import { startCheckout } from '@/server/billingActions';

export const PLANS: { value: Plan; label: string; price: string; detail: string }[] = [
  { value: 'mensuel', label: 'Mensuel', price: '100 € HT / mois', detail: '120 € TTC' },
  { value: 'annuel', label: 'Annuel', price: '1 100 € HT / an', detail: '1 320 € TTC · 1 mois offert' },
];

/** Montant d'une formule, pour la page Abonnement : « 100 € HT / mois (120 € TTC) ». */
export function planAmount(plan: Plan): string {
  const p = PLANS.find((x) => x.value === plan)!;
  return `${p.price} (${p.detail.split(' · ')[0]})`;
}

interface PlanCardsProps {
  /** Seul le titulaire voit le bouton de paiement. */
  canSubscribe: boolean;
  testMode: boolean;
  /** Bouton plein largeur, comme sur les écrans de connexion. */
  buttonClassName: string;
}

export default function PlanCards({ canSubscribe, testMode, buttonClassName }: PlanCardsProps) {
  const [plan, setPlan] = useState<Plan>('mensuel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    const res = await startCheckout(plan).catch(() => ({ error: 'Le paiement n’a pas pu être ouvert. Réessayez dans un instant.', url: undefined }));
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
      <div role="radiogroup" aria-label="Formule" className="grid gap-3 sm:grid-cols-2">
        {PLANS.map((p) => {
          const on = plan === p.value;
          return (
            <button key={p.value} type="button" role="radio" aria-checked={on} disabled={!canSubscribe || busy}
              onClick={() => setPlan(p.value)}
              className={cn('relative rounded-2xl border bg-white px-4 py-4 text-left transition-colors disabled:cursor-default',
                on && canSubscribe ? 'border-primary ring-4 ring-primary-100' : 'border-gray-200 enabled:hover:border-gray-300')}>
              <span className="block text-sm font-semibold text-gray-900">{p.label}</span>
              <span className="mt-1 block whitespace-nowrap text-lg font-bold text-gray-900 tabular-nums">{p.price}</span>
              <span className="mt-0.5 block text-sm text-gray-500">{p.detail}</span>
              {on && canSubscribe && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
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
