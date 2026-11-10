import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { CHECKOUT_SESSION_HEADER } from '@/lib/subscription';
import { syncCheckoutSession } from '@/server/billingActions';
import { getSessionUser } from '@/server/session';
import { appEntry } from '@/server/subscriptionView';

// Durée maximale des actions serveur de l'application : une réponse de Webo (aiguilleur, outils, spécialiste) doit
// pouvoir finir et être payée avant d'être coupée.
export const maxDuration = 120;

// Une entreprise jamais abonnée ne voit pas le logiciel : son titulaire va payer sur /abonnement, ses collaborateurs y
// attendent. Le contrôle se fait ici, pas dans le middleware, qui ne lit pas la base.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  let readonly = false;
  if (user) {
    const actingAsAdmin = !!user.actingAsAdmin;
    let entry = await appEntry(user.id, actingAsAdmin);
    // Retour de Stripe Checkout avant le webhook : on applique la session tout de suite, pour ne jamais renvoyer
    // sur l'écran de paiement quelqu'un qui vient de payer (session relue chez Stripe et vérifiée).
    const checkoutSession = (await headers()).get(CHECKOUT_SESSION_HEADER);
    if (entry.gate === 'pay' && checkoutSession) {
      await syncCheckoutSession(checkoutSession);
      entry = await appEntry(user.id, actingAsAdmin);
    }
    if (entry.gate !== 'enter') redirect('/abonnement');
    readonly = entry.access === 'readonly';
  }
  return <AppShell readonly={readonly}>{children}</AppShell>;
}
