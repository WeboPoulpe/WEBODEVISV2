// Lecture page par page d'une brochure du Studio, envoyée par le lecteur (navigator.sendBeacon en quittant la page,
// ou fetch pendant la lecture). Aucune réponse utile : le lecteur n'attend rien.

import { NextResponse, type NextRequest } from 'next/server';
import { recordStudioPages } from '@/server/brochures';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const text = await request.text().catch(() => '');
  if (text.length > 8000) return new NextResponse(null, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { return new NextResponse(null, { status: 400 }); }
  await recordStudioPages(token, (body as { pages?: unknown })?.pages).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
