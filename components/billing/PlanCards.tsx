'use client';

// Les deux formules d'abonnement et le bouton « S'abonner » (vers Stripe Checkout). Montants : lib/pricing.

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { FIRST_MONTH_HT, MONTHLY_HT, SETUP_HT, YEARLY_HT, euros, ttc } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import type { Plan } from '@/lib/stripe';
import { startCheckout } from '@/server/billingActions';

export const PLANS: { value: Plan; label: string; price: string; detail: string }[] = [
  { value: 'mensuel', label: 'Mensuel', price: `${euros(MONTHLY_HT)} HT / mois`, detail: `${euros(ttc(MONTHLY_HT))} TTC` },
  { value: 'annuel', label: 'Annuel', price: `${euros(YEARLY_HT)} HT / an`, detail: `${euros(ttc(YEARLY_HT))} TTC · 1 mois offert` },
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
  /** Premier abonnement : la mise en service s'ajoute au premier paiement. */
  setupDue: boolean;
  /** Bouton plein largeur, comme sur les écrans de connexion. */
  buttonClassName: string;
}

export default function PlanCards({ canSubscribe, testMode, setupDue, buttonClassName }: PlanCardsProps) {
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
      {setupDue && (
        <p className="mt-4 text-sm text-gray-600">
          {plan === 'mensuel'
            ? <>Premier mois&nbsp;: <strong className="font-semibold text-gray-900 tabular-nums">{euros(FIRST_MONTH_HT)} HT</strong>, mise en service comprise (formation, modèles de devis, prestations, import de vos clients). Ensuite {euros(MONTHLY_HT)} HT par mois.</>
            : <>Premier paiement&nbsp;: <strong className="font-semibold text-gray-900 tabular-nums">{euros(YEARLY_HT + SETUP_HT)} HT</strong>, soit l’année et la mise en service ({euros(SETUP_HT)} HT, formation, modèles de devis, prestations, import de vos clients). Une heure de formation en plus et un SAV prioritaire.</>}
        </p>
      )}
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
