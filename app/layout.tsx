import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

// Interface : Instrument Sans. Titres et grands chiffres : Bricolage Grotesque.
const ui = Instrument_Sans({ subsets: ['latin'], variable: '--font-ui' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });

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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0C4A5B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${ui.variable} ${display.variable} ${playfair.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
