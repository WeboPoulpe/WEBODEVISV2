// La brochure telle que le lecteur la feuillette, à partir du lien reçu. Aucun compte n'est nécessaire : le jeton
// du lien est la seule clé, et il ne donne accès qu'à cette brochure.

import type { Metadata } from 'next';
import { brochureUnavailableCompany, getPublicBrochure, recordBrochureView } from '@/server/brochures';
import BrochureBook from './BrochureBook';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Brochure', robots: { index: false, follow: false } };

export default async function BrochurePublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const brochure = await getPublicBrochure(token);
  if (!brochure) {
    const company = await brochureUnavailableCompany(token).catch(() => null);
    return (
      <main className="min-h-screen bg-[#EDE6DA] flex items-center justify-center px-4">
        <div className="max-w-md text-center text-[#1C2621]">
          <h1 className="text-2xl font-semibold">Cette brochure n’est plus disponible</h1>
          <p className="mt-3 text-[#5b5b55]">
            {company
              ? <>Pour recevoir la version à jour, contactez {company.name}{company.email ? <> : <a className="underline" href={`mailto:${company.email}`}>{company.email}</a></> : null}.</>
              : 'Le lien a peut-être été remplacé. Demandez-en un nouveau à votre traiteur.'}
          </p>
        </div>
      </main>
    );
  }
  // Une ouverture comptée ne doit jamais empêcher d'afficher la brochure.
  await recordBrochureView(token).catch(() => {});
  return (
    <main className="min-h-screen bg-[#EDE6DA] flex flex-col items-center justify-center px-4 py-6">
      <BrochureBook brochure={brochure} />
    </main>
  );
}
