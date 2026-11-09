// La brochure telle que le lecteur la feuillette, à partir du lien reçu. Aucun compte n'est nécessaire : le jeton
// du lien (principal, ou lien par source ou par client) est la seule clé, et il ne donne accès qu'à cette brochure.
// Un lien peut demander un code, ou avoir expiré.

import type { Metadata } from 'next';
import { brochureGate, brochureShareMeta, brochureUnavailableCompany, getPublicBrochure, recordBrochureView } from '@/server/brochures';
import BrochureBook from './BrochureBook';
import CodeGate from './CodeGate';
import StudioBook from '@/components/brochures/studio/StudioBook';

export const dynamic = 'force-dynamic';

/** Aperçu soigné quand le lien est partagé (WhatsApp, Facebook, SMS…) : titre, entreprise, photo de couverture. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const meta = await brochureShareMeta(token).catch(() => null);
  const robots = { index: false, follow: false };
  if (!meta) return { title: 'Brochure', robots };
  const images = meta.image ? [{ url: meta.image, alt: meta.title }] : undefined;
  return {
    title: { absolute: meta.title }, description: meta.description, robots,
    openGraph: { type: 'website', title: meta.title, description: meta.description, ...(images ? { images } : {}) },
    twitter: { card: meta.image ? 'summary_large_image' : 'summary', title: meta.title, description: meta.description, ...(meta.image ? { images: [meta.image] } : {}) },
  };
}

function Closed({ title, company }: { title: string; company: { name: string; email: string | null } | null }) {
  return (
    <main className="min-h-screen bg-[#EDE6DA] flex items-center justify-center px-4">
      <div className="max-w-md text-center text-[#1C2621]">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-[#5b5b55]">
          {company
            ? <>Pour recevoir la version à jour, contactez {company.name}{company.email ? <> : <a className="underline" href={`mailto:${company.email}`}>{company.email}</a></> : null}.</>
            : 'Le lien a peut-être été remplacé. Demandez-en un nouveau à votre traiteur.'}
        </p>
      </div>
    </main>
  );
}

export default async function BrochurePublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gate = await brochureGate(token).catch(() => 'gone' as const);
  if (gate === 'code') return <CodeGate token={token} />;
  const brochure = gate === 'ok' ? await getPublicBrochure(token) : null;
  if (!brochure) {
    const company = await brochureUnavailableCompany(token).catch(() => null);
    return <Closed title={gate === 'expired' ? 'Ce lien a expiré' : 'Cette brochure n’est plus disponible'} company={company} />;
  }
  // Une ouverture comptée ne doit jamais empêcher d'afficher la brochure.
  await recordBrochureView(token).catch(() => {});
  if (brochure.studio) {
    // Studio : plein écran sur téléphone (le lecteur prend tout l'écran), livre centré ailleurs.
    return (
      <main className="min-h-[100dvh] bg-[#EDE6DA] flex flex-col items-center justify-center md:px-4 md:py-6">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        {brochure.fontsHref && <link rel="stylesheet" href={brochure.fontsHref} />}
        <StudioBook pages={brochure.studio} language={brochure.language} name={brochure.name} token={token} greeting={brochure.greeting}
          options={brochure.studioOptions ?? undefined} companyPhone={brochure.company.phone} tax={brochure.tax} />
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#EDE6DA] flex flex-col items-center justify-center px-4 py-6">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      {brochure.fontsHref && <link rel="stylesheet" href={brochure.fontsHref} />}
      {brochure.greeting && <p className="mb-3 rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-[#1C2621] shadow-sm">{brochure.greeting}</p>}
      <BrochureBook brochure={brochure} token={token} />
    </main>
  );
}
