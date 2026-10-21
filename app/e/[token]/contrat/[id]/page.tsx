export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download } from 'lucide-react';
import ContractView from '@/components/extras/ContractView';
import { contractForExtra } from '@/server/extraHrCore';
import SignContract from './SignContract';

export const metadata = { title: 'Mon contrat', robots: { index: false, follow: false } };

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');

// Contrat d'une mission, pour l'extra : lecture, signature en ligne, PDF. Son lien personnel suffit.
export default async function ExtraContractPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const c = await contractForExtra(token, id);
  if (!c) notFound();
  const pdf = `/e/${token}/contrat/${c.id}/pdf`;

  return (
    <div className="min-h-[100dvh] bg-page">
      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
        <Link href={`/e/${token}`} className="inline-flex items-center gap-2 h-11 -ml-1 px-1 text-[15px] font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />Mes missions
        </Link>

        {c.status === 'signe' ? (
          <div role="status" className="flex items-start gap-3 rounded-3xl bg-sage-100/70 px-5 py-4">
            <CheckCircle2 className="h-5 w-5 text-sage flex-shrink-0 mt-0.5" />
            <p className="text-[15px] text-gray-800">
              {c.onPaper || !c.signedAt ? 'Ce contrat est signé sur papier.' : `Contrat signé par ${c.signerName} le ${when(c.signedAt)}.`} Gardez-en une copie.
            </p>
          </div>
        ) : (
          <p className="text-[15px] text-gray-700">Lisez votre contrat jusqu’au bout, puis signez-le en bas de la page.</p>
        )}

        <article className="rounded-3xl bg-white border border-gray-200 p-5 sm:p-7">
          <ContractView doc={c.doc} />
        </article>

        <a href={`${pdf}?telecharger=1`} className="inline-flex w-full items-center justify-center gap-2 h-12 px-4 rounded-2xl bg-white border border-gray-200 text-[15px] font-semibold text-gray-800 hover:bg-gray-50">
          <Download className="h-4 w-4" />{c.status === 'signe' ? 'Télécharger le contrat signé' : 'Télécharger le contrat (PDF)'}
        </a>

        {c.status === 'envoye' && <SignContract token={token} contractId={c.id} defaultName={c.doc.employee.name || c.extraName} />}

        <p className="text-center text-xs text-gray-500 pt-2">Page personnelle : ne partagez pas ce lien.</p>
      </div>
    </div>
  );
}
