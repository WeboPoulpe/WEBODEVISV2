import Link from 'next/link';
import AuthShell, { authButton } from '@/components/auth/AuthShell';
import { getInvitation } from '@/server/team';
import AcceptInvitationForm from './AcceptInvitationForm';

export const metadata = { title: 'Rejoindre une équipe — WeboDevis', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Lien reçu par email : la personne invitée crée son accès à l'entreprise qui l'a invitée.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getInvitation(token);

  if (inv.status !== 'ok') {
    const text = inv.status === 'used'
      ? 'Cette invitation a déjà servi. Connectez-vous avec l’adresse à laquelle vous l’avez reçue.'
      : 'Ce lien n’est plus valable. Demandez une nouvelle invitation à la personne qui vous l’a envoyée.';
    return (
      <AuthShell title={inv.status === 'used' ? 'Invitation déjà acceptée' : 'Invitation expirée'} subtitle={text}>
        <Link href="/login" className={authButton}>Se connecter</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Rejoindre ${inv.companyName}`}
      subtitle={`Vous êtes invité comme ${inv.roleLabel}. Choisissez votre mot de passe pour créer votre accès.`}
    >
      <AcceptInvitationForm token={token} email={inv.email!} />
    </AuthShell>
  );
}
