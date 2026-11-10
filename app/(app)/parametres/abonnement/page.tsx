import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { iconBtn } from '@/components/ui/kit';
import SubscriptionManager from '@/components/billing/SubscriptionManager';
import { getSessionUser } from '@/server/session';
import { subscriptionView } from '@/server/subscriptionView';

// Paramètres → Abonnement : formule, statut, échéance et boutons de gestion pour le titulaire ; les collaborateurs
// voient l'état sans les boutons.

export const metadata = { title: 'Abonnement — WeboDevis' };
export const dynamic = 'force-dynamic';

export default async function AbonnementSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const view = await subscriptionView(user.id);
  return (
    <div className="px-4 md:px-6 pb-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/parametres" className={iconBtn} aria-label="Retour aux paramètres"><ArrowLeft className="h-4 w-4" /></Link>
        <h1 className="text-[26px] md:text-[32px] font-bold text-gray-900 leading-tight">Abonnement</h1>
      </div>
      <SubscriptionManager view={view} canManage={view.isOwner && !user.actingAsAdmin} />
    </div>
  );
}
