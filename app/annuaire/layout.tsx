import type { Metadata, Viewport } from 'next';
import { DM_Sans, Gabarito } from 'next/font/google';
import '@/components/annuaire/annuaire.css';
import AnnuaireShell from '@/components/annuaire/AnnuaireShell';
import { DirectoryBaseProvider } from '@/components/annuaire/BaseContext';
import DirectoryAnalytics from '@/components/annuaire/DirectoryAnalytics';
import { directoryBase } from '@/lib/annuaire/base';
import { DIRECTORY_NAME, DIRECTORY_URL } from '@/lib/annuaire/config';
import { DIRECTORY_SHARE_IMAGE, directoryRobots } from '@/lib/annuaire/metadata';

// Layout de l'annuaire « Choisir Mon Traiteur » : ses propres métadonnées, polices, couleurs et gabarit. Il remplace
// tout ce que le layout racine pose pour WeboDevis (titre, icônes, app installable). Aucun cookie, aucun Google Tag Manager.

const display = Gabarito({ subsets: ['latin'], weight: '800', variable: '--cmt-display' });
const text = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--cmt-text' });

const DESCRIPTION = 'Trouvez un traiteur près de chez vous pour un mariage, un cocktail ou un séminaire, et écrivez-lui directement. Gratuit pour vous.';

export const metadata: Metadata = {
  metadataBase: new URL(DIRECTORY_URL),
  title: { default: DIRECTORY_NAME, template: `%s | ${DIRECTORY_NAME}` },
  description: DESCRIPTION,
  applicationName: DIRECTORY_NAME,
  // Pas l'app installable de WeboDevis : ni manifeste, ni réglages d'écran d'accueil.
  manifest: null,
  appleWebApp: { capable: false, title: DIRECTORY_NAME },
  // Le monogramme « CMT » blanc sur carré pourpre arrondi (public/annuaire/icone-<taille>.png).
  icons: {
    icon: [
      { url: '/annuaire/icone-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/annuaire/icone-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/annuaire/icone-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/annuaire/icone-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/annuaire/icone-180.png', sizes: '180x180' }],
  },
  openGraph: { siteName: DIRECTORY_NAME, locale: 'fr_FR', type: 'website', images: [DIRECTORY_SHARE_IMAGE] },
  formatDetection: { telephone: false },
  // Sans domaine propre, rien n'est indexé (vaut aussi pour les pages sans métadonnées à elles, comme une fiche introuvable).
  robots: directoryRobots(false, process.env.DIRECTORY_HOST),
};

export const viewport: Viewport = { themeColor: '#FFFFFF' };

export default async function AnnuaireLayout({ children }: { children: React.ReactNode }) {
  const base = await directoryBase();
  return (
    <div className={`cmt ${display.variable} ${text.variable}`}>
      <DirectoryBaseProvider base={base}>
        <AnnuaireShell>{children}</AnnuaireShell>
        <DirectoryAnalytics />
      </DirectoryBaseProvider>
    </div>
  );
}
