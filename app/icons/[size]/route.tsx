import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// Icône de l'app, dessinée à la demande : l'initiale de la marque sur fond vert sapin.
// /icons/192, /icons/512, /icons/180 (Apple) ; ?maskable=1 laisse la marge de sécurité d'Android.
export async function GET(request: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(48, parseInt((await params).size, 10) || 192));
  const maskable = request.nextUrl.searchParams.has('maskable');
  const letter = Math.round(size * (maskable ? 0.46 : 0.58));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1C2621 50%, #5a3526 100%)',
          color: '#ffffff',
          fontSize: letter,
          fontWeight: 700,
          letterSpacing: '-0.04em',
        }}
      >
        W
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } },
  );
}
