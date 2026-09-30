import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import DemoStart from './DemoStart';

export const metadata: Metadata = {
  title: 'Essayer WeboDevis : la démonstration',
  description: 'Ouvrez le compte d’un traiteur fictif et parcourez WeboDevis : devis, demandes, événements, courses, équipe.',
};

export default function DemoPage() {
  return (
    <AuthShell
      title="Essayez WeboDevis"
      subtitle="Trois étapes courtes, puis vous entrez dans le compte de Maison Verdier, un traiteur inventé pour l’occasion : une vingtaine de devis, des événements à préparer, un catalogue complet."
      footer={<>Déjà un compte ? <Link href="/login" className="font-semibold text-primary hover:text-primary-dark">Se connecter</Link></>}
    >
      <DemoStart />
    </AuthShell>
  );
}
