// Export PDF d'une brochure du Studio par l'entreprise : marche même quand le lien public est désactivé.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStudioPrint } from '@/server/brochures';
import StudioPrint from '@/components/brochures/studio/StudioPrint';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getStudioPrint(id).catch(() => null);
  // Le titre de la page devient le nom proposé pour le fichier PDF.
  return { title: { absolute: data?.name ?? 'Brochure' }, robots: { index: false, follow: false } };
}

export default async function BrochurePdf({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getStudioPrint(id).catch(() => null);
  if (!data) notFound();
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      {data.fontsHref && <link rel="stylesheet" href={data.fontsHref} />}
      <StudioPrint pages={data.pages} language={data.language} name={data.name} />
    </>
  );
}
