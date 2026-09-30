import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = { title: 'Connexion — WeboDevis' };

export default function LoginPage() {
  return (
    <AuthShell
      title="Connexion"
      subtitle="Retrouvez vos devis et vos événements."
      footer={<>Pas encore de compte ? <Link href="/register" className="font-medium text-primary hover:underline">Créer un compte</Link></>}
    >
      <LoginForm />
    </AuthShell>
  );
}
