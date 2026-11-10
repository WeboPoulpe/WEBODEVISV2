import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { LOGO_FOREST, LOGO_VIEWBOX, logoDataUri } from '@/lib/brand/logo';

// Icône de l'app, dessinée à la demande : le symbole W sur fond vert sapin.
// /icons/192, /icons/512, /icons/180 (Apple) ; ?maskable=1 laisse la marge de sécurité d'Android.
export async function GET(request: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(48, parseInt((await params).size, 10) || 192));
  const maskable = request.nextUrl.searchParams.has('maskable');
  const markWidth = Math.round(size * (maskable ? 0.56 : 0.7));
  const markHeight = Math.round((markWidth * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `radial-gradient(circle at 30% 20%, #2B3A33 0%, ${LOGO_FOREST} 70%)`,
        }}
      >
        <img alt="" src={logoDataUri()} width={markWidth} height={markHeight} />
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=604800, immutable' } },
  );
}
