import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import DemoStart from './DemoStart';

export const metadata: Metadata = {
  title: 'Essayer WeboDevis : la démonstration',
  description: 'Ouvrez le compte d’un traiteur fictif et parcourez WeboDevis : devis, demandes, événements, courses, équipe. Sans inscription.',
};

const INSIDE = [
  'Une vingtaine de devis, à tous les stades',
  'Des événements à préparer : checklist, matériel, courses, extras',
  'Un catalogue de prestations et d’ingrédients, des clients, des fournisseurs',
];

export default function DemoPage() {
  return (
    <AuthShell
      title="Essayez WeboDevis"
      subtitle="Vous entrez dans le compte de Maison Verdier, un traiteur inventé pour l’occasion. Aucune inscription."
      footer={<>Déjà un compte ? <Link href="/login" className="font-semibold text-primary hover:text-primary-dark">Se connecter</Link></>}
    >
      <ul className="space-y-2.5 text-[15px] text-gray-700 mb-6">
        {INSIDE.map((line) => (
          <li key={line} className="flex gap-3">
            <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            {line}
          </li>
        ))}
      </ul>
      <DemoStart />
      <p className="text-sm text-gray-500 mt-4">
        Vous pouvez tout ouvrir et tout essayer. Ce que vous modifiez n’est pas enregistré, et l’envoi d’emails et de fichiers est fermé.
      </p>
    </AuthShell>
  );
}
