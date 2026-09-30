import { ImageResponse } from 'next/og';

// Image de partage (Open Graph) : le nom et la promesse sur le vert sapin, générée sans fichier image.
export const alt = 'WeboDevis, le logiciel des traiteurs : du premier devis au dernier couvert servi.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
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
          background: '#1C2621',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 600, letterSpacing: -1.5 }}>WeboDevis</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1, letterSpacing: -3, maxWidth: 980 }}>
            Du premier devis au dernier couvert servi.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 44, fontSize: 32, color: 'rgba(255,255,255,0.7)' }}>
            <div style={{ display: 'flex', width: 56, height: 8, borderRadius: 4, background: '#B4502D', marginRight: 24 }} />
            Le logiciel des traiteurs
          </div>
        </div>
      </div>
    ),
    size,
  );
}
