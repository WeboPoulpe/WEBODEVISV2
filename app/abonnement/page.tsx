import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell, { authButton } from '@/components/auth/AuthShell';
import PlanCards from '@/components/billing/PlanCards';
import SignOutButton from '@/components/billing/SignOutButton';
import { getSessionUser } from '@/server/session';
import { subscriptionView } from '@/server/subscriptionView';

// Écran de paiement, hors de l'app (app/(app) y renvoie une entreprise jamais abonnée) : les deux formules et
// « S'abonner » vers Stripe Checkout. Un collaborateur y attend que le titulaire s'abonne, sans bouton de paiement.

export const metadata = { title: 'Abonnement — WeboDevis' };
export const dynamic = 'force-dynamic';

const link = 'font-medium text-primary hover:underline';

export default async function AbonnementPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const view = await subscriptionView(user.id);

  // Déjà abonné ou accès offert : rien à payer ici.
  if (view.subscribed || view.comped) redirect(view.isOwner ? '/parametres/abonnement' : '/');

  const footer = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SignOutButton className={link} />
      <Link href="/demo" className={link}>Essayer la démo</Link>
    </div>
  );

  if (!view.isOwner) {
    if (view.access !== 'unpaid') redirect('/');
    return (
      <AuthShell
        title="L’abonnement de votre entreprise n’est pas encore actif"
        subtitle="Le titulaire du compte doit choisir une formule. Vous entrerez dans WeboDevis dès qu’il l’aura fait."
        footer={footer}
      >
        <a href="/abonnement" className={authButton}>Vérifier à nouveau</a>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={view.access === 'readonly' ? 'Réactivez votre abonnement' : 'Choisissez votre formule'}
      subtitle={view.access === 'readonly'
        ? 'Vos données restent consultables et exportables. Réabonnez-vous pour les modifier à nouveau.'
        : 'Votre compte est prêt. Abonnez-vous pour ouvrir WeboDevis.'}
      footer={footer}
    >
      <PlanCards canSubscribe={!user.actingAsAdmin} testMode={view.testMode} buttonClassName={authButton} />
    </AuthShell>
  );
}
