'use client';

// Contenu de Paramètres → Abonnement. Les boutons ouvrent Stripe (Checkout, portail) ou changent l'abonnement par
// l'API, puis la page relit l'état. Sans canManage (collaborateur, administrateur entré dans le compte), on ne montre
// que l'état.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { btnPrimary, btnSecondary, btnGhost, cardCls } from '@/components/ui/kit';
import { useFeedback } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import {
  cancelSubscription, openBillingPortal, resumeSubscription, switchToAnnual, type BillingResult,
} from '@/server/billingActions';
import type { SubscriptionView } from '@/server/subscriptionView';
import PlanCards, { planAmount } from './PlanCards';

type Action = 'annual' | 'portal' | 'cancel' | 'resume';

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
const PLAN_LABEL = { mensuel: 'Mensuel', annuel: 'Annuel' } as const;
const FAILED = 'L’opération n’a pas abouti. Réessayez dans un instant.';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 tabular-nums">{children}</dd>
    </div>
  );
}

export default function SubscriptionManager({ view, canManage }: { view: SubscriptionView; canManage: boolean }) {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [busy, setBusy] = useState<Action | null>(null);

  const run = async (action: Action, call: () => Promise<BillingResult>, done?: string) => {
    setBusy(action);
    const res = await call().catch((): BillingResult => ({ error: FAILED }));
    if (res.error) { setBusy(null); notify(res.error, { tone: 'error' }); return; }
    if (res.url) { window.location.href = res.url; return; }
    setBusy(null);
    if (done) notify(done, { tone: 'success' });
    router.refresh();
  };

  const end = view.current_period_end ? day(view.current_period_end) : null;
  const spin = (a: Action) => busy === a && <Loader2 className="h-4 w-4 animate-spin" />;

  const onAnnual = async () => {
    const ok = await confirm({
      title: 'Passer en annuel ?',
      message: 'Vous passez à 1 100 € HT / an (1 320 € TTC), soit 1 mois offert. Le temps non utilisé de votre mois en cours est déduit.',
      confirmLabel: 'Passer en annuel',
    });
    if (ok) await run('annual', switchToAnnual, 'Vous êtes maintenant sur la formule annuelle.');
  };
  const onCancel = async () => {
    const ok = await confirm({
      title: 'Annuler l’abonnement ?',
      message: `Votre abonnement s’arrêtera${end ? ` le ${end}` : ' à la fin de la période en cours'}. Jusque-là vous gardez tout. Ensuite vos données restent consultables et exportables.`,
      confirmLabel: 'Annuler l’abonnement',
      cancelLabel: 'Garder mon abonnement',
      danger: true,
    });
    if (ok) await run('cancel', cancelSubscription, 'Votre abonnement est annulé à la fin de la période.');
  };

  // Accès offert : rien à payer.
  if (view.comped) {
    return (
      <section className={cn(cardCls, 'p-5 md:p-6')}>
        <p className="text-lg font-semibold text-gray-900">Accès offert</p>
        <p className="mt-1 text-sm text-gray-600">Votre accès à WeboDevis est offert : vous n’avez rien à payer.</p>
      </section>
    );
  }

  // Sans abonnement en cours : les deux formules.
  if (!view.subscribed) {
    return (
      <section className={cn(cardCls, 'p-5 md:p-6')}>
        {view.access === 'readonly' ? (
          <>
            <p className="text-lg font-semibold text-gray-900">Abonnement inactif</p>
            <p className="mt-1 text-sm text-gray-600">Vos données restent consultables et exportables. Réabonnez-vous pour les modifier à nouveau.</p>
          </>
        ) : (
          <p className="text-lg font-semibold text-gray-900">Choisissez votre formule</p>
        )}
        {!canManage && <p className="mt-3 text-sm text-gray-600">Seul le titulaire du compte peut gérer l’abonnement.</p>}
        <div className="mt-5">
          <PlanCards canSubscribe={canManage} testMode={view.testMode} buttonClassName={cn(btnPrimary, 'w-full sm:w-auto')} />
        </div>
      </section>
    );
  }

  const plan = view.plan;
  return (
    <div className="space-y-4">
      {view.status === 'past_due' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-white px-5 py-4 text-sm">
          <p className="min-w-0 flex-1 text-danger">Le dernier paiement a échoué, mettez à jour votre carte.</p>
          {canManage && (
            <button type="button" disabled={!!busy} onClick={() => run('portal', openBillingPortal)} className={btnSecondary}>
              {spin('portal')}Mettre à jour ma carte
            </button>
          )}
        </div>
      )}
      {view.cancel_at_period_end && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary-50 border border-primary-100 px-5 py-4 text-sm">
          <p className="min-w-0 flex-1 text-gray-900">Votre abonnement prend fin le {end ?? 'dernier jour de la période en cours'}.</p>
          {canManage && (
            <button type="button" disabled={!!busy} onClick={() => run('resume', resumeSubscription, 'Votre abonnement continue.')} className={btnPrimary}>
              {spin('resume')}Reprendre mon abonnement
            </button>
          )}
        </div>
      )}

      <section className={cn(cardCls, 'overflow-hidden')}>
        <dl className="divide-y divide-gray-100">
          <Row label="Formule">{plan ? PLAN_LABEL[plan] : '—'}</Row>
          <Row label="Statut">{view.statusLabel}</Row>
          {end && <Row label={view.cancel_at_period_end ? 'Fin de l’abonnement' : 'Prochaine échéance'}>{end}</Row>}
          {plan && <Row label="Montant">{planAmount(plan)}</Row>}
        </dl>
        {view.testMode && <p className="border-t border-gray-100 px-5 py-3 text-xs font-semibold text-primary-800">Mode test</p>}
      </section>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {plan === 'mensuel' && !view.cancel_at_period_end && (
            <button type="button" disabled={!!busy} onClick={onAnnual} className={btnPrimary}>{spin('annual')}Passer en annuel</button>
          )}
          {view.status !== 'past_due' && (
            <button type="button" disabled={!!busy} onClick={() => run('portal', openBillingPortal)} className={btnSecondary}>
              {spin('portal')}Gérer ma carte et mes factures
            </button>
          )}
          {!view.cancel_at_period_end && (
            <button type="button" disabled={!!busy} onClick={onCancel} className={cn(btnGhost, 'text-gray-600')}>{spin('cancel')}Annuler l’abonnement</button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-600">Seul le titulaire du compte peut gérer l’abonnement.</p>
      )}
    </div>
  );
}
