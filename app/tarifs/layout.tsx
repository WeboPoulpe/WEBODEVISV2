import SiteShell from '@/components/site/SiteShell';
import { siteMetadata } from '@/lib/site/metadata';

// Habillage du site de présentation : en-tête, mégamenu, pied de page (voir components/site/SiteShell.tsx).
export const metadata = siteMetadata;

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
