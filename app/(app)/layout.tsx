import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { CHECKOUT_SESSION_HEADER } from '@/lib/subscription';
import { syncCheckoutSession } from '@/server/billingActions';
import { getSessionUser } from '@/server/session';
import { appEntryAfterCheckout } from '@/server/subscriptionView';

// Durée maximale des actions serveur de l'application : une réponse de Webo (aiguilleur, outils, spécialiste) doit
// pouvoir finir et être payée avant d'être coupée.
export const maxDuration = 120;

// Une entreprise jamais abonnée ne voit pas le logiciel : son titulaire va payer sur /abonnement, ses collaborateurs y
// attendent. Le contrôle se fait ici, pas dans le middleware, qui ne lit pas la base.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  let readonly = false;
  if (user) {
    // Retour de Stripe Checkout avant le webhook : la session est appliquée tout de suite (relue chez Stripe et
    // vérifiée), pour ne laisser ni sur l'écran de paiement ni en lecture seule quelqu'un qui vient de payer.
    const checkoutSession = (await headers()).get(CHECKOUT_SESSION_HEADER);
    const entry = await appEntryAfterCheckout(user.id, !!user.actingAsAdmin, checkoutSession, syncCheckoutSession);
    if (entry.gate !== 'enter') redirect('/abonnement');
    readonly = entry.access === 'readonly';
  }
  return <AppShell readonly={readonly}>{children}</AppShell>;
}
