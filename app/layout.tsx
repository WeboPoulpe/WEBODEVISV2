import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import RegisterServiceWorker from '@/components/pwa/RegisterServiceWorker';

// Interface : Instrument Sans. Titres et grands chiffres : Bricolage Grotesque.
const ui = Instrument_Sans({ subsets: ['latin'], variable: '--font-ui' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
// Nom de la marque : police système d'Apple, Inter en repli.
const brand = Inter({ subsets: ['latin'], variable: '--font-brand', weight: ['600'] });

// Police des documents de devis (inchangée).
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'WeboDevis',
  description: 'Devis, événements et production pour les traiteurs',
  applicationName: 'WeboDevis',
  // Installation sur l'écran d'accueil d'un iPhone ou d'un iPad.
  appleWebApp: { capable: true, title: 'WeboDevis', statusBarStyle: 'default' },
  icons: { icon: '/icons/192', apple: '/icons/180' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F3EEE6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${ui.variable} ${display.variable} ${brand.variable} ${playfair.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
