import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { LOGO_VIEWBOX, logoDataUri } from '@/lib/brand/logo';

// Image de partage (Open Graph) : le logo, la promesse et la démo gratuite sur le vert sapin, dans les polices du site
// (Outfit pour le nom, Bricolage Grotesque pour le titre, Instrument Sans pour le texte). Générée au build.
export const alt = 'WeboDevis, le logiciel des traiteurs : du premier devis au dernier couvert servi.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = (file: string) => readFile(join(process.cwd(), 'assets/fonts', file));

export default async function OpengraphImage() {
  const [display, brand, ui] = await Promise.all([
    font('BricolageGrotesque-Bold.ttf'), font('Outfit-Medium.ttf'), font('InstrumentSans-Regular.ttf'),
  ]);
  const logoW = 76;
  const logoH = Math.round((logoW * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'radial-gradient(circle at 85% 0%, #2B3A33 0%, #1C2621 60%)',
          color: '#FFFFFF',
          fontFamily: 'Instrument Sans',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Outfit', fontSize: 46, letterSpacing: -1 }}>
          <img alt="" src={logoDataUri()} width={logoW} height={logoH} style={{ marginRight: 18 }} />
          WeboDevis
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Bricolage Grotesque', fontSize: 96, lineHeight: 0.98, letterSpacing: -4 }}>
            <span>Le logiciel</span>
            <span style={{ display: 'flex' }}>
              des&nbsp;<span style={{ display: 'flex', flexDirection: 'column' }}>
                traiteurs.
                <span style={{ display: 'flex', height: 10, marginTop: 4, borderRadius: 6, background: '#D88C68', width: '96%' }} />
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40 }}>
            <div style={{ display: 'flex', fontSize: 34, color: '#E5AE92' }}>Du premier devis au dernier couvert servi.</div>
            <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.75)' }}>Démonstration gratuite</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bricolage Grotesque', data: display, weight: 700, style: 'normal' },
        { name: 'Outfit', data: brand, weight: 500, style: 'normal' },
        { name: 'Instrument Sans', data: ui, weight: 400, style: 'normal' },
      ],
    },
  );
}
