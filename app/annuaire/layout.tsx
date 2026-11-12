import type { Metadata, Viewport } from 'next';
import { DM_Sans, Gabarito, Lobster } from 'next/font/google';
import '@/components/annuaire/annuaire.css';
import AnnuaireShell from '@/components/annuaire/AnnuaireShell';
import { DirectoryBaseProvider } from '@/components/annuaire/BaseContext';
import DirectoryAnalytics from '@/components/annuaire/DirectoryAnalytics';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME, DIRECTORY_URL } from '@/lib/annuaire/config';
import { DIRECTORY_SHARE_IMAGE } from '@/lib/annuaire/metadata';

// Layout de l'annuaire « Choisir Mon Traiteur » : ses propres métadonnées, polices, couleurs et gabarit. Il remplace
// tout ce que le layout racine pose pour WeboDevis (titre, icônes, app installable). Aucun cookie, aucun Google Tag Manager.

const display = Gabarito({ subsets: ['latin'], weight: ['600', '800'], variable: '--cmt-display' });
const text = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--cmt-text' });
const script = Lobster({ subsets: ['latin'], weight: '400', variable: '--cmt-script' });

const DESCRIPTION = 'Trouvez un traiteur près de chez vous pour un mariage, un cocktail ou un séminaire, et écrivez-lui directement. Gratuit pour vous.';

export const metadata: Metadata = {
  metadataBase: new URL(DIRECTORY_URL),
  title: { default: DIRECTORY_NAME, template: `%s | ${DIRECTORY_NAME}` },
  description: DESCRIPTION,
  applicationName: DIRECTORY_NAME,
  // Pas l'app installable de WeboDevis : ni manifeste, ni réglages d'écran d'accueil.
  manifest: null,
  appleWebApp: { capable: false, title: DIRECTORY_NAME },
  icons: { icon: [{ url: '/annuaire/icone.svg', type: 'image/svg+xml' }] },
  openGraph: { siteName: DIRECTORY_NAME, locale: 'fr_FR', type: 'website', images: [DIRECTORY_SHARE_IMAGE] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#011B3D' };

export default async function AnnuaireLayout({ children }: { children: React.ReactNode }) {
  const base = await directoryBase();
  return (
    <div className={`cmt ${display.variable} ${text.variable} ${script.variable}`}>
      <DirectoryBaseProvider base={base}>
        <AnnuaireShell>{children}</AnnuaireShell>
        <DirectoryAnalytics />
      </DirectoryBaseProvider>
    </div>
  );
}
