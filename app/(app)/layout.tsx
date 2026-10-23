import AppShell from '@/components/layout/AppShell';

// Durée maximale des actions serveur de l'application : une réponse de Webo (aiguilleur, outils, spécialiste) doit
// pouvoir finir et être payée avant d'être coupée.
export const maxDuration = 120;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
