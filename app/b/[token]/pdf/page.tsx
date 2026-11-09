// Une brochure du Studio en A4, prête à imprimer ou à enregistrer en PDF (fenêtre d'impression du navigateur).
// Mêmes pages que le lien, sans la page du formulaire. Les ouvertures ne sont pas comptées.

import type { Metadata } from 'next';
import { getPublicBrochure } from '@/server/brochures';
import StudioPrint from '@/components/brochures/studio/StudioPrint';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const b = await getPublicBrochure(token).catch(() => null);
  // Le titre de la page devient le nom proposé pour le fichier PDF.
  return { title: { absolute: b?.name ?? 'Brochure' }, robots: { index: false, follow: false } };
}

export default async function BrochurePdfPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const brochure = await getPublicBrochure(token);
  if (!brochure?.studio) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 text-center text-[#1C2621]">
        <p>{brochure ? 'L’export PDF est réservé aux brochures composées dans le Studio.' : 'Cette brochure n’est plus disponible.'}</p>
      </main>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      {brochure.fontsHref && <link rel="stylesheet" href={brochure.fontsHref} />}
      <StudioPrint pages={brochure.studio.filter((p) => !p.form)} language={brochure.language} name={brochure.name} />
    </>
  );
}
