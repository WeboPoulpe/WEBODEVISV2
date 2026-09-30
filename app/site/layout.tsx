import type { Metadata } from 'next';
import './site.css';

// Site de présentation : pages publiques, rendues côté serveur, sans JavaScript propre.
export const metadata: Metadata = {
  metadataBase: new URL('https://webodevis.fr'),
  openGraph: {
    siteName: 'WeboDevis',
    locale: 'fr_FR',
    type: 'website',
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site min-h-[100dvh] bg-page text-gray-900">
      <a href="#contenu" className="site-skip">Aller au contenu</a>
      {children}
    </div>
  );
}
