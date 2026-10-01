import { NextResponse } from 'next/server';
import { getMissionPage } from '@/server/missions';

// Fiche d'installation propre à chaque extra : installée sur l'écran d'accueil, l'app s'ouvre sur ses missions.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await getMissionPage(token);
  if (!page) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const base = `/e/${token}`;
  return NextResponse.json({
    name: `Mes missions, ${page.company.name}`,
    short_name: 'Mes missions',
    description: `Les missions que ${page.company.name} vous confie`,
    id: base,
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#F3EEE6',
    theme_color: '#1C2621',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/512?maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}
