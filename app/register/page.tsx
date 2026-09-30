import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata = { title: 'Créer un compte — WeboDevis' };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Créer un compte"
      subtitle="14 jours d'essai gratuit, sans carte bancaire."
      footer={<>Déjà un compte ? <Link href="/login" className="font-medium text-primary hover:underline">Se connecter</Link></>}
    >
      <RegisterForm />
    </AuthShell>
  );
}
