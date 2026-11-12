import Link from 'next/link';
import { AnnuaireLogo } from '@/components/annuaire/AnnuaireMark';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';
import { fromDirectory, loginDestination } from '@/lib/annuaire/login';

export const metadata = { title: 'Connexion — WeboDevis' };

type Search = Promise<{ [k: string]: string | string[] | undefined }>;

/** Venu de Choisir Mon Traiteur (?source=annuaire) : ce qu'il fait ici, dans l'apparence de WeboDevis. */
function DirectoryNote() {
  return (
    <div className="mb-7 rounded-2xl border border-gray-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <AnnuaireLogo eager className="block h-9 w-auto" />
        <span className="text-sm text-gray-600">en partenariat avec WeboDevis</span>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
        Votre fiche Choisir Mon Traiteur se gère depuis WeboDevis, le logiciel partenaire. Connectez-vous avec votre compte WeboDevis.
      </p>
    </div>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { source } = await searchParams;
  return (
    <AuthShell
      title="Connexion"
      subtitle="Retrouvez vos devis et vos événements."
      footer={<>Pas encore de compte ? <Link href="/register" className="font-medium text-primary hover:underline">Créer un compte</Link></>}
    >
      {fromDirectory(source) && <DirectoryNote />}
      <LoginForm destination={loginDestination(source)} />
    </AuthShell>
  );
}
