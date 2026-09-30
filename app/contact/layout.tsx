import SiteShell from '@/components/site/SiteShell';
import { siteMetadata } from '@/lib/site/metadata';

// Habillage du site de présentation (voir components/site/SiteShell.tsx), sans la barre d'action fixe :
// sur cette page, le bouton à l'écran est celui du formulaire.
export const metadata = siteMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SiteShell actionBar={false}>{children}</SiteShell>;
}
