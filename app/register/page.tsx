import Link from 'next/link';
import AuthShell, { authButton } from '@/components/auth/AuthShell';
import RegisterForm from '@/components/auth/RegisterForm';
import { isSignupOpen } from '@/server/settings';

export const metadata = { title: 'Créer un compte — WeboDevis' };
export const dynamic = 'force-dynamic';

const login = <>Déjà un compte ? <Link href="/login" className="font-medium text-primary hover:underline">Se connecter</Link></>;

export default async function RegisterPage() {
  // Inscriptions fermées depuis l'espace d'administration : les comptes sont créés sur demande.
  if (!(await isSignupOpen())) {
    return (
      <AuthShell
        title="Les inscriptions ouvrent bientôt"
        subtitle="En attendant, vous pouvez parcourir l’application avec le compte de démonstration, ou nous écrire pour ouvrir un compte."
        footer={login}
      >
        <div className="space-y-3">
          <Link href="/demo" className={authButton}>Essayer la démo</Link>
          <Link href="/contact?objet=devis" className="w-full h-[52px] flex items-center justify-center rounded-2xl border border-gray-200 bg-white text-base font-semibold text-gray-900 hover:border-gray-300 transition-colors">
            Demander un devis
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Créer un compte" subtitle="Quelques informations, et vous préparez votre premier devis." footer={login}>
      <RegisterForm />
    </AuthShell>
  );
}
